package com.invoicepdf.pdf;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Locale;

import org.jsoup.Jsoup;
import org.jsoup.helper.W3CDom;
import org.springframework.stereotype.Service;
import org.thymeleaf.ITemplateEngine;
import org.thymeleaf.context.Context;

import com.invoicepdf.domain.ComputedInvoice;
import com.invoicepdf.domain.IssuerInfo;
import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.outputdevice.helper.ExternalResourceControlPriority;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;

/**
 * Rendu PDF : gabarit Thymeleaf (échappement automatique des données saisies) converti par OpenHTMLToPDF.
 * Polices embarquées depuis le classpath, aucune ressource externe autorisée pendant le rendu.
 */
@Service
public class InvoicePdfRenderer {

    static final String FONT_FAMILY = "Carlito";
    private static final String TEMPLATE = "invoice";

    private final ITemplateEngine templateEngine;
    private final FrenchFormats formats = new FrenchFormats();

    public InvoicePdfRenderer(ITemplateEngine templateEngine) {
        this.templateEngine = templateEngine;
    }

    /** HTML intermédiaire (utile aux tests et au débogage du gabarit). */
    public String renderHtml(ComputedInvoice invoice, IssuerInfo issuer) {
        Context context = new Context(Locale.FRANCE);
        context.setVariable("invoice", invoice);
        context.setVariable("issuer", issuer);
        context.setVariable("fmt", formats);
        return templateEngine.process(TEMPLATE, context);
    }

    public byte[] renderPdf(ComputedInvoice invoice, IssuerInfo issuer) {
        String html = renderHtml(invoice, issuer);
        org.w3c.dom.Document document = new W3CDom().fromJsoup(Jsoup.parse(html));

        try (ByteArrayOutputStream out = new ByteArrayOutputStream(64 * 1024)) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withProducer("invoice-pdf");
            registerFont(builder, "Carlito-Regular.ttf", 400, FontStyle.NORMAL);
            registerFont(builder, "Carlito-Bold.ttf", 700, FontStyle.NORMAL);
            registerFont(builder, "Carlito-Italic.ttf", 400, FontStyle.ITALIC);
            registerFont(builder, "Carlito-BoldItalic.ttf", 700, FontStyle.ITALIC);
            builder.useExternalResourceAccessControl((uri, type) -> false, ExternalResourceControlPriority.RUN_BEFORE_RESOLVING_URI);
            builder.useExternalResourceAccessControl((uri, type) -> false, ExternalResourceControlPriority.RUN_AFTER_RESOLVING_URI);
            builder.withW3cDocument(document, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Échec du rendu PDF", e);
        }
    }

    private static void registerFont(PdfRendererBuilder builder, String file, int weight, FontStyle style) {
        builder.useFont(() -> openFont(file), FONT_FAMILY, weight, style, true);
    }

    private static InputStream openFont(String file) {
        InputStream stream = InvoicePdfRenderer.class.getResourceAsStream("/fonts/" + file);
        if (stream == null) {
            throw new IllegalStateException("Police introuvable : " + file);
        }
        return stream;
    }
}
