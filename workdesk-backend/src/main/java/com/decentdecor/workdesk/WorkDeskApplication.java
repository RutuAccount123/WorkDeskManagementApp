package com.decentdecor.workdesk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

/** Work Desk API. Business rules live in PostgreSQL (PL/pgSQL); this app handles sign-in, security and HTTP. */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
@EnableScheduling
public class WorkDeskApplication {
    public static void main(String[] args) {
        // The JVM always runs in UTC. Hibernate (jdbc.time_zone: UTC) would otherwise shift TIME
        // columns (workflow start/end, repeating task due time) by the machine's offset, e.g. 5:30 in India.
        // Office dates and times come from OfficeTime (app.timezone), not from the machine's zone.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(WorkDeskApplication.class, args);
    }
}
 