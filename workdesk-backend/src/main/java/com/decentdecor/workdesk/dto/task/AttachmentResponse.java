package com.decentdecor.workdesk.dto.task;

import java.time.Instant;

/** A proof-of-work file on a task. data (Base64) is filled only when one file is opened. */
public record AttachmentResponse(
        Long id,
        String fileName,
        String contentType,
        int sizeBytes,
        String uploadedByName,
        Instant createdAt,
        String data) {
}
