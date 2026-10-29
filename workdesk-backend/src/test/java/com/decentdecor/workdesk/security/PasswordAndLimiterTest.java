package com.decentdecor.workdesk.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class PasswordAndLimiterTest {
    @Test
    void passwordRules() {
        assertThat(PasswordPolicy.problem("Employee@123", "p")).isNull();
        assertThat(PasswordPolicy.problem("short1", "p")).contains("at least 8");
        assertThat(PasswordPolicy.problem("onlyletters", "p")).contains("at least one number");
        assertThat(PasswordPolicy.problem("12345678", "p")).contains("letters");
        assertThat(PasswordPolicy.problem("a1".repeat(40), "p")).contains("72");
        assertThat(PasswordPolicy.problem(null, "p")).isNotNull();
    }

    /** A clock the test can move forward. */
    static final class TestClock extends Clock {
        final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-27T05:00:00Z"));
        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    }

    @Test
    void limiterBlocksThenForgets() {
        TestClock clock = new TestClock();
        LoginRateLimiter l = new LoginRateLimiter(3, Duration.ofMinutes(15), clock);
        for (int i = 0; i < 3; i++) l.failed("1.2.3.4", "A@x.com");
        assertThat(l.blocked("1.2.3.4", "a@x.com")).isTrue();      // email in any case
        assertThat(l.blocked("5.6.7.8", "a@x.com")).isFalse();     // another address
        clock.now.set(clock.now.get().plus(Duration.ofMinutes(16)));
        assertThat(l.blocked("1.2.3.4", "a@x.com")).isFalse();     // window passed
        l.failed("1.2.3.4", "a@x.com");
        l.succeeded("1.2.3.4", "a@x.com");
        assertThat(l.blocked("1.2.3.4", "a@x.com")).isFalse();
    }
}
