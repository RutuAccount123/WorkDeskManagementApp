package com.decentdecor.workdesk.entity.enums;

import java.util.EnumSet;
import java.util.Set;

/**
 * Task flow: TODO → IN_PROGRESS → SUBMITTED (waiting for review) → COMPLETED.
 * The reviewer can send it back (REOPENED). CANCELLED = stopped.
 */
public enum TaskStatus {
    TODO,
    IN_PROGRESS,
    SUBMITTED,
    COMPLETED,
    REOPENED,
    CANCELLED;

    /** Work that is not finished yet. */
    public static final Set<TaskStatus> OPEN = EnumSet.of(TODO, IN_PROGRESS, SUBMITTED, REOPENED);

    public boolean isOpen() {
        return OPEN.contains(this);
    }
}
