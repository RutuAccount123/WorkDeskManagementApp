package com.decentdecor.workdesk.dto.auth;

import com.decentdecor.workdesk.dto.employee.EmployeeResponse;

/** Answer to a successful sign-in. */
public record LoginResponse(String token, long expiresInSeconds, EmployeeResponse user) {
}
