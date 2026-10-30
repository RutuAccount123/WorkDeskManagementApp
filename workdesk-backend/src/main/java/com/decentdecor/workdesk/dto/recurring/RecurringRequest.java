package com.decentdecor.workdesk.dto.recurring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Add or edit a daily, weekly, or monthly task. */
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
        BigDecimal estimatedHours,
        String startDate,
        String scheduledTime,
        Integer durationMinutes) {
}
