package com.invoicepdf.config;

import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Identité de l'émetteur, lue depuis la configuration (fichier .env ou variables d'environnement).
 * Aucune valeur réelle n'est écrite dans le code.
 */
@ConfigurationProperties(prefix = "invoice.issuer")
public record IssuerProperties(
        String name,
        String addressLine1,
        String addressLine2,
        String postalCode,
        String city,
        String siret,
        String email,
        String phone,
        String iban) {

    public IssuerProperties {
        name = blankToNull(name);
        addressLine1 = blankToNull(addressLine1);
        addressLine2 = blankToNull(addressLine2);
        postalCode = blankToNull(postalCode);
        city = blankToNull(city);
        siret = blankToNull(siret);
        email = blankToNull(email);
        phone = blankToNull(phone);
        iban = blankToNull(iban);
    }

    /** Lignes d'adresse non vides, code postal et ville réunis sur une ligne. */
    public List<String> addressLines() {
        String cityLine = Stream.of(postalCode, city).filter(Objects::nonNull).reduce((a, b) -> a + " " + b).orElse(null);
        return Stream.of(addressLine1, addressLine2, cityLine).filter(Objects::nonNull).toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
