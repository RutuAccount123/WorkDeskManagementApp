package com.decentdecor.workdesk.dto.task;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * POST /api/tasks/{id}/status. comment is required when sending work back.
 * attachments: optional proof of work (photos / files) when marking done or submitting for review.
 */
public record StatusRequest(
        @NotBlank(message = "Choose a valid status") String status,
        @Size(max = 4000, message = "comment: must be 4000 characters or fewer") String comment,
        @Valid @Size(max = 5, message = "Attach up to 5 files at a time") List<AttachmentUpload> attachments) {
}
