package com.decentdecor.workdesk.security;

import com.decentdecor.workdesk.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Signed login tokens (JWT, HS256). A token holds the person's id, role and "token version".
 * When the password changes or the person is deactivated the version goes up, so old tokens stop working.
 */
@Service
public class JwtService {
    public record Session(long userId, String role, int tokenVersion) {}

    private final SecretKey key;
    private final AppProperties.Jwt props;
    private final Clock clock;

    @Autowired
    public JwtService(AppProperties props) {
        this(props, Clock.systemUTC());
    }

    JwtService(AppProperties props, Clock clock) {
        this.props = props.jwt();
        String secret = this.props == null ? null : this.props.secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("Set WD_JWT_SECRET (wd.jwt.secret) to a random value of at least 32 characters.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.clock = clock;
    }

    public long ttlSeconds() {
        return props.ttl().toSeconds();
    }

    public String issue(long userId, String role, int tokenVersion) {
        Instant now = clock.instant();
        return Jwts.builder()
                .issuer(props.issuer())
                .subject(Long.toString(userId))
                .claim("role", role)
                .claim("tv", tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.ttl())))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** The session in a token, or empty if it is missing, changed, expired or signed with another key. */
    public Optional<Session> read(String token) {
        if (token == null || token.isBlank() || token.length() > 4096) return Optional.empty();
        try {
            Claims c = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(props.issuer())
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Number tv = c.get("tv", Number.class);
            return Optional.of(new Session(Long.parseLong(c.getSubject()), c.get("role", String.class), tv == null ? -1 : tv.intValue()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
