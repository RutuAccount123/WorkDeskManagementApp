package com.decentdecor.workdesk.dto.workflow;

import com.decentdecor.workdesk.dto.common.PersonRef;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * One step of a run, like a column group of the FMS sheet.
 * planned = due time, actual = done time, delayMinutes = actual (or now) minus planned; positive = late.
 */
public record RunStepResponse(
        int step,
        String title,
        BigDecimal hours,
        PersonRef assignee,
        String how,
        List<String> checklist,
        RunStepTask task,
        Instant planned,
        Instant actual,
        Long delayMinutes) {
}
