package com.invoicepdf.config;

import java.io.IOException;
import java.io.Reader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

/**
 * Charge un fichier .env local (format clé=valeur) encodé en UTF-8.
 * Le mécanisme standard spring.config.import lit les fichiers .properties en ISO-8859-1,
 * ce qui corrompt les accents (nom d'entreprise, adresse).
 * Les variables d'environnement réelles restent prioritaires sur le fichier.
 * Emplacement : propriété invoice.dotenv-path, sinon ./.env puis ../.env.
 */
public class DotEnvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String SOURCE_NAME = "dotenv";
    static final String PATH_PROPERTY = "invoice.dotenv-path";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String configured = environment.getProperty(PATH_PROPERTY);
        List<Path> candidates = configured != null && !configured.isBlank()
                ? List.of(Path.of(configured))
                : List.of(Path.of(".env"), Path.of("..", ".env"));

        candidates.stream().filter(Files::isRegularFile).findFirst().ifPresent(path -> {
            Map<String, Object> values = load(path);
            String anchor = StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME;
            if (environment.getPropertySources().contains(anchor)) {
                environment.getPropertySources().addAfter(anchor, new MapPropertySource(SOURCE_NAME, values));
            } else {
                environment.getPropertySources().addLast(new MapPropertySource(SOURCE_NAME, values));
            }
        });
    }

    static Map<String, Object> load(Path path) {
        Properties properties = new Properties();
        try (Reader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            properties.load(reader);
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture impossible du fichier " + path, e);
        }
        Map<String, Object> values = new HashMap<>();
        properties.forEach((key, value) -> values.put(key.toString(), value.toString().strip()));
        return values;
    }

    @Override
    public int getOrder() {
        // Avant le traitement de application.yml, pour que les ${...} trouvent les valeurs.
        return Ordered.HIGHEST_PRECEDENCE + 20;
    }
}
