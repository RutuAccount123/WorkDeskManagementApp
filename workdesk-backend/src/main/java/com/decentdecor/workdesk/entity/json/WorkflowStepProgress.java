package com.decentdecor.workdesk.entity.json;

import java.time.Instant;

/** Runtime status and timestamps for one step in a workflow run. */
public record WorkflowStepProgress(String status, Instant dueAt, Instant completedAt) {
}
