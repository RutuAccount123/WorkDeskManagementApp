package com.decentdecor.workdesk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.decentdecor.workdesk.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class JwtServiceTest {
    static AppProperties props(String secret) {
        return new AppProperties(new AppProperties.Jwt(secret, Duration.ofHours(12), "workdesk"),
                new AppProperties.Cors(List.of()), new AppProperties.Login(10, Duration.ofMinutes(15)), null);
    }

    final Instant t0 = Instant.parse("2026-10-27T05:00:00Z");
    final JwtService jwt = new JwtService(props("0123456789-0123456789-0123456789-ab"), Clock.fixed(t0, ZoneOffset.UTC));

    @Test
    void roundTrip() {
        var s = jwt.read(jwt.issue(7, "EMPLOYEE", 3)).orElseThrow();
        assertThat(s.userId()).isEqualTo(7);
        assertThat(s.role()).isEqualTo("EMPLOYEE");
        assertThat(s.tokenVersion()).isEqualTo(3);
        assertThat(jwt.ttlSeconds()).isEqualTo(43200);
    }

    @Test
    void rejectsChangedOrForeignOrExpiredTokens() {
        String token = jwt.issue(7, "EMPLOYEE", 0);
        assertThat(jwt.read(token.substring(0, token.length() - 2) + "xx")).isEmpty();
        var other = new JwtService(props("another-secret-another-secret-another"), Clock.fixed(t0, ZoneOffset.UTC));
        assertThat(other.read(token)).isEmpty();
        var later = new JwtService(props("0123456789-0123456789-0123456789-ab"), Clock.fixed(t0.plus(Duration.ofHours(13)), ZoneOffset.UTC));
        assertThat(later.read(token)).isEmpty();
        assertThat(jwt.read(null)).isEmpty();
        assertThat(jwt.read("abc")).isEmpty();
    }

    @Test
    void refusesAShortSecret() {
        assertThatThrownBy(() -> new JwtService(props("short"))).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("WD_JWT_SECRET");
    }
}
