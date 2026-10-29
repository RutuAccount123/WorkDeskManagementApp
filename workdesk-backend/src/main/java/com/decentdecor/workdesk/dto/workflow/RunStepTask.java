package com.decentdecor.workdesk.dto.workflow;

import java.time.Instant;

/** Stage status; id is set only for the run's current actionable task. */
public record RunStepTask(Long id, String status, Instant dueAt, Instant completedAt, boolean overdue) {
}
