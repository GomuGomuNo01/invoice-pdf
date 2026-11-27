# Image unique pour l'hébergement en un seul conteneur (Render, offre gratuite) :
# l'application Spring Boot sert à la fois l'interface et l'API, sans nginx.
# La pile auto-hébergée (Caddy, nginx, backend séparés) reste dans deploy/.

# 1. Interface
FROM node:24-alpine AS interface
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2. Application, avec l'interface intégrée dans ses ressources statiques
FROM eclipse-temurin:21-jdk-noble AS application
WORKDIR /app
COPY backend/.mvn .mvn
COPY backend/mvnw backend/pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY backend/src src
COPY --from=interface /app/dist src/main/resources/static
RUN ./mvnw -B -q package -DskipTests

# 3. Exécution : JRE seul, utilisateur non root, profil de production
FROM eclipse-temurin:21-jre-noble
RUN groupadd --system app && useradd --system --gid app --no-create-home app
WORKDIR /app
COPY --from=application /app/target/invoice-pdf-backend-*.jar app.jar
USER app
# Render fournit le port dans PORT (lu par l'application, 8080 par défaut).
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
# Réglé pour 512 Mo de mémoire : ramasse-miettes série (peu gourmand), piles de fils réduites.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k -Djava.awt.headless=true -Dpdfbox.fontcache=/tmp"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
