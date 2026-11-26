package com.invoicepdf.pdf;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

import com.invoicepdf.domain.InvoiceCalculator;

/**
 * Formats français du PDF. L'espace des milliers est l'espace insécable U+00A0
 * (présente dans toutes les polices, contrairement à l'espace fine U+202F du CLDR).
 * Les instances DecimalFormat ne sont pas thread-safe : elles sont créées à chaque appel.
 */
public final class FrenchFormats {

    public static final char NBSP = ' ';
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRANCE);

    /** 1250.5 donne "1 250,50 €" (espaces insécables). */
    public String money(BigDecimal value) {
        return decimalFormat("#,##0.00").format(value.setScale(InvoiceCalculator.SCALE, InvoiceCalculator.ROUNDING)) + NBSP + "€";
    }

    /** Montant sans symbole, pour les colonnes chiffrées. */
    public String amount(BigDecimal value) {
        return decimalFormat("#,##0.00").format(value.setScale(InvoiceCalculator.SCALE, InvoiceCalculator.ROUNDING));
    }

    /** 2 donne "2", 1.5 donne "1,5", 0.125 donne "0,125". */
    public String quantity(BigDecimal value) {
        return decimalFormat("#,##0.###").format(value);
    }

    /** jj/mm/aaaa. */
    public String date(LocalDate value) {
        return DATE.format(value);
    }

    private static DecimalFormat decimalFormat(String pattern) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.FRANCE);
        symbols.setGroupingSeparator(NBSP);
        symbols.setDecimalSeparator(',');
        DecimalFormat format = new DecimalFormat(pattern, symbols);
        format.setParseBigDecimal(true);
        return format;
    }
}
