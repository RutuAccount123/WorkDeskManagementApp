package com.decentdecor.workdesk.security;

import com.decentdecor.workdesk.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Slows down password guessing: after too many failed sign-ins for the same email from the same
 * address, further tries are refused for a while. Kept in memory (one server). For several servers,
 * put the same rule in the load balancer or a shared store.
 */
@Component
public class LoginRateLimiter {
    private final int max;
    private final Duration window;
    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    @Autowired
    public LoginRateLimiter(AppProperties props) {
        this(props.login().maxAttempts(), props.login().window(), Clock.systemUTC());
    }

    LoginRateLimiter(int max, Duration window, Clock clock) {
        this.max = max;
        this.window = window;
        this.clock = clock;
    }

    private static String key(String ip, String email) {
        return (ip == null ? "?" : ip) + "|" + (email == null ? "" : email.trim().toLowerCase(Locale.ROOT));
    }

    public boolean blocked(String ip, String email) {
        Deque<Instant> q = failures.get(key(ip, email));
        if (q == null) return false;
        synchronized (q) {
            prune(q);
            return q.size() >= max;
        }
    }

    public void failed(String ip, String email) {
        Deque<Instant> q = failures.computeIfAbsent(key(ip, email), k -> new ArrayDeque<>());
        synchronized (q) {
            prune(q);
            q.addLast(clock.instant());
        }
    }

    public void succeeded(String ip, String email) {
        failures.remove(key(ip, email));
    }

    public long retryAfterMinutes() {
        return Math.max(1, window.toMinutes());
    }

    private void prune(Deque<Instant> q) {
        Instant cutoff = clock.instant().minus(window);
        while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) q.removeFirst();
    }

    /** Forget old entries so memory stays small. */
    @Scheduled(fixedDelay = 600_000)
    public void cleanUp() {
        failures.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                prune(e.getValue());
                return e.getValue().isEmpty();
            }
        });
    }
}
