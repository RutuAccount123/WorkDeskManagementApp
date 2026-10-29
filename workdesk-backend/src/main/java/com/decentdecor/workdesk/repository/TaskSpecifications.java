package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
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
        return (root, query, cb) -> cb.and(
                root.get("status").in(TaskStatus.OPEN),
                cb.isNotNull(root.get("dueAt")),
                cb.lessThan(root.<Instant>get("dueAt"), now));
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

    private static Expression<Instant> workAt(jakarta.persistence.criteria.Root<Task> root,
                                              jakarta.persistence.criteria.CriteriaBuilder cb) {
        return cb.coalesce(root.<Instant>get("dueAt"), root.<Instant>get("createdAt"));
    }
}
