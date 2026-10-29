package com.decentdecor.workdesk.dto.employee;

/** POST /api/employees/{id}/reset-password */
public record ResetPasswordRequest(String newPassword) {
}
