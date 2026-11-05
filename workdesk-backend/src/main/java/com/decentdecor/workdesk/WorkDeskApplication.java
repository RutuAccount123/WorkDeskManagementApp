package com.decentdecor.workdesk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Work Desk API. Business rules live in PostgreSQL (PL/pgSQL); this app handles sign-in, security and HTTP. */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
@EnableScheduling
public class WorkDeskApplication {
    public static void main(String[] args) {
        SpringApplication.run(WorkDeskApplication.class, args);
    }
}
 