package com.decentdecor.workdesk.dto.task;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Approve selected submitted tasks in one request. */
public record TaskBatchApprovalRequest(
        @NotEmpty @Size(max = 500) List<@NotNull Long> taskIds) {
}
