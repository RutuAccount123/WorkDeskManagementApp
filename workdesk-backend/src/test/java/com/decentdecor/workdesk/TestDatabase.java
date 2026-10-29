package com.decentdecor.workdesk;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.springframework.test.context.DynamicPropertyRegistry;

/** A real PostgreSQL started for the tests (downloaded once by Maven). Nothing to install. */
public final class TestDatabase {
    private static EmbeddedPostgres pg;

    private TestDatabase() {}

    public static synchronized void register(DynamicPropertyRegistry r) {
        if (pg == null) {
            try {
                pg = EmbeddedPostgres.builder().start();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        r.add("spring.datasource.url", () -> pg.getJdbcUrl("postgres", "postgres"));
        r.add("spring.datasource.username", () -> "postgres");
        r.add("spring.datasource.password", () -> "postgres");
    }
}
