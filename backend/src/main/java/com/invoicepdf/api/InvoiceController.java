package com.invoicepdf.api;

import java.util.UUID;

import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.invoicepdf.config.IssuerProperties;
import com.invoicepdf.domain.ComputedInvoice;
import com.invoicepdf.domain.InvoiceCalculator;
import com.invoicepdf.domain.IssuerInfo;
import com.invoicepdf.pdf.InvoicePdfRenderer;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;

@RestController
@RequestMapping("/api/v1/invoices")
public class InvoiceController {

    private static final Logger LOG = LoggerFactory.getLogger(InvoiceController.class);

    private final InvoiceCalculator calculator;
    private final InvoicePdfRenderer renderer;
    private final IssuerProperties defaultIssuer;

    public InvoiceController(InvoiceCalculator calculator, InvoicePdfRenderer renderer, IssuerProperties defaultIssuer) {
        this.calculator = calculator;
        this.renderer = renderer;
        this.defaultIssuer = defaultIssuer;
    }

    @Operation(summary = "Génère le PDF d'une facture",
            description = "Les montants, le total et la date d'échéance sont calculés par le serveur. Aucune donnée n'est conservée.")
    @ApiResponse(responseCode = "200", description = "PDF de la facture",
            content = @Content(mediaType = MediaType.APPLICATION_PDF_VALUE))
    @ApiResponse(responseCode = "400", description = "Requête invalide",
            content = @Content(mediaType = MediaType.APPLICATION_PROBLEM_JSON_VALUE))
    @ApiResponse(responseCode = "413", description = "Requête trop volumineuse")
    @ApiResponse(responseCode = "429", description = "Trop de requêtes")
    @PostMapping(path = "/pdf", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = {MediaType.APPLICATION_PDF_VALUE, MediaType.APPLICATION_PROBLEM_JSON_VALUE})
    public ResponseEntity<byte[]> generatePdf(@Valid @RequestBody InvoiceRequest request) {
        long start = System.nanoTime();
        ComputedInvoice invoice = calculator.compute(request);
        IssuerInfo issuer = request.issuer() != null ? IssuerInfo.from(request.issuer()) : IssuerInfo.from(defaultIssuer);
        byte[] pdf = renderer.renderPdf(invoice, issuer);

        // Journal technique uniquement : aucune donnée de la facture (données personnelles).
        LOG.info("pdf_generated id={} lines={} bytes={} durationMs={}",
                UUID.randomUUID(), invoice.lines().size(), pdf.length, (System.nanoTime() - start) / 1_000_000);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(fileName(invoice.invoiceNumber()))
                        .build().toString())
                .cacheControl(CacheControl.noStore())
                .body(pdf);
    }

    /** Facture-558-00178.pdf ; les caractères hors [A-Za-z0-9-_.] sont remplacés par "-". */
    static String fileName(String invoiceNumber) {
        return "Facture-" + invoiceNumber.replaceAll("[^A-Za-z0-9_.-]", "-") + ".pdf";
    }
}
