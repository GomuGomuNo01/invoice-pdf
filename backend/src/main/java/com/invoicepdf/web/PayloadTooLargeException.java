package com.invoicepdf.web;

import java.io.IOException;
import java.io.Serial;

/** Levée quand le corps de la requête dépasse la taille autorisée. */
public class PayloadTooLargeException extends IOException {

    @Serial
    private static final long serialVersionUID = 1L;

    public PayloadTooLargeException() {
        super("Payload too large");
    }
}
