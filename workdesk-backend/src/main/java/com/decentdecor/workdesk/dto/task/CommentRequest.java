package com.decentdecor.workdesk.dto.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** POST /api/tasks/{id}/comments */
public record CommentRequest(
        @NotBlank(message = "comment: must not be blank")
        @Size(max = 4000, message = "comment: must be 4000 characters or fewer") String comment) {
}
