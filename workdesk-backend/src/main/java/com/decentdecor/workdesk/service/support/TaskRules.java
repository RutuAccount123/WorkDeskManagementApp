package com.decentdecor.workdesk.service.support;

import static com.decentdecor.workdesk.entity.enums.TaskStatus.CANCELLED;
import static com.decentdecor.workdesk.entity.enums.TaskStatus.COMPLETED;
import static com.decentdecor.workdesk.entity.enums.TaskStatus.IN_PROGRESS;
import static com.decentdecor.workdesk.entity.enums.TaskStatus.REOPENED;
import static com.decentdecor.workdesk.entity.enums.TaskStatus.SUBMITTED;
import static com.decentdecor.workdesk.entity.enums.TaskStatus.TODO;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import java.util.Map;
import java.util.Set;

/**
 * Who may move a task from one status to another. Same rules as the screens (taskActions.js).
 * Each map says: from this status → the statuses this person may move it to.
 */
public final class TaskRules {
    private TaskRules() {
    }

    /** The person doing the work: start, then submit for review. */
    static final Map<TaskStatus, Set<TaskStatus>> ASSIGNEE = Map.of(
            TODO, Set.of(IN_PROGRESS),
            REOPENED, Set.of(IN_PROGRESS),
            IN_PROGRESS, Set.of(SUBMITTED));

    /** Own work with no reviewer: move it freely and close it yourself. */
    static final Map<TaskStatus, Set<TaskStatus>> SELF = Map.of(
            TODO, Set.of(IN_PROGRESS, COMPLETED, CANCELLED),
            IN_PROGRESS, Set.of(TODO, COMPLETED, CANCELLED),
            REOPENED, Set.of(IN_PROGRESS, COMPLETED),
            COMPLETED, Set.of(IN_PROGRESS),
            CANCELLED, Set.of(TODO));

    /** The reviewer: approve, or send back. */
    static final Map<TaskStatus, Set<TaskStatus>> REVIEWER = Map.of(
            SUBMITTED, Set.of(COMPLETED, REOPENED),
            COMPLETED, Set.of(REOPENED));

    /** Whoever assigned it: cancel, or bring it back. */
    static final Map<TaskStatus, Set<TaskStatus>> CREATOR = Map.of(
            TODO, Set.of(CANCELLED),
            IN_PROGRESS, Set.of(CANCELLED),
            SUBMITTED, Set.of(CANCELLED),
            REOPENED, Set.of(CANCELLED),
            CANCELLED, Set.of(TODO));

    /** Admins. */
    static final Map<TaskStatus, Set<TaskStatus>> ADMIN = Map.of(
            TODO, Set.of(IN_PROGRESS, COMPLETED, CANCELLED),
            IN_PROGRESS, Set.of(TODO, SUBMITTED, COMPLETED, CANCELLED),
            SUBMITTED, Set.of(COMPLETED, REOPENED, CANCELLED),
            REOPENED, Set.of(IN_PROGRESS, COMPLETED, CANCELLED),
            COMPLETED, Set.of(REOPENED),
            CANCELLED, Set.of(TODO));

    public static boolean canMove(Task t, Employee me, TaskStatus to) {
        TaskStatus from = t.getStatus();
        boolean mine = t.getAssignee().getId().equals(me.getId());
        Employee reviewer = t.effectiveReviewer();
        boolean isReviewer = reviewer != null && reviewer.getId().equals(me.getId());
        boolean isCreator = t.getCreatedBy().getId().equals(me.getId());
        return (mine && reviewer == null && allowed(SELF, from, to))
                || (mine && allowed(ASSIGNEE, from, to))
                || (isReviewer && allowed(REVIEWER, from, to))
                || (isCreator && allowed(CREATOR, from, to))
                || (me.canManage(t.getAssignee()) && allowed(ADMIN, from, to));
    }

    private static boolean allowed(Map<TaskStatus, Set<TaskStatus>> rules, TaskStatus from, TaskStatus to) {
        return rules.getOrDefault(from, Set.of()).contains(to);
    }

    /**
     * Who can edit or delete a task: admins only (department admins only for tasks of people in their departments).
     * The person who created it, the person doing it, and an employee a ticket was raised to cannot;
     * that employee resolves the ticket or marks the task done instead.
     */
    public static boolean canEdit(Task t, Employee me) {
        return me.canManage(t.getAssignee());
    }

    /** Admins see everything (department admins: their departments); everyone sees tasks they are part of. */
    public static boolean canSee(Task t, Employee me) {
        return me.canManage(t.getAssignee()) || t.involves(me.getId());
    }
}
