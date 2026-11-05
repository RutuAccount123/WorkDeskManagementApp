package com.decentdecor.workdesk.dto.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Create (POST /api/tasks) or edit (PUT /api/tasks/{id}) a task.
 * assigneeId: empty = yourself. reviewerId: empty = the person assigning (or no review for your own work).
 * dueAt: "2026-10-30T18:00" (office time) or empty. estimatedHours: optional; if set, dueAt is generated when work starts.
 * status: only for your own work (TODO, IN_PROGRESS, COMPLETED).
 * workflowId: link to an existing FMS (only when creating).
 */
public record TaskRequest(
        @NotBlank(message = "title: must not be blank")
        @Size(max = 200, message = "title: must be 200 characters or fewer") String title,
        @Size(max = 10000, message = "description: is too long") String description,
        Long assigneeId,
        Long reviewerId,
        String priority,
        String dueAt,
        String status,
        Long workflowId,
        BigDecimal estimatedHours,
        @Size(max = 7000000, message = "image: is too large") String image) {
}
