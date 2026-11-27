package com.invoicepdf.web;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Interface servie par l'application (hébergement en un seul conteneur).
 * Les fichiers d'essai sont dans src/test/resources/static ; l'image réelle y place le build du frontend.
 */
@SpringBootTest
@AutoConfigureMockMvc
class StaticInterfaceTest {

    @Autowired
    MockMvc mvc;

    @Test
    void pageDEntreeAvecLaPolitiqueDeLInterfaceEtSansCache() throws Exception {
        // "/" est renvoyé en interne vers index.html (MockMvc ne suit pas ce renvoi : le contenu est testé à part).
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("index.html"))
                .andExpect(header().string("Content-Security-Policy", SecurityHeadersFilter.CSP_INTERFACE))
                .andExpect(header().string("Cache-Control", "no-cache"))
                .andExpect(header().string("X-Frame-Options", "DENY"));
        mvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<div id=\"root\">")))
                .andExpect(header().string("Cache-Control", "no-cache"));
    }

    @Test
    void uneNouvelleVersionEstToujoursServieAuxNavigateursQuiOntLAncienne() throws Exception {
        // Les dates de fichiers sont figées par la construction (1er février 1980) : un navigateur qui
        // demandait « modifié depuis 1980 ? » recevait 304 et gardait l'ancienne page indéfiniment.
        String dateFigee = "Fri, 01 Feb 1980 00:00:00 GMT";
        for (String chemin : new String[] {"/index.html", "/theme-init.js"}) {
            mvc.perform(get(chemin).header("If-Modified-Since", dateFigee))
                    .andExpect(status().isOk())
                    .andExpect(header().doesNotExist("Last-Modified"))
                    .andExpect(header().string("Cache-Control", "no-cache"));
        }
    }

    @Test
    void fichiersVersionnesGardesUnAn() throws Exception {
        mvc.perform(get("/assets/index-essai.js"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("max-age=31536000")))
                .andExpect(header().string("Cache-Control", containsString("immutable")))
                .andExpect(header().string("Content-Security-Policy", SecurityHeadersFilter.CSP_INTERFACE));
    }

    @Test
    void lApiGardeSaPolitiqueStricte() throws Exception {
        mvc.perform(get("/api/v1/issuer"))
                .andExpect(header().string("Content-Security-Policy", SecurityHeadersFilter.CSP_API));
        mvc.perform(get("/actuator/health"))
                .andExpect(header().string("Content-Security-Policy", SecurityHeadersFilter.CSP_API));
    }

    @Test
    void hstsSeulementEnHttps() throws Exception {
        mvc.perform(get("/").secure(true))
                .andExpect(header().string("Strict-Transport-Security", "max-age=31536000; includeSubDomains"));
        mvc.perform(get("/")).andExpect(header().doesNotExist("Strict-Transport-Security"));
    }

    @Test
    void cheminInconnuIntrouvable() throws Exception {
        mvc.perform(get("/inexistant.js")).andExpect(status().isNotFound());
    }
}
