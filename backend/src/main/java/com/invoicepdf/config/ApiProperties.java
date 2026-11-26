package com.invoicepdf.config;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Réglages de protection de l'API : origines CORS, taille maximale des requêtes, limitation de débit.
 */
@ConfigurationProperties(prefix = "invoice.api")
public record ApiProperties(
        List<String> corsAllowedOrigins,
        long maxRequestBytes,
        int rateLimitPerMinute) {

    public ApiProperties {
        corsAllowedOrigins = corsAllowedOrigins == null ? List.of() : List.copyOf(corsAllowedOrigins);
        if (maxRequestBytes <= 0) {
            maxRequestBytes = 256 * 1024;
        }
        if (rateLimitPerMinute <= 0) {
            rateLimitPerMinute = 30;
        }
    }
}
