package com.invoicepdf.api;

import java.util.List;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.invoicepdf.config.IssuerProperties;

import io.swagger.v3.oas.annotations.Operation;

/**
 * Identité de l'émetteur telle qu'imprimée sur le PDF, pour un aperçu fidèle côté frontend.
 * Ces informations figurent de toute façon sur chaque facture émise.
 */
@RestController
@RequestMapping("/api/v1/issuer")
public class IssuerController {

    private final IssuerProperties issuer;

    public IssuerController(IssuerProperties issuer) {
        this.issuer = issuer;
    }

    public record IssuerResponse(String name, List<String> addressLines, String siret, String email, String phone, String iban) {
    }

    @Operation(summary = "Identité de l'émetteur (aperçu)")
    @GetMapping
    public ResponseEntity<IssuerResponse> get() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .body(new IssuerResponse(issuer.name(), issuer.addressLines(), issuer.siret(), issuer.email(),
                        issuer.phone(), issuer.iban()));
    }
}
