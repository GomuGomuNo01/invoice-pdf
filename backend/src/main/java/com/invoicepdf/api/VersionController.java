package com.invoicepdf.api;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;

/**
 * Version en service : permet de vérifier après un déploiement que le bon commit est en ligne.
 * Le commit vient de l'hébergeur (RENDER_GIT_COMMIT chez Render) ; le dépôt étant public, il n'est pas sensible.
 */
@RestController
@RequestMapping("/api/v1/version")
public class VersionController {

    private final String version;
    private final String commit;

    public VersionController(ObjectProvider<BuildProperties> buildProperties,
            @Value("${invoice.build.commit:}") String commit) {
        BuildProperties build = buildProperties.getIfAvailable();
        this.version = build != null ? build.getVersion() : "inconnue";
        this.commit = commit == null || commit.isBlank() ? "inconnu" : commit.strip();
    }

    public record VersionResponse(String version, String commit) {
    }

    @Operation(summary = "Version et commit en service")
    @GetMapping
    public ResponseEntity<VersionResponse> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new VersionResponse(version, commit));
    }
}
