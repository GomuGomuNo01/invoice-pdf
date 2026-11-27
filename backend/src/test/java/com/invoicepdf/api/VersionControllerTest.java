package com.invoicepdf.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "RENDER_GIT_COMMIT=0123456789abcdef0123456789abcdef01234567")
@AutoConfigureMockMvc
class VersionControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void exposeLaVersionEtLeCommitFournisParLHebergeur() throws Exception {
        mvc.perform(get("/api/v1/version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commit").value("0123456789abcdef0123456789abcdef01234567"))
                .andExpect(jsonPath("$.version").isNotEmpty())
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
