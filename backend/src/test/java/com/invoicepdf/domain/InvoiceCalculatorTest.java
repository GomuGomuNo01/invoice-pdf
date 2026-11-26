package com.invoicepdf.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.invoicepdf.api.InvoiceRequest;

class InvoiceCalculatorTest {

    private final InvoiceCalculator calculator = new InvoiceCalculator();

    private static InvoiceRequest.Line line(String qty, String price) {
        return new InvoiceRequest.Line("Prestation", new BigDecimal(qty), "heure", new BigDecimal(price));
    }

    private static InvoiceRequest request(List<InvoiceRequest.Line> lines, String date, int terms) {
        return new InvoiceRequest("558-00178", LocalDate.parse(date), terms,
                new InvoiceRequest.Client("  Client SAS  ", List.of(" 1 rue A ", "", "75001 Paris")), lines, "   ");
    }

    @Test
    void montantDeLigneEgalQuantiteFoisPrix() {
        ComputedInvoice invoice = calculator.compute(request(List.of(line("3", "250.00")), "2026-11-26", 14));
        assertEquals(new BigDecimal("750.00"), invoice.lines().getFirst().amount());
    }

    @Test
    void arrondiHalfUpADeuxDecimales() {
        // 1,5 x 0,15 = 0,225 -> 0,23 en HALF_UP (et non 0,22 en arrondi bancaire)
        assertEquals(new BigDecimal("0.23"), InvoiceCalculator.computeLine(line("1.5", "0.15")).amount());
        // 0,333 x 10,01 = 3,33333 -> 3,33
        assertEquals(new BigDecimal("3.33"), InvoiceCalculator.computeLine(line("0.333", "10.01")).amount());
    }

    @Test
    void totalEstLaSommeDesMontantsArrondis() {
        // Chaque ligne : 1,5 x 0,15 = 0,225 -> 0,23 ; total 3 x 0,23 = 0,69 (et non arrondi(0,675) = 0,68)
        ComputedInvoice invoice = calculator.compute(request(
                List.of(line("1.5", "0.15"), line("1.5", "0.15"), line("1.5", "0.15")), "2026-11-26", 0));
        assertEquals(new BigDecimal("0.69"), invoice.totalExclTax());
        assertEquals(invoice.totalExclTax(), invoice.totalDue());
    }

    @Test
    void totalSansFlottantSurGrandsMontants() {
        ComputedInvoice invoice = calculator.compute(request(
                List.of(line("1000000", "99999999.99"), line("0.1", "0.20")), "2026-11-26", 30));
        assertEquals(new BigDecimal("99999999990000.02"), invoice.totalExclTax());
    }

    @Test
    void echeanceEgaleDatePlusConditions() {
        assertEquals(LocalDate.parse("2026-12-10"),
                calculator.compute(request(List.of(line("1", "1")), "2026-11-26", 14)).dueDate());
        assertEquals(LocalDate.parse("2027-01-05"),
                calculator.compute(request(List.of(line("1", "1")), "2026-12-31", 5)).dueDate());
        assertEquals(LocalDate.parse("2028-02-29"),
                calculator.compute(request(List.of(line("1", "1")), "2028-02-28", 1)).dueDate());
        assertEquals(LocalDate.parse("2026-11-26"),
                calculator.compute(request(List.of(line("1", "1")), "2026-11-26", 0)).dueDate());
    }

    @Test
    void nettoieLesTextes() {
        ComputedInvoice invoice = calculator.compute(request(List.of(line("1", "1")), "2026-11-26", 14));
        assertEquals("Client SAS", invoice.clientName());
        assertEquals(List.of("1 rue A", "75001 Paris"), invoice.clientAddressLines());
        assertNull(invoice.notes());
    }

    @Test
    void uniteVideDevientNulle() {
        var computed = InvoiceCalculator.computeLine(new InvoiceRequest.Line("x", BigDecimal.ONE, "  ", BigDecimal.TEN));
        assertNull(computed.unit());
        assertEquals(new BigDecimal("10.00"), computed.unitPrice());
    }
}
