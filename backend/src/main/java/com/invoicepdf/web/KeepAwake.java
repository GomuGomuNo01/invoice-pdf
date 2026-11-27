package com.invoicepdf.web;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Anti-veille : l'offre gratuite de Render endort le service après 15 minutes sans visite.
 * Tant que l'application tourne, elle appelle sa propre adresse publique (santé) à intervalle régulier ;
 * l'appel passe par le proxy de l'hébergeur et compte donc comme une visite.
 * Si le service s'est malgré tout endormi, la surveillance programmée sur GitHub le réveille.
 * Inactif tant que invoice.keep-awake.url est vide (développement, tests, auto-hébergement).
 */
@Component
@ConditionalOnExpression("!'${invoice.keep-awake.url:}'.isBlank()")
public class KeepAwake {

    private static final Logger LOG = LoggerFactory.getLogger(KeepAwake.class);

    private final URI url;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public KeepAwake(@Value("${invoice.keep-awake.url}") String url) {
        this.url = URI.create(url.strip());
        LOG.info("keep_awake_enabled url={}", this.url);
    }

    @Scheduled(initialDelayString = "${invoice.keep-awake.initial-delay:PT2M}",
            fixedDelayString = "${invoice.keep-awake.interval:PT10M}")
    public void ping() {
        try {
            HttpRequest request = HttpRequest.newBuilder(url)
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", "invoice-pdf-keep-awake")
                    .GET()
                    .build();
            int status = client.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status == 200) {
                LOG.debug("keep_awake_ok");
            } else {
                LOG.warn("keep_awake_status status={}", status);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            LOG.warn("keep_awake_failed type={}", e.getClass().getSimpleName());
        }
    }
}
