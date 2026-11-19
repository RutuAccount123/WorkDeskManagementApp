package com.decentdecor.workdesk.dto.leave;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** POST /api/leaves — dates as yyyy-mm-dd, both included. */
public record LeaveRequest(
        @NotNull(message = "employeeId: choose a person") Long employeeId,
        @NotBlank(message = "startDate: choose the first day of leave") String startDate,
        @NotBlank(message = "endDate: choose the last day of leave") String endDate,
        @Size(max = 300, message = "reason: must be 300 characters or fewer") String reason) {
}
