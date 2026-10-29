package com.decentdecor.workdesk.dto.recurring;

import com.decentdecor.workdesk.dto.common.PersonRef;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** A daily / weekly task. dueTime: "18:00:00". lastGeneratedOn: the latest day a copy exists for. */
public record RecurringResponse(
        Long id,
        String title,
        String description,
        PersonRef assignee,
        String priority,
        String frequency,
        String dayOfWeek,
        String dueTime,
        BigDecimal estimatedHours,
        boolean active,
        LocalDate lastGeneratedOn,
        Instant createdAt,
        PersonRef createdBy,
        boolean selfOwned,
        Long workflowId) {
}
