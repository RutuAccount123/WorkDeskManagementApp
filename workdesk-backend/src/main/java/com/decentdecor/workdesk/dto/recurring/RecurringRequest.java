package com.decentdecor.workdesk.dto.recurring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Add or edit a daily / weekly task.
 * frequency: DAILY (Mon–Sat) or WEEKLY (needs dayOfWeek, Monday–Saturday). dueTime: "18:00".
 * estimatedHours is optional; when set, each copy's deadline is calculated when work starts.
 * assigneeId: admins only (employees always set it up for themselves).
 * workflowId: link to an FMS; empty when editing keeps the current link.
 */
public record RecurringRequest(
        @NotBlank(message = "title: must not be blank")
        @Size(max = 200, message = "title: must be 200 characters or fewer") String title,
        String description,
        Long assigneeId,
        String priority,
        String frequency,
        String dayOfWeek,
        String dueTime,
        Long workflowId,
        BigDecimal estimatedHours) {
}
