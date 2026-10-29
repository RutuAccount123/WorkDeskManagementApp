package com.decentdecor.workdesk.dto.employee;

import java.time.Instant;

/** A full employee record. Never contains the password. */
public record EmployeeResponse(
        Long id,
        String employeeCode,
        String fullName,
        String email,
        String role,
        String department,
        String designation,
        String phone,
        boolean active,
        Instant createdAt) {
}
