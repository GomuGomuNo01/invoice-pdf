package com.invoicepdf.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "invoice.api.rate-limit-per-minute=10000",
        "invoice.issuer.name=Atelier Exemple",
        "invoice.issuer.address-line1=12 rue des Tests",
        "invoice.issuer.postal-code=75011",
        "invoice.issuer.city=Paris",
        "invoice.issuer.siret=123 456 789 00012",
        "invoice.issuer.iban="
})
@AutoConfigureMockMvc
class InvoiceApiTest {

    static final String VALID = """
            {
              "invoiceNumber": "558-00178",
              "invoiceDate": "2026-11-26",
              "paymentTermsDays": 14,
              "client": { "name": "Société Cliente Éàç", "addressLines": ["5 avenue du Client", "69001 Lyon"] },
              "lines": [
                { "description": "Développement d'une fonctionnalité", "quantity": 5, "unit": "jour", "unitPrice": 250.00 },
                { "description": "Frais de déplacement", "quantity": 1, "unit": null, "unitPrice": 0.5 }
              ],
              "notes": "Paiement par virement."
            }
            """;

    @Autowired
    MockMvc mvc;

    private byte[] generate(String body) throws Exception {
        return mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn().getResponse().getContentAsByteArray();
    }

    private static String text(PDDocument document) throws Exception {
        return new PDFTextStripper().getText(document).replace(' ', ' ').replace(' ', ' ');
    }

    private static String pageText(PDDocument document, int page) throws Exception {
        PDFTextStripper stripper = new PDFTextStripper();
        stripper.setStartPage(page);
        stripper.setEndPage(page);
        return stripper.getText(document);
    }

