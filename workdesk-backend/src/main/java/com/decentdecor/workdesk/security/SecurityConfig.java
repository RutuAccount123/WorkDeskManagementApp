package com.decentdecor.workdesk.security;

import com.decentdecor.workdesk.config.AppProperties;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Who can call what.
 *  - Only sign-in and the health check are open. Everything else needs a valid token.
 *  - Admin-only areas are blocked here AND checked again in the services.
 *  - No cookies / sessions: the token is sent in the Authorization header, so CSRF does not apply.
 */
@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain api(HttpSecurity http, JwtService jwt, EmployeeRepository employees, JsonErrorWriter errors) throws Exception {
        http
            .csrf(c -> c.disable())
            .cors(Customizer.withDefaults())
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .logout(l -> l.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                // admin only
                .requestMatchers("/api/employees", "/api/employees/**").hasRole("ADMIN")
                .requestMatchers("/api/reports/team", "/api/reports/employees", "/api/reports/employees.csv").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/holidays").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/holidays/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/holidays/**").hasRole("ADMIN")
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> errors.write(res, HttpStatus.UNAUTHORIZED, "Not signed in"))
                .accessDeniedHandler((req, res, ex) -> errors.write(res, HttpStatus.FORBIDDEN, "You do not have permission to do this")))
            .headers(h -> h
                .contentSecurityPolicy(c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
                .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                .frameOptions(f -> f.deny()))
            .addFilterBefore(new JwtAuthFilter(jwt, employees), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** Which websites may call the API from a browser (the hosted frontend). */
    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(props.cors().allowedOrigins());
        c.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type"));
        c.setExposedHeaders(java.util.List.of("Content-Disposition"));
        c.setAllowCredentials(false);
        c.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", c);
        return src;
    }
}
