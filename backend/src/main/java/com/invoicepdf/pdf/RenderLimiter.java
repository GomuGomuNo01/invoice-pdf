package com.invoicepdf.pdf;

import java.time.Duration;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Limite le nombre de rendus PDF simultanés pour protéger la mémoire du serveur.
 * La limitation de débit par adresse ne suffit pas : de nombreuses adresses, chacune sous sa limite,
 * peuvent lancer beaucoup de rendus en même temps. Au-delà de la limite, la demande attend un peu,
 * puis est refusée (le client reçoit 503 et peut réessayer).
 */
@Component
public class RenderLimiter {

    private final Semaphore permits;
    private final Duration maxWait;

    public RenderLimiter(
            @Value("${invoice.api.max-concurrent-renders:4}") int maxConcurrent,
            @Value("${invoice.api.render-queue-wait:10s}") Duration maxWait) {
        this.permits = new Semaphore(Math.max(1, maxConcurrent), true);
        this.maxWait = maxWait;
    }

    public <T> T run(Supplier<T> render) {
        boolean acquired;
        try {
            acquired = permits.tryAcquire(maxWait.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServerBusyException();
        }
        if (!acquired) {
            throw new ServerBusyException();
        }
        try {
            return render.get();
        } finally {
            permits.release();
        }
    }

    /** Trop de rendus en cours : réponse 503, le client peut réessayer. */
    public static class ServerBusyException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public ServerBusyException() {
            super("Trop de rendus PDF en cours");
        }
    }
}
