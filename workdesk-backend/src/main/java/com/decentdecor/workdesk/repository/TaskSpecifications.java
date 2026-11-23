package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.TaskTicket;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.entity.enums.TicketStatus;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Instant;
import java.util.Collection;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/**
 * Building blocks for the task list (GET /api/tasks). Combine them with .and(...).
 * Each method is one filter, so a new filter is one new method here.
 */
public final class TaskSpecifications {
    private TaskSpecifications() {
    }

    /** Everything (starting point). */
    public static Specification<Task> all() {
        return (root, query, cb) -> cb.conjunction();
    }

    public static Specification<Task> assignedTo(Long employeeId) {
        return (root, query, cb) -> cb.equal(root.get("assignee").get("id"), employeeId);
    }

    public static Specification<Task> assignedToDepartments(Collection<String> departments) {
        return (root, query, cb) -> root.get("assignee").get("department").in(departments);
    }

    /** Work I assigned to someone else. */
    public static Specification<Task> assignedByToOthers(Long employeeId) {
        return (root, query, cb) -> cb.and(
                cb.equal(root.get("createdBy").get("id"), employeeId),
                cb.notEqual(root.get("assignee").get("id"), employeeId));
    }

    /** Tasks I review (FMS steps have no reviewer). */
    public static Specification<Task> reviewedBy(Long employeeId) {
        return (root, query, cb) -> {
            Join<Task, Employee> reviewer = root.join("reviewer", JoinType.LEFT);
            return cb.and(cb.equal(reviewer.get("id"), employeeId), cb.isNull(root.get("workflowRun")));
        };
    }

    /** Tasks I am part of: doing it, assigned it, or reviewing it. */
    public static Specification<Task> involving(Long employeeId) {
        return (root, query, cb) -> {
            Join<Task, Employee> reviewer = root.join("reviewer", JoinType.LEFT);
            return cb.or(
                    cb.equal(root.get("assignee").get("id"), employeeId),
                    cb.equal(root.get("createdBy").get("id"), employeeId),
                    cb.and(cb.equal(reviewer.get("id"), employeeId), cb.isNull(root.get("workflowRun"))));
        };
    }

    public static Specification<Task> statusIn(Collection<TaskStatus> statuses) {
        return (root, query, cb) -> root.get("status").in(statuses);
    }

    public static Specification<Task> priority(Priority priority) {
        return (root, query, cb) -> cb.equal(root.get("priority"), priority);
    }

    /** Open and past its due time. */
    public static Specification<Task> overdue(Instant now) {
        return (root, query, cb) -> {
            // a task with an open ticket is pending, not overdue
            Subquery<Long> openTicket = query.subquery(Long.class);
            Root<TaskTicket> k = openTicket.from(TaskTicket.class);
            openTicket.select(k.get("id")).where(cb.equal(k.get("task"), root), cb.equal(k.get("status"), TicketStatus.OPEN));
            return cb.and(
                    root.get("status").in(TaskStatus.OPEN),
                    cb.isNotNull(root.get("dueAt")),
                    cb.lessThan(root.<Instant>get("dueAt"), now),
                    cb.not(cb.exists(openTicket)));
        };
    }

    /** Text in the title or details (any case). */
    public static Specification<Task> search(String text) {
        String pattern = "%" + text.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.<String>get("title")), pattern, '\\'),
                cb.like(cb.lower(root.<String>get("description")), pattern, '\\'));
    }

    /** The work day (due date, or the day it was added) is on or after "from". */
    public static Specification<Task> workAtOrAfter(Instant from) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(workAt(root, cb), from);
    }

    /** The work day is before "to". */
    public static Specification<Task> workBefore(Instant to) {
        return (root, query, cb) -> cb.lessThan(workAt(root, cb), to);
    }

    /**
     * The work day is in [from, to), or the planned day (due date, or the day it was added) is:
     * so a calendar also gets the work that was started or finished on another day than it was scheduled for.
     */
    public static Specification<Task> workOrPlannedBetween(Instant from, Instant to) {
        return (root, query, cb) -> {
            Expression<Instant> work = workAt(root, cb);
            Expression<Instant> planned = cb.coalesce(root.<Instant>get("dueAt"), root.<Instant>get("createdAt"));
            return cb.or(
                    cb.and(cb.greaterThanOrEqualTo(work, from), cb.lessThan(work, to)),
                    cb.and(cb.greaterThanOrEqualTo(planned, from), cb.lessThan(planned, to)));
        };
    }

    private static Expression<Instant> workAt(jakarta.persistence.criteria.Root<Task> root,
                                              jakarta.persistence.criteria.CriteriaBuilder cb) {
        // same as Task.workAt(): done work belongs to the day it was finished
        Expression<Instant> planned = cb.coalesce(root.<Instant>get("dueAt"), root.<Instant>get("createdAt"));
        Expression<Instant> started = root.<Instant>get("startedAt");
        return cb.<Instant>selectCase()
                .when(cb.and(cb.equal(root.get("status"), TaskStatus.COMPLETED), cb.isNotNull(root.get("completedAt"))),
                        root.<Instant>get("completedAt"))
                // started ahead of its date: the work belongs to the day it was started
                .when(cb.and(root.get("status").in(TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED),
                        cb.isNotNull(started), cb.lessThan(started, planned)), started)
                .otherwise(planned);
    }
}
