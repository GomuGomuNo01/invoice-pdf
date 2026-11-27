package com.invoicepdf.web;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.invoicepdf.config.ApiProperties;

/**
 * Limitation de débit en mémoire, par adresse IP et par fenêtre fixe d'une minute,
 * sur l'endpoint de génération (opération coûteuse). Suffisant pour une instance unique ;
 * à remplacer par une limitation partagée (proxy ou cache distribué) si plusieurs instances.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final int limitPerMinute;
    private final String clientIpHeader;
    private final Clock clock;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Autowired
    public RateLimitFilter(ApiProperties properties) {
        this(properties, Clock.systemUTC());
    }

    RateLimitFilter(ApiProperties properties, Clock clock) {
        this.limitPerMinute = properties.rateLimitPerMinute();
        this.clientIpHeader = properties.clientIpHeader();
        this.clock = clock;
    }

    /** Adresse du client : en-tête de la plateforme s'il est configuré et présent, sinon adresse de connexion. */
    String clientAddress(HttpServletRequest request) {
        if (clientIpHeader != null) {
            String value = request.getHeader(clientIpHeader);
            if (value != null && !value.isBlank()) {
                return value.split(",")[0].strip();
            }
        }
        return request.getRemoteAddr();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("POST".equals(request.getMethod()) && request.getRequestURI().startsWith("/api/v1/invoices/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long minute = clock.millis() / 60_000;
        if (windows.size() > MAX_TRACKED_CLIENTS) {
            windows.values().removeIf(w -> w.minute < minute);
        }
        Window window = windows.compute(clientAddress(request),
                (ip, current) -> current == null || current.minute != minute ? new Window(minute, 1) : current.increment());

        if (window.count > limitPerMinute) {
            long retryAfter = 60 - (clock.millis() / 1000) % 60;
            response.setHeader("Retry-After", Long.toString(retryAfter));
            ProblemResponses.write(response, 429, "Trop de requêtes",
                    "Trop de générations en peu de temps. Réessayer dans une minute.");
            return;
        }
        chain.doFilter(request, response);
    }

    private record Window(long minute, int count) {
        Window increment() {
            return new Window(minute, count + 1);
        }
    }
}
