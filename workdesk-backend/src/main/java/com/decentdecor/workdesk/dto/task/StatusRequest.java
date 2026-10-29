package com.decentdecor.workdesk.dto.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** POST /api/tasks/{id}/status. comment is required when sending work back. */
public record StatusRequest(
        @NotBlank(message = "Choose a valid status") String status,
        @Size(max = 4000, message = "comment: must be 4000 characters or fewer") String comment) {
}
