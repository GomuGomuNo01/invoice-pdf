package com.invoicepdf.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.invoicepdf.config.ApiProperties;

class RateLimitFilterTest {

    private static MockHttpServletResponse call(RateLimitFilter filter, String ip) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/invoices/pdf");
        request.setRemoteAddr(ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private static MockHttpServletResponse callVia(RateLimitFilter filter, String proxy, String header, String value)
            throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/invoices/pdf");
        request.setRemoteAddr(proxy);
        if (value != null) {
            request.addHeader(header, value);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void enTeteDeLaPlateformeConfigureDistingueLesClients() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-11-26T10:00:10Z"), ZoneOffset.UTC);
        RateLimitFilter filter = new RateLimitFilter(new ApiProperties(List.of(), 1024, 1, "CF-Connecting-IP"), clock);

        // Même proxy, deux clients différents selon l'en-tête de la plateforme.
        assertEquals(200, callVia(filter, "10.0.0.5", "CF-Connecting-IP", "203.0.113.10").getStatus());
        assertEquals(429, callVia(filter, "10.0.0.5", "CF-Connecting-IP", "203.0.113.10").getStatus());
        assertEquals(200, callVia(filter, "10.0.0.5", "CF-Connecting-IP", "198.51.100.20").getStatus());
        // Liste éventuelle : seule la première adresse compte.
        assertEquals(429, callVia(filter, "10.0.0.5", "CF-Connecting-IP", "198.51.100.20, 10.0.0.9").getStatus());
        // En-tête absent : l'adresse de connexion est utilisée.
        assertEquals(200, callVia(filter, "10.0.0.6", "CF-Connecting-IP", null).getStatus());
    }

    @Test
    void enTeteNonConfigureIgnore() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-11-26T10:00:10Z"), ZoneOffset.UTC);
        RateLimitFilter filter = new RateLimitFilter(new ApiProperties(List.of(), 1024, 1, null), clock);
        assertEquals(200, callVia(filter, "10.0.0.5", "CF-Connecting-IP", "203.0.113.10").getStatus());
        // Sans réglage, un client ne peut pas changer d'adresse par cet en-tête.
        assertEquals(429, callVia(filter, "10.0.0.5", "CF-Connecting-IP", "198.51.100.20").getStatus());
    }

    @Test
    void bloqueAuDelaDeLaLimiteParIp() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-11-26T10:00:10Z"), ZoneOffset.UTC);
        RateLimitFilter filter = new RateLimitFilter(new ApiProperties(List.of(), 1024, 2, null), clock);

        assertEquals(200, call(filter, "10.0.0.1").getStatus());
        assertEquals(200, call(filter, "10.0.0.1").getStatus());
        MockHttpServletResponse blocked = call(filter, "10.0.0.1");
        assertEquals(429, blocked.getStatus());
        assertNotNull(blocked.getHeader("Retry-After"));
        // Une autre IP n'est pas affectée
        assertEquals(200, call(filter, "10.0.0.2").getStatus());
    }

    @Test
    void nouvelleFenetreApresUneMinute() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-11-26T10:00:10Z"));
        RateLimitFilter filter = new RateLimitFilter(new ApiProperties(List.of(), 1024, 1, null), clock);

        assertEquals(200, call(filter, "10.0.0.1").getStatus());
        assertEquals(429, call(filter, "10.0.0.1").getStatus());
        clock.instant = Instant.parse("2026-11-26T10:01:00Z");
        assertEquals(200, call(filter, "10.0.0.1").getStatus());
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
