package com.decentdecor.workdesk.dto.task;

import com.decentdecor.workdesk.dto.common.PersonRef;
import com.decentdecor.workdesk.entity.json.ChecklistItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * One task, as the screens show it.
 * overdue: open and past its due time. repeat: recurrence frequency for copies of a repeating task.
 * reviewer: null = no review needed. workflow: set for an FMS run task.
 */
public record TaskResponse(
        Long id,
        String title,
        String description,
        PersonRef assignee,
        PersonRef createdBy,
        String priority,
        String status,
        Instant dueAt,
        Instant scheduledAt,
        BigDecimal estimatedHours,
        boolean overdue,
        boolean recurring,
        String repeat,
        Long linkedWorkflowId,
        boolean selfAdded,
        PersonRef reviewer,
        WorkflowInfo workflow,
        List<ChecklistItem> checklist,
        Instant createdAt,
        Instant updatedAt,
        Instant startedAt,
        Instant submittedAt,
        Instant completedAt) {
}
