package com.invoicepdf.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;

import com.sun.net.httpserver.HttpServer;

class KeepAwakeTest {

    @Test
    void appelleLAdresseDeSante() throws IOException {
        HttpServer serveur = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicInteger appels = new AtomicInteger();
        AtomicReference<String> chemin = new AtomicReference<>();
        AtomicReference<String> agent = new AtomicReference<>();
        serveur.createContext("/", echange -> {
            appels.incrementAndGet();
            chemin.set(echange.getRequestURI().getPath());
            agent.set(echange.getRequestHeaders().getFirst("User-Agent"));
            echange.sendResponseHeaders(200, -1);
            echange.close();
        });
        serveur.start();
        try {
            KeepAwake keepAwake = new KeepAwake("http://127.0.0.1:" + serveur.getAddress().getPort() + "/actuator/health");
            keepAwake.ping();
            keepAwake.ping();
            assertThat(appels.get()).isEqualTo(2);
            assertThat(chemin.get()).isEqualTo("/actuator/health");
            assertThat(agent.get()).isEqualTo("invoice-pdf-keep-awake");
        } finally {
            serveur.stop(0);
        }
    }

    @Test
    void uneAdresseInjoignableNeFaitPasEchouerLApplication() {
        // Port fermé : l'erreur est journalisée, jamais propagée.
        new KeepAwake("http://127.0.0.1:9/actuator/health").ping();
    }

    @Nested
    @SpringBootTest
    class SansAdresse {

        @Autowired
        ApplicationContext context;

        @Test
        void inactifParDefaut() {
            assertThat(context.getBeanNamesForType(KeepAwake.class)).isEmpty();
        }
    }

    @Nested
    @SpringBootTest(properties = "INVOICE_KEEP_AWAKE_URL=http://127.0.0.1:9/actuator/health")
    class AvecAdresse {

        @Autowired
        ApplicationContext context;

        @Autowired
        ScheduledTaskHolder planificateur;

        @Test
        void actifQuandLAdresseEstConfiguree() {
            assertThat(context.getBeanNamesForType(KeepAwake.class)).hasSize(1);
        }

        @Test
        void lAppelEstPlanifieToutesLesDixMinutes() {
            // Sans @EnableScheduling, la méthode existerait mais ne serait jamais déclenchée.
            assertThat(planificateur.getScheduledTasks())
                    .anySatisfy(tache -> {
                        assertThat(tache.getTask()).isInstanceOf(FixedDelayTask.class);
                        assertThat(tache.getTask().toString()).contains("KeepAwake.ping");
                        assertThat(((FixedDelayTask) tache.getTask()).getIntervalDuration()).isEqualTo(Duration.ofMinutes(10));
                    });
        }
    }
}
