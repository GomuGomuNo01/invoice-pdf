package com.invoicepdf.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** Vérifie la lecture d'un fichier .env (accents compris) et l'endpoint de l'émetteur. */
@SpringBootTest(properties = "invoice.dotenv-path=src/test/resources/issuer-test.env")
@AutoConfigureMockMvc
class IssuerConfigTest {

    @Autowired
    MockMvc mvc;

    @Test
    void litLeFichierEnvEtExposeLEmetteur() throws Exception {
        mvc.perform(get("/api/v1/issuer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Société Émettrice Ça"))
                .andExpect(jsonPath("$.iban").value("FR76 0000 0000 0000 0000 0000 000"))
                .andExpect(jsonPath("$.siret").doesNotExist());
    }
}
