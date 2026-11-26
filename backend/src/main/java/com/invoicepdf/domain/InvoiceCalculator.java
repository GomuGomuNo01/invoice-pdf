package com.invoicepdf.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

import org.springframework.stereotype.Component;

import com.invoicepdf.api.InvoiceRequest;

/**
 * Calculs de la facture. BigDecimal uniquement, arrondi à 2 décimales en HALF_UP.
 * Le montant de chaque ligne est arrondi, puis le total est la somme des montants arrondis
 * (ce que le lecteur peut vérifier sur le PDF).
 * TVA non applicable en V1 : total à payer = total HT.
 */
@Component
public class InvoiceCalculator {

    public static final int SCALE = 2;
    public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

    public ComputedInvoice compute(InvoiceRequest request) {
        List<ComputedInvoice.ComputedLine> lines = request.lines().stream()
                .map(InvoiceCalculator::computeLine)
                .toList();

        BigDecimal totalExclTax = lines.stream()
                .map(ComputedInvoice.ComputedLine::amount)
                .reduce(BigDecimal.ZERO.setScale(SCALE), BigDecimal::add);

        List<String> addressLines = request.client().addressLines() == null ? List.of()
                : request.client().addressLines().stream().map(String::strip).filter(s -> !s.isEmpty()).toList();

        return new ComputedInvoice(
                request.invoiceNumber().strip(),
                request.invoiceDate(),
                request.paymentTermsDays(),
                request.invoiceDate().plusDays(request.paymentTermsDays()),
                request.client().name().strip(),
                addressLines,
                lines,
                totalExclTax,
                totalExclTax,
                blankToNull(request.notes()));
    }

    static ComputedInvoice.ComputedLine computeLine(InvoiceRequest.Line line) {
        BigDecimal amount = line.quantity().multiply(line.unitPrice()).setScale(SCALE, ROUNDING);
        return new ComputedInvoice.ComputedLine(
                line.description().strip(),
                line.quantity(),
                blankToNull(line.unit()),
                line.unitPrice().setScale(SCALE, ROUNDING),
                amount);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
