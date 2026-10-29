package com.decentdecor.workdesk.security;

import com.decentdecor.workdesk.repository.EmployeeRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads "Authorization: Bearer <token>" on every request. The token must be valid AND still match the
 * database (person active, same token version), so a deactivated person is locked out at once.
 * The role is taken from the database, not from the token.
 * Not a Spring bean on purpose: it is added only to the security chain (SecurityConfig).
 */
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final EmployeeRepository employees;

    public JwtAuthFilter(JwtService jwt, EmployeeRepository employees) {
        this.jwt = jwt;
        this.employees = employees;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            jwt.read(header.substring(7).trim()).ifPresent(session -> employees.findById(session.userId())
                    .filter(e -> e.isActive() && e.getTokenVersion() == session.tokenVersion())
                    .ifPresent(e -> {
                        CurrentUser me = new CurrentUser(e.getId(), e.getRole().name());
                        var auth = new UsernamePasswordAuthenticationToken(me, null,
                                List.of(new SimpleGrantedAuthority("ROLE_" + me.role())));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }));
        }
        chain.doFilter(req, res);
    }
}
