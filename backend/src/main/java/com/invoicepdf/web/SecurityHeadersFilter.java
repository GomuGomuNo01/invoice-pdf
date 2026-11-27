package com.invoicepdf.web;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * En-têtes de sécurité HTTP sur toutes les réponses.
 * Trois politiques de contenu (CSP) : l'API (rien à charger), l'interface servie par l'application
 * (même politique que nginx dans la pile auto-hébergée) et la documentation Swagger UI (désactivable).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter extends OncePerRequestFilter {

    static final String CSP_API = "default-src 'none'; frame-ancestors 'none'";
    static final String CSP_DOCS =
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'";
    static final String CSP_INTERFACE = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; "
            + "form-action 'self'; frame-ancestors 'none'";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String uri = request.getRequestURI();
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Cross-Origin-Resource-Policy", "same-site");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        // HTTPS (directement ou via le proxy de l'hébergeur, d'après X-Forwarded-Proto) : HSTS.
        if (request.isSecure()) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }

        if (uri.startsWith("/api/docs") || uri.startsWith("/swagger-ui")) {
            response.setHeader("Content-Security-Policy", CSP_DOCS);
        } else if (uri.startsWith("/api/") || uri.startsWith("/actuator")) {
            response.setHeader("Content-Security-Policy", CSP_API);
        } else {
            response.setHeader("Content-Security-Policy", CSP_INTERFACE);
            // La page d'entrée (qui désigne les fichiers versionnés de /assets/) et le script de thème
            // sont redemandés à chaque visite : sans date de modification (voir application.yml),
            // le navigateur ne peut pas garder une ancienne version.
            if (uri.equals("/") || uri.equals("/index.html") || uri.equals("/theme-init.js")) {
                response.setHeader("Cache-Control", "no-cache");
            }
        }
        chain.doFilter(request, response);
    }
}
