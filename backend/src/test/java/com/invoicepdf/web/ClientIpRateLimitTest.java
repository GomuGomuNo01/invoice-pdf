package com.invoicepdf.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * Limitation de débit derrière un proxy, testée sur un vrai serveur Tomcat
 * (MockMvc ne passe pas par la valve RemoteIp qui lit X-Forwarded-For).
 */
class ClientIpRateLimitTest {

    private static final HttpClient HTTP = HttpClient.newHttpClient();

    /**
     * La limite est comptée par minute d'horloge : chaque rafale doit tenir dans une seule minute.
     * Si la minute courante se termine bientôt, on attend le début de la suivante.
     */
    static void attendreDebutDeMinute() throws InterruptedException {
        long millisDansLaMinute = System.currentTimeMillis() % 60_000;
        if (millisDansLaMinute > 45_000) {
            Thread.sleep(60_000 - millisDansLaMinute + 200);
        }
    }

    /** Requête invalide (refusée en 400 après le filtre) : rapide, mais comptée par la limitation. */
    static int post(int port, String forwardedFor) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1/invoices/pdf"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}"));
        if (forwardedFor != null) {
            builder.header("X-Forwarded-For", forwardedFor);
        }
        return HTTP.send(builder.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
    }

    @Nested
    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
            properties = "invoice.api.rate-limit-per-minute=2")
    class DepuisUnProxyDeConfiance {

        @LocalServerPort
        int port;

        @Test
        void chaqueClientAUneLimiteDistincte() throws Exception {
            attendreDebutDeMinute();
            // 127.0.0.1 est un proxy interne : l'adresse transmise est celle du client.
            assertThat(post(port, "203.0.113.10")).isEqualTo(400);
            assertThat(post(port, "203.0.113.10")).isEqualTo(400);
            assertThat(post(port, "203.0.113.10")).isEqualTo(429);
            // Un autre client n'est pas bloqué par le premier.
            assertThat(post(port, "198.51.100.20")).isEqualTo(400);
        }
    }

    @Nested
    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
            properties = {
                    "invoice.api.rate-limit-per-minute=2",
                    // Aucun proxy de confiance : 127.0.0.1 devient une source externe.
                    "server.tomcat.remoteip.internal-proxies=10\\.255\\.255\\.254"
            })
    class DepuisUneSourceNonFiable {

        @LocalServerPort
        int port;

        @Test
        void lEnTeteEstIgnoreEtNePermetPasDeContournerLaLimite() throws Exception {
            attendreDebutDeMinute();
            assertThat(post(port, "203.0.113.10")).isEqualTo(400);
            assertThat(post(port, "198.51.100.20")).isEqualTo(400);
            // Changer d'adresse annoncée ne réinitialise pas la limite : c'est la vraie source qui compte.
            assertThat(post(port, "192.0.2.30")).isEqualTo(429);
        }
    }
}
