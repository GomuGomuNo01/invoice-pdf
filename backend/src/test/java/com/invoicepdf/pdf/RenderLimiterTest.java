package com.invoicepdf.pdf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

class RenderLimiterTest {

    @Test
    void refuseAuDelaDuNombreDeRendusSimultanes() throws Exception {
        RenderLimiter limiter = new RenderLimiter(1, Duration.ofMillis(100));
        CountDownLatch enCours = new CountDownLatch(1);
        CountDownLatch liberer = new CountDownLatch(1);
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<String> premier = executor.submit(() -> limiter.run(() -> {
                enCours.countDown();
                await(liberer);
                return "premier";
            }));
            assertThat(enCours.await(5, TimeUnit.SECONDS)).isTrue();

            // La seule place est occupée : la demande attend 100 ms puis est refusée.
            assertThatThrownBy(() -> limiter.run(() -> "second")).isInstanceOf(RenderLimiter.ServerBusyException.class);

            liberer.countDown();
            assertThat(premier.get(5, TimeUnit.SECONDS)).isEqualTo("premier");
            // La place est rendue : une nouvelle demande passe.
            assertThat(limiter.run(() -> "troisieme")).isEqualTo("troisieme");
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void rendLaPlaceMemeSiLeRenduEchoue() {
        RenderLimiter limiter = new RenderLimiter(1, Duration.ofMillis(50));
        assertThatThrownBy(() -> limiter.run(() -> {
            throw new IllegalStateException("rendu impossible");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(limiter.run(() -> "ensuite")).isEqualTo("ensuite");
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