    @Test
    void genereUnPdfAvecLesValeursCalculeesParLeServeur() throws Exception {
        byte[] pdf = mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content(VALID))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"Facture-558-00178.pdf\""))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn().getResponse().getContentAsByteArray();

        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
            String text = text(document);
            assertThat(text).contains("Atelier Exemple", "12 rue des Tests", "75011 Paris", "SIRET : 123 456 789 00012");
            assertThat(text).contains("Société Cliente Éàç", "5 avenue du Client", "69001 Lyon");
            assertThat(text).contains("FACTURE", "Date de facture", "26/11/2026", "558-00178", "14 jours");
            assertThat(text).contains("Date d'échéance", "10/12/2026");
            assertThat(text).contains("DESCRIPTION", "QUANTITÉ", "UNITÉ", "PRIX", "MONTANT");
            assertThat(text).contains("1 250,00 €", "0,50 €", "TOTAL HT", "1 250,50 €");
            assertThat(text).contains("Total à payer");
            assertThat(text).contains("Conditions de paiement et mentions particulières :", "Paiement par virement.");
            assertThat(text).contains("TVA non applicable, article 293B du code général des impôts");
            assertThat(text).contains("Page 1 sur 1");
            assertThat(text).doesNotContain("IBAN");
            // Polices embarquées
            assertThat(document.getPage(0).getResources().getFontNames()).isNotEmpty();
        }
    }

    @Test
    void centLignesSurPlusieursPagesAvecPaginationEtEnTeteRepete() throws Exception {
        String lines = IntStream.rangeClosed(1, 100)
                .mapToObj(i -> "{ \"description\": \"Ligne numéro " + i + " avec une description assez longue pour occuper de la place\", \"quantity\": 1.5, \"unit\": \"heure\", \"unitPrice\": 10.01 }")
                .collect(Collectors.joining(","));
        String body = VALID.replaceFirst("(?s)\"lines\": \\[.*?\\],", "\"lines\": [" + lines + "],");

        byte[] pdf = generate(body);
        writeSample("Facture-100-lignes.pdf", pdf);
        try (PDDocument document = Loader.loadPDF(pdf)) {
            int pages = document.getNumberOfPages();
            assertThat(pages).isGreaterThan(1);
            String text = text(document);
            assertThat(text).contains("Page 1 sur " + pages, "Page " + pages + " sur " + pages);
            // 1,5 x 10,01 = 15,015 -> 15,02 ; 100 x 15,02 = 1 502,00
            assertThat(text).contains("15,02 €", "1 502,00 €");
            int pageWithTotal = 0;
            for (int page = 1; page <= pages; page++) {
                String pageText = pageText(document, page);
                // En-tête du tableau répété sur chaque page qui contient des lignes
                if (pageText.contains("Ligne numéro")) {
                    assertThat(pageText).as("en-tête page %d", page).contains("DESCRIPTION", "MONTANT");
                }
                if (pageText.contains("TOTAL HT")) {
                    pageWithTotal = page;
                }
            }
            // Total une seule fois, après la dernière ligne du tableau
            assertThat(text.split("TOTAL HT", -1).length - 1).isEqualTo(1);
            assertThat(pageText(document, pageWithTotal)).contains("Ligne numéro 100");
            assertThat(pageText(document, pages)).contains("TVA non applicable");
        }
    }

    @Test
    void leContenuSaisiEstEchappeEtAucuneRessourceExterneNestChargee() throws Exception {
        String body = VALID.replace("Paiement par virement.",
                "<img src='http://example.invalid/x.png'/><script>alert(1)</script> & <b>gras</b>");
        try (PDDocument document = Loader.loadPDF(generate(body))) {
            assertThat(text(document)).contains("<img src='http://example.invalid/x.png'/><script>alert(1)</script> & <b>gras</b>");
        }
    }

    static final String ISSUER = """
            "issuer": {
              "name": "Atelier Saisi Éàç",
              "addressLines": ["8 avenue des Saisies", "33000 Bordeaux"],
              "siret": "362 521 879 00034",
              "email": "contact@atelier.example",
              "phone": "+33 6 12 34 56 78",
              "iban": "FR76 3000 6000 0112 3456 7890 189"
            },
            "notes":""";

    @Test
    void lEmetteurSaisiRemplaceCeluiDeLaConfiguration() throws Exception {
        byte[] pdf = generate(VALID.replace("\"notes\":", ISSUER));
        writeSample("Facture-emetteur-saisi.pdf", pdf);
        try (PDDocument document = Loader.loadPDF(pdf)) {
            String text = text(document);
            assertThat(text).contains("Atelier Saisi Éàç", "8 avenue des Saisies", "33000 Bordeaux",
                    "SIRET : 362 521 879 00034", "contact@atelier.example - +33 6 12 34 56 78",
                    "IBAN : FR76 3000 6000 0112 3456 7890 189");
            assertThat(text).doesNotContain("Atelier Exemple");
        }
    }

    @Test
    void refuseUnEmetteurInvalide() throws Exception {
        String body = VALID.replace("\"notes\":", ISSUER)
                .replace("contact@atelier.example", "pas-un-email")
                .replace("FR76 3000 6000 0112 3456 7890 189", "1234")
                .replace("\"name\": \"Atelier Saisi Éàç\"", "\"name\": \"\"");
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'issuer.email')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'issuer.iban')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'issuer.name')]").exists());
    }

    @Test
    void echantillonDeReference() throws Exception {
        writeSample("Facture-558-00178.pdf", generate(VALID));
    }

    @Test
    void refuseUneRequeteInvalideAvecLeDetailDesErreurs() throws Exception {
        String body = """
                {
                  "invoiceNumber": "",
                  "invoiceDate": "2026-11-26",
                  "paymentTermsDays": 400,
                  "client": { "name": "", "addressLines": [] },
                  "lines": [ { "description": "x", "quantity": 0, "unit": null, "unitPrice": -1 } ],
                  "notes": null
                }
                """;
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Content-Type", "application/problem+json"))
                .andExpect(jsonPath("$.title").value("Requête invalide"))
                .andExpect(jsonPath("$.errors[?(@.field == 'client.name')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'invoiceNumber')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'paymentTermsDays')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'lines[0].quantity')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'lines[0].unitPrice')]").exists());
    }

    @Test
    void refuseAucuneLigne() throws Exception {
        String body = VALID.replaceFirst("(?s)\"lines\": \\[.*?\\],", "\"lines\": [],");
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("lines"));
    }

    @Test
    void refuseLesChampsCalculesEnvoyesParLeClient() throws Exception {
        String body = VALID.replace("\"notes\":", "\"totalDue\": 1, \"notes\":");
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Requête illisible"));
    }

    @Test
    void refuseUnNumeroDeFactureMalForme() throws Exception {
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID.replace("558-00178", "../../etc/passwd")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void refuseLesCaracteresDeControle() throws Exception {
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID.replace("Société Cliente", "Soci\\u0000t\\u0007")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("client.name"));
    }

    @Test
    void refuseLesDecimalesExcessives() throws Exception {
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON)
                        .content(VALID.replace("\"unitPrice\": 250.00", "\"unitPrice\": 250.001")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("lines[0].unitPrice"));
    }

    @Test
    void refuseUnJsonIllisible() throws Exception {
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content("{ pas du json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").exists());
    }

    @Test
    void refuseUneRequeteTropVolumineuse() throws Exception {
        String body = VALID.replace("Paiement par virement.", "x".repeat(300_000));
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isContentTooLarge());
    }

    @Test
    void refuseUnAutreTypeDeContenu() throws Exception {
        mvc.perform(post("/api/v1/invoices/pdf").contentType(MediaType.TEXT_PLAIN).content(VALID))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void nomDeFichierAssaini() {
        assertThat(InvoiceController.fileName("2026/001")).isEqualTo("Facture-2026-001.pdf");
    }

    private static void writeSample(String name, byte[] pdf) throws Exception {
        Path dir = Path.of("target", "pdf-output");
        Files.createDirectories(dir);
        Files.write(dir.resolve(name), pdf);
    }
}
