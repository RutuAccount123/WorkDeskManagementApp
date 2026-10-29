package com.decentdecor.workdesk.dto.employee;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Add or edit an employee (admin).
 * password: only when adding (the first password). role: ADMIN or EMPLOYEE.
 */
public record EmployeeRequest(
        @Size(max = 40, message = "employeeCode: must be 40 characters or fewer") String employeeCode,
        @NotBlank(message = "fullName: must not be blank")
        @Size(max = 120, message = "fullName: must be 120 characters or fewer") String fullName,
        @NotBlank(message = "email: must be a valid email address")
        @Size(max = 160, message = "email: must be 160 characters or fewer") String email,
        String password,
        String role,
        @Size(max = 80, message = "department: must be 80 characters or fewer") String department,
        @Size(max = 80, message = "designation: must be 80 characters or fewer") String designation,
        @Size(max = 30, message = "phone: must be 30 characters or fewer") String phone) {
}
