package com.decentdecor.workdesk.dto.employee;

/** GET /api/people: an active person anyone can assign work to. accessibleDepartments: what a department admin manages. */
public record PersonResponse(Long id, String fullName, String department, String designation, String role, boolean active,
                             boolean departmentAdmin, java.util.List<String> accessibleDepartments) {
}
