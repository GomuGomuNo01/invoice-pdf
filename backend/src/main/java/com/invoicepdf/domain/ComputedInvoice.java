package com.invoicepdf.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Facture prête à rendre : toutes les valeurs calculées viennent du serveur.
 */
public record ComputedInvoice(
        String invoiceNumber,
        LocalDate invoiceDate,
        int paymentTermsDays,
        LocalDate dueDate,
        String clientName,
        List<String> clientAddressLines,
        List<ComputedLine> lines,
        BigDecimal totalExclTax,
        BigDecimal totalDue,
        String notes) {

    public ComputedInvoice {
        clientAddressLines = List.copyOf(clientAddressLines);
        lines = List.copyOf(lines);
    }

    public record ComputedLine(String description, BigDecimal quantity, String unit, BigDecimal unitPrice, BigDecimal amount) {
    }
}
