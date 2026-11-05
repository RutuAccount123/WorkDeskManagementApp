package com.decentdecor.workdesk.dto.recurring;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record RecurringBatchRequest(
        @NotEmpty @Size(max = 50) List<Long> assigneeIds,
        @Valid RecurringRequest task) {
}
