package com.decentdecor.workdesk.dto.recurring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Add or edit a daily, weekly, monthly or yearly task.
 * With a scheduled start: either durationMinutes (same day), or dueTime + dueDaysAfter
 * (due that many days after the start day, at dueTime; used by weekly / monthly / yearly tasks).
 */
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
        Integer durationMinutes,
        Long reviewerId,
        @Size(max = 7000000, message = "image: is too large") String image,
        Boolean noReview,
        Integer dueDaysAfter) {
}
