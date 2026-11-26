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

    @Test
    void bloqueAuDelaDeLaLimiteParIp() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-11-26T10:00:10Z"), ZoneOffset.UTC);
        RateLimitFilter filter = new RateLimitFilter(new ApiProperties(List.of(), 1024, 2), clock);

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
        RateLimitFilter filter = new RateLimitFilter(new ApiProperties(List.of(), 1024, 1), clock);

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
