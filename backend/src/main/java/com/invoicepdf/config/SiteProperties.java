package com.invoicepdf.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Informations légales du site (éditeur et hébergeur), affichées dans les mentions légales.
 * Fournies par la configuration de production, jamais écrites dans le code.
 */
@ConfigurationProperties(prefix = "invoice.site")
public record SiteProperties(
        String editorName,
        String editorAddress,
        String editorEmail,
        String publicationDirector,
        String hostName,
        String hostAddress,
        String hostContact) {

    public SiteProperties {
        editorName = blankToNull(editorName);
        editorAddress = blankToNull(editorAddress);
        editorEmail = blankToNull(editorEmail);
        publicationDirector = blankToNull(publicationDirector);
        hostName = blankToNull(hostName);
        hostAddress = blankToNull(hostAddress);
        hostContact = blankToNull(hostContact);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
