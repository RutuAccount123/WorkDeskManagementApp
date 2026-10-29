package com.decentdecor.workdesk.dto.auth;

/** A fresh sign-in token (after changing the password, other sign-ins end and this one continues). */
public record TokenResponse(String token, long expiresInSeconds) {
}
