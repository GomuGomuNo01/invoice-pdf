package com.invoicepdf.pdf;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class FrenchFormatsTest {

    private static final String NBSP = " ";
    private final FrenchFormats fmt = new FrenchFormats();

    @Test
    void formatMonetaireFrancais() {
        assertEquals("1" + NBSP + "250,00" + NBSP + "€", fmt.money(new BigDecimal("1250")));
        assertEquals("0,00" + NBSP + "€", fmt.money(BigDecimal.ZERO));
        assertEquals("12" + NBSP + "345" + NBSP + "678,90" + NBSP + "€", fmt.money(new BigDecimal("12345678.9")));
        assertEquals("0,23" + NBSP + "€", fmt.money(new BigDecimal("0.225")));
    }

    @Test
    void formatQuantite() {
        assertEquals("2", fmt.quantity(new BigDecimal("2.000")));
        assertEquals("1,5", fmt.quantity(new BigDecimal("1.5")));
        assertEquals("0,125", fmt.quantity(new BigDecimal("0.125")));
        assertEquals("1" + NBSP + "000", fmt.quantity(new BigDecimal("1000")));
    }

    @Test
    void formatDate() {
        assertEquals("26/11/2026", fmt.date(LocalDate.of(2026, 11, 26)));
        assertEquals("05/01/2027", fmt.date(LocalDate.of(2027, 1, 5)));
    }
}
