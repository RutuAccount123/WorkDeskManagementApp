package com.decentdecor.workdesk.dto.auth;

/** POST /api/auth/login */
public record LoginRequest(String email, String password) {
}
