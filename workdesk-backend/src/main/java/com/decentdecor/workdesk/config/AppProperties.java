package com.decentdecor.workdesk.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Settings under "wd." in application.yml (usually set through environment variables). */
@ConfigurationProperties(prefix = "wd")
public record AppProperties(Jwt jwt, Cors cors, Login login, Admin admin) {

    /** secret: at least 32 characters. ttl: how long a sign-in lasts. */
    public record Jwt(String secret, @DefaultValue("12h") Duration ttl, @DefaultValue("workdesk") String issuer) {}

    public record Cors(@DefaultValue("http://localhost:5173") List<String> allowedOrigins) {}

    /** The first admin, created on the very first start (when there is no admin yet). */
    public record Admin(@DefaultValue("admin@company.com") String email, String password) {}

    /** Sign-in protection: this many failed tries per email + address within the window, then a pause. */
    public record Login(@DefaultValue("10") int maxAttempts, @DefaultValue("15m") Duration window) {}
}
