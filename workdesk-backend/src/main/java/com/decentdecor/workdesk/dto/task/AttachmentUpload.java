package com.decentdecor.workdesk.dto.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** One file sent as proof of work. data = the file's bytes, Base64 encoded. */
public record AttachmentUpload(
        @NotBlank(message = "fileName: required") @Size(max = 200, message = "fileName: must be 200 characters or fewer") String fileName,
        @Size(max = 100, message = "contentType: must be 100 characters or fewer") String contentType,
        @NotBlank(message = "Choose a file to attach") String data) {
}
