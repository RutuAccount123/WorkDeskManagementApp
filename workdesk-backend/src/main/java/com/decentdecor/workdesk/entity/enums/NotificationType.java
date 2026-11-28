package com.decentdecor.workdesk.entity.enums;

public enum NotificationType {
    TASK_ASSIGNED,
    REVIEW_ASSIGNED,
    TASK_SUBMITTED,
    TASK_APPROVED,
    TASK_REOPENED,
    COMMENT,
    DUE_SOON,
    /** "Due tomorrow" / "Due today": the only kind shown as a desktop pop-up. */
    DAY_REMINDER,
    OVERDUE,
    DAILY_DIGEST,
    WORKFLOW_STEP,
    WORKFLOW_DONE,
    TICKET_RAISED,
    TICKET_RESOLVED,
    LEAVE_ADDED
}
