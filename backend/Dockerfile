# Construction
FROM eclipse-temurin:21-jdk-noble AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
RUN ./mvnw -B -q package -DskipTests

# Exécution : JRE seul, utilisateur non root
FROM eclipse-temurin:21-jre-noble
RUN groupadd --system app && useradd --system --gid app --no-create-home app
WORKDIR /app
COPY --from=build /app/target/invoice-pdf-backend-*.jar app.jar
USER app
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Djava.awt.headless=true -Dpdfbox.fontcache=/tmp"
# Pas de HEALTHCHECK : l'image JRE ne contient ni wget ni curl. Santé : GET /actuator/health.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
