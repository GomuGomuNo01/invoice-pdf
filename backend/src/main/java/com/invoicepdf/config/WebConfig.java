package com.invoicepdf.config;

import java.time.Duration;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final ApiProperties apiProperties;

    public WebConfig(ApiProperties apiProperties) {
        this.apiProperties = apiProperties;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(apiProperties.corsAllowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders(HttpHeaders.CONTENT_TYPE, HttpHeaders.ACCEPT)
                .exposedHeaders(HttpHeaders.CONTENT_DISPOSITION)
                .allowCredentials(false)
                .maxAge(3600);
    }

    /**
     * Interface intégrée à l'image (hébergement en un seul conteneur) : les fichiers de /assets/
     * portent une empreinte dans leur nom, ils peuvent donc être gardés un an par le navigateur.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
    }
}
