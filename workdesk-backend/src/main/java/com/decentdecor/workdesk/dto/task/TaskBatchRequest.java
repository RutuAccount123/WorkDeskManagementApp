package com.decentdecor.workdesk.dto.task;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Create one independent task copy for each selected assignee. */
public record TaskBatchRequest(
        @NotEmpty @Size(min = 2, max = 50) List<@NotNull Long> assigneeIds,
        @NotNull @Valid TaskRequest task) {
}
