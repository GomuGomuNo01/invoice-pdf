package com.invoicepdf.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "invoice.site.editor-name=Atelier Éditeur",
        "invoice.site.host-name=Hébergeur Exemple",
        "invoice.site.host-address=  "
})
@AutoConfigureMockMvc
class SiteControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void exposeLesMentionsConfigurees() throws Exception {
        mvc.perform(get("/api/v1/site"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editorName").value("Atelier Éditeur"))
                .andExpect(jsonPath("$.hostName").value("Hébergeur Exemple"))
                // Valeur vide ou absente : null, le frontend affiche "À compléter".
                .andExpect(jsonPath("$.hostAddress").doesNotExist())
                .andExpect(jsonPath("$.editorEmail").doesNotExist());
    }
}
