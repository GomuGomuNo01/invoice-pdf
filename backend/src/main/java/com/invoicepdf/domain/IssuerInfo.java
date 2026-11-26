package com.invoicepdf.domain;

import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

import com.invoicepdf.api.InvoiceRequest;
import com.invoicepdf.config.IssuerProperties;

/**
 * Émetteur imprimé sur la facture : saisi dans le formulaire, ou à défaut lu dans la configuration.
 */
public record IssuerInfo(String name, List<String> addressLines, String siret, String email, String phone, String iban) {

    public IssuerInfo {
        name = blankToNull(name);
        addressLines = addressLines == null ? List.of()
                : addressLines.stream().filter(Objects::nonNull).map(String::strip).filter(s -> !s.isEmpty()).toList();
        siret = blankToNull(siret);
        email = blankToNull(email);
        phone = blankToNull(phone);
        iban = blankToNull(iban);
    }

    public static IssuerInfo from(InvoiceRequest.Issuer issuer) {
        return new IssuerInfo(issuer.name(), issuer.addressLines(), issuer.siret(), issuer.email(), issuer.phone(),
                issuer.iban());
    }

    public static IssuerInfo from(IssuerProperties properties) {
        return new IssuerInfo(properties.name(), properties.addressLines(), properties.siret(), properties.email(),
                properties.phone(), properties.iban());
    }

    /** Contact sur une ligne : "email - téléphone". */
    public String contact() {
        String joined = String.join(" - ", Stream.of(email, phone).filter(Objects::nonNull).toList());
        return joined.isEmpty() ? null : joined;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
