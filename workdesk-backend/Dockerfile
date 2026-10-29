# Build:  docker build -t workdesk-backend .
# Run:    docker run -p 8082:8082 --env-file .env workdesk-backend
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 workdesk
USER workdesk
WORKDIR /app
COPY --from=build /src/target/workdesk-backend-1.0.0.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
