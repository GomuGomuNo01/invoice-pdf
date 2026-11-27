package com.invoicepdf.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Le profil de production n'expose ni la documentation de l'API ni de détail de santé. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("prod")
class ProductionProfileTest {

    @Autowired
    MockMvc mvc;

    @Test
    void aucuneDocumentationDApiExposee() throws Exception {
        mvc.perform(get("/api/v1/openapi.json")).andExpect(status().isNotFound());
        mvc.perform(get("/api/docs")).andExpect(status().isNotFound());
    }

    @Test
    void santeSansDetail() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/env")).andExpect(status().isNotFound());
        mvc.perform(get("/actuator/health/liveness")).andExpect(status().isOk());
    }
}
