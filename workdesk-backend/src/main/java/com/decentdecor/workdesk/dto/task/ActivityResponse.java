package com.decentdecor.workdesk.dto.task;

import java.time.Instant;

/** One line of a task's history. actorName "System" = done by the scheduler. */
public record ActivityResponse(
        Long id,
        String action,
        String actorName,
        String fromStatus,
        String toStatus,
        String comment,
        Instant createdAt) {
}
