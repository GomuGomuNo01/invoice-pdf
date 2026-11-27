package com.invoicepdf.api;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.invoicepdf.config.SiteProperties;

import io.swagger.v3.oas.annotations.Operation;

/** Informations légales du site (mentions légales). Les champs non configurés valent null. */
@RestController
@RequestMapping("/api/v1/site")
public class SiteController {

    private final SiteProperties site;

    public SiteController(SiteProperties site) {
        this.site = site;
    }

    @Operation(summary = "Informations légales du site")
    @GetMapping
    public ResponseEntity<SiteProperties> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(site);
    }
}
