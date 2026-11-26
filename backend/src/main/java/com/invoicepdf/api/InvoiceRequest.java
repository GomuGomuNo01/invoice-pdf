package com.invoicepdf.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Contrat d'entrée de l'API. Les champs calculés (montants, total, échéance) n'en font jamais partie :
 * ils sont recalculés côté serveur, et tout champ inconnu est rejeté.
 */
public record InvoiceRequest(
        @NotBlank(message = "Le numéro de facture est obligatoire.")
        @Pattern(regexp = Limits.INVOICE_NUMBER_REGEX, message = Limits.INVOICE_NUMBER_MESSAGE)
        String invoiceNumber,

        @NotNull(message = "La date de facture est obligatoire.")
        LocalDate invoiceDate,

        @NotNull(message = "Les conditions de paiement sont obligatoires.")
        @Min(value = 0, message = "Les conditions de paiement doivent être comprises entre 0 et 365 jours.")
        @Max(value = Limits.MAX_PAYMENT_TERMS_DAYS, message = "Les conditions de paiement doivent être comprises entre 0 et 365 jours.")
        Integer paymentTermsDays,

        @NotNull(message = "Le client est obligatoire.")
        @Valid
        Client client,

        @NotNull(message = "Au moins une ligne est obligatoire.")
        @Size(min = 1, max = Limits.MAX_LINES, message = "La facture doit contenir entre 1 et 100 lignes.")
        List<@NotNull @Valid Line> lines,

        @Size(max = Limits.MAX_NOTES, message = "Les mentions particulières dépassent 1000 caractères.")
        @Pattern(regexp = Limits.MULTILINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
        String notes,

        /** Facultatif : à défaut, l'émetteur de la configuration est utilisé. */
        @Valid
        Issuer issuer) {

    public record Issuer(
            @NotBlank(message = "Votre nom ou celui de votre entreprise est obligatoire.")
            @Size(max = Limits.MAX_NAME, message = "Le nom dépasse 120 caractères.")
            @Pattern(regexp = Limits.SINGLE_LINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
            String name,

            @Size(max = Limits.MAX_ADDRESS_LINES, message = "L'adresse contient au plus 5 lignes.")
            List<
                    @NotNull
                    @Size(max = Limits.MAX_ADDRESS_LINE, message = "Une ligne d'adresse dépasse 120 caractères.")
                    @Pattern(regexp = Limits.SINGLE_LINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
                    String> addressLines,

            @Pattern(regexp = Limits.SIRET_REGEX, message = Limits.SIRET_MESSAGE)
            String siret,

            @Size(max = Limits.MAX_EMAIL, message = "L'adresse e-mail dépasse 120 caractères.")
            @Email(message = "L'adresse e-mail n'est pas valide.")
            @Pattern(regexp = Limits.SINGLE_LINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
            String email,

            @Pattern(regexp = Limits.PHONE_REGEX, message = Limits.PHONE_MESSAGE)
            String phone,

            @Pattern(regexp = Limits.IBAN_REGEX, message = Limits.IBAN_MESSAGE)
            String iban) {
    }

    public record Client(
            @NotBlank(message = "Le nom du client est obligatoire.")
            @Size(max = Limits.MAX_NAME, message = "Le nom du client dépasse 120 caractères.")
            @Pattern(regexp = Limits.SINGLE_LINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
            String name,

            @Size(max = Limits.MAX_ADDRESS_LINES, message = "L'adresse du client contient au plus 5 lignes.")
            List<
                    @NotNull
                    @Size(max = Limits.MAX_ADDRESS_LINE, message = "Une ligne d'adresse dépasse 120 caractères.")
                    @Pattern(regexp = Limits.SINGLE_LINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
                    String> addressLines) {
    }

    public record Line(
            @NotBlank(message = "La description est obligatoire.")
            @Size(max = Limits.MAX_DESCRIPTION, message = "La description dépasse 500 caractères.")
            @Pattern(regexp = Limits.MULTILINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
            String description,

            @NotNull(message = "La quantité est obligatoire.")
            @DecimalMin(value = "0", inclusive = false, message = "La quantité doit être strictement positive.")
            @DecimalMax(value = Limits.MAX_QUANTITY, message = "La quantité est trop élevée.")
            @Digits(integer = 7, fraction = 3, message = "La quantité accepte au plus 3 décimales.")
            BigDecimal quantity,

            @Size(max = Limits.MAX_UNIT, message = "L'unité dépasse 20 caractères.")
            @Pattern(regexp = Limits.SINGLE_LINE_TEXT_REGEX, message = Limits.CONTROL_CHAR_MESSAGE)
            String unit,

            @NotNull(message = "Le prix unitaire est obligatoire.")
            @DecimalMin(value = "0", message = "Le prix unitaire doit être positif ou nul.")
            @DecimalMax(value = Limits.MAX_UNIT_PRICE, message = "Le prix unitaire est trop élevé.")
            @Digits(integer = 9, fraction = 2, message = "Le prix unitaire accepte au plus 2 décimales.")
            BigDecimal unitPrice) {
    }
}
