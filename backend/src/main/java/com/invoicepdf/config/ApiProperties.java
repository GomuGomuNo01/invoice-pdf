package com.invoicepdf.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Réglages de protection de l'API : origines CORS, taille maximale des requêtes, limitation de débit.
 *
 * @param clientIpHeader en-tête donnant l'adresse réelle du client, posé par la plateforme d'hébergement
 *                       (ex. CF-Connecting-IP). Vide par défaut : l'adresse vient de la connexion, corrigée
 *                       par X-Forwarded-For depuis un proxy interne. À n'utiliser que si la plateforme
 *                       écrase toujours cet en-tête (sinon un client pourrait l'inventer).
 */
@ConfigurationProperties(prefix = "invoice.api")
public record ApiProperties(
        List<String> corsAllowedOrigins,
        long maxRequestBytes,
        int rateLimitPerMinute,
        String clientIpHeader) {

    public ApiProperties {
        corsAllowedOrigins = corsAllowedOrigins == null ? List.of() : List.copyOf(corsAllowedOrigins);
        if (maxRequestBytes <= 0) {
            maxRequestBytes = 256 * 1024;
        }
        if (rateLimitPerMinute <= 0) {
            rateLimitPerMinute = 30;
        }
        clientIpHeader = clientIpHeader == null || clientIpHeader.isBlank() ? null : clientIpHeader.strip();
    }
}
