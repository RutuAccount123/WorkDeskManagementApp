package com.decentdecor.workdesk.dto.auth;

/** POST /api/auth/change-password */
public record ChangePasswordRequest(String currentPassword, String newPassword) {
}
