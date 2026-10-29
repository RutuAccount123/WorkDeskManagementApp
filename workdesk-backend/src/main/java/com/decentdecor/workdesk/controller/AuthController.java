package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.auth.ChangePasswordRequest;
import com.decentdecor.workdesk.dto.auth.LoginRequest;
import com.decentdecor.workdesk.dto.auth.LoginResponse;
import com.decentdecor.workdesk.dto.auth.TokenResponse;
import com.decentdecor.workdesk.dto.employee.EmployeeResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Sign in, who am I, change password. Only /login is open without a token. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request, HttpServletRequest http) {
        return ResponseEntity.ok(authService.login(request, http.getRemoteAddr()));
    }

    @GetMapping("/me")
    public ResponseEntity<EmployeeResponse> me(@AuthenticationPrincipal CurrentUser me) {
        return ResponseEntity.ok(authService.me(me));
    }

    @PostMapping("/change-password")
    public ResponseEntity<TokenResponse> changePassword(@AuthenticationPrincipal CurrentUser me, @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(authService.changePassword(me, request));
    }
}
