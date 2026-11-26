package com.invoicepdf.api;

/**
 * Bornes de validation partagées. Les mêmes valeurs sont reprises côté frontend (schéma Zod).
 */
public final class Limits {

    /** Lettres, chiffres, tiret, barre oblique, point, souligné. 1 à 30 caractères, commence par un alphanumérique. */
    public static final String INVOICE_NUMBER_REGEX = "^[A-Za-z0-9][A-Za-z0-9\\-/_.]{0,29}$";
    public static final String INVOICE_NUMBER_MESSAGE =
            "Le numéro de facture accepte 1 à 30 caractères : lettres, chiffres, - / _ . (ex. 558-00178).";

    /** Aucun caractère de contrôle. */
    public static final String SINGLE_LINE_TEXT_REGEX = "^[^\\p{Cntrl}]*$";
    /** Aucun caractère de contrôle sauf retour à la ligne et tabulation. */
    public static final String MULTILINE_TEXT_REGEX = "^[^\\p{Cntrl}&&[^\\r\\n\\t]]*$";
    public static final String CONTROL_CHAR_MESSAGE = "Le texte contient des caractères non autorisés.";

    /** SIRET (14 chiffres) ou SIREN (9 chiffres), espaces tolérés. Vide accepté. */
    public static final String SIRET_REGEX = "^$|^(?:\\d ?){9}(?:(?:\\d ?){5})?$";
    public static final String SIRET_MESSAGE = "Le SIRET compte 14 chiffres (ou 9 pour un SIREN).";
    /** Chiffres, espaces, +, points, tirets et parenthèses, 30 caractères au plus. */
    public static final String PHONE_REGEX = "^[0-9+().\\- ]{0,30}$";
    public static final String PHONE_MESSAGE = "Le téléphone accepte des chiffres, des espaces et + . - ( ).";
    /** IBAN : lettres et chiffres, espaces tolérés, 42 caractères au plus. */
    public static final String IBAN_REGEX = "^$|^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9 ]{10,38}$";
    public static final String IBAN_MESSAGE = "L'IBAN commence par 2 lettres et 2 chiffres (ex. FR76 ...).";
    public static final int MAX_EMAIL = 120;

    public static final int MAX_PAYMENT_TERMS_DAYS = 365;
    public static final int MAX_LINES = 100;
    public static final int MAX_NAME = 120;
    public static final int MAX_ADDRESS_LINES = 5;
    public static final int MAX_ADDRESS_LINE = 120;
    public static final int MAX_DESCRIPTION = 500;
    public static final int MAX_UNIT = 20;
    public static final int MAX_NOTES = 1000;
    public static final String MAX_QUANTITY = "1000000";
    public static final String MAX_UNIT_PRICE = "100000000";

    private Limits() {
    }
}
