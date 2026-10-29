package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.auth.ChangePasswordRequest;
import com.decentdecor.workdesk.dto.auth.LoginRequest;
import com.decentdecor.workdesk.dto.auth.LoginResponse;
import com.decentdecor.workdesk.dto.auth.TokenResponse;
import com.decentdecor.workdesk.dto.employee.EmployeeResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.TooManyRequestsException;
import com.decentdecor.workdesk.exception.UnauthorizedException;
import com.decentdecor.workdesk.mapper.EmployeeMapper;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.security.JwtService;
import com.decentdecor.workdesk.security.LoginRateLimiter;
import com.decentdecor.workdesk.security.PasswordPolicy;
import com.decentdecor.workdesk.service.support.People;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Sign-in, "who am I", and changing your own password. */
@Service
public class AuthService {
    /** Checked when the email is unknown, so a wrong email takes as long as a wrong password. */
    private static final String DUMMY_HASH = "$2a$12$6rL1TiJoL7iEamSrbqJfl.8nT4rnBaqFevXnylG5dVUyW2DWB0Ufe";
    private static final String WRONG_LOGIN = "Invalid email or password";

    private final EmployeeRepository employees;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginRateLimiter limiter;
    private final People people;
    private final EmployeeMapper mapper;

    public AuthService(EmployeeRepository employees, PasswordEncoder encoder, JwtService jwt, LoginRateLimiter limiter,
                       People people, EmployeeMapper mapper) {
        this.employees = employees;
        this.encoder = encoder;
        this.jwt = jwt;
        this.limiter = limiter;
        this.people = people;
        this.mapper = mapper;
    }

    /** ip: the caller's address (for the sign-in limit). */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest req, String ip) {
        String email = req == null || req.email() == null ? "" : req.email().trim().toLowerCase(Locale.ROOT);
        String password = req == null || req.password() == null ? "" : req.password();
        if (limiter.blocked(ip, email)) {
            throw new TooManyRequestsException("Too many sign-in attempts. Try again in " + limiter.retryAfterMinutes() + " minutes.");
        }
        Employee e = employees.findByEmail(email).orElse(null);
        boolean passwordOk = encoder.matches(password, e == null ? DUMMY_HASH : e.getPasswordHash());
        if (e == null || !passwordOk || !e.isActive()) {
            limiter.failed(ip, email);
            throw new UnauthorizedException(WRONG_LOGIN);
        }
        limiter.succeeded(ip, email);
        String token = jwt.issue(e.getId(), e.getRole().name(), e.getTokenVersion());
        return new LoginResponse(token, jwt.ttlSeconds(), mapper.toResponse(e));
    }

    @Transactional(readOnly = true)
    public EmployeeResponse me(CurrentUser user) {
        return mapper.toResponse(people.me(user));
    }

    /** Every other sign-in ends; this one gets a new token so the screen keeps working. */
    @Transactional
    public TokenResponse changePassword(CurrentUser user, ChangePasswordRequest req) {
        Employee me = people.me(user);
        String current = req == null ? null : req.currentPassword();
        String next = req == null ? null : req.newPassword();
        if (current == null || !encoder.matches(current, me.getPasswordHash())) throw new BadRequestException("Current password is incorrect");
        String problem = PasswordPolicy.problem(next, "newPassword");
        if (problem != null) throw new BadRequestException(problem);
        if (encoder.matches(next, me.getPasswordHash())) throw new BadRequestException("newPassword: choose a password you have not used just now");
        me.setPasswordHash(encoder.encode(next));
        me.signOutEverywhere();
        return new TokenResponse(jwt.issue(me.getId(), me.getRole().name(), me.getTokenVersion()), jwt.ttlSeconds());
    }
}
