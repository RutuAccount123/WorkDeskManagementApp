package com.decentdecor.workdesk.dto.task;

import com.decentdecor.workdesk.dto.common.PersonRef;
import com.decentdecor.workdesk.entity.json.ChecklistItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * One task, as the screens show it.
 * overdue: open and past its due time (never while pending). pending: has an open ticket.
 * onLeave: open and due on one of the assignee's leave days (not overdue; they choose: do it later or skip).
 * recurringTemplateId: the daily / weekly schedule this task is a copy of (null if not repeating). repeat: recurrence frequency for copies of a repeating task.
 * reviewer: null = no review needed. workflow: set for an FMS run task.
 * fromTicket: set when this task is a ticket raised to the assignee (their work on that ticket).
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
        boolean pending,
        boolean onLeave,
        boolean recurring,
        String repeat,
        Long recurringTemplateId,
        Long linkedWorkflowId,
        boolean selfAdded,
        PersonRef reviewer,
        WorkflowInfo workflow,
        List<ChecklistItem> checklist,
        Instant createdAt,
        Instant updatedAt,
        Instant startedAt,
        Instant submittedAt,
        Instant completedAt,
        String image,
        TicketSource fromTicket) {
}
