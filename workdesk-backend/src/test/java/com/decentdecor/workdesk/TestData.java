package com.decentdecor.workdesk;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import java.lang.reflect.Field;
import java.time.Instant;

/** Small builders for unit tests (no database). */
public final class TestData {
    private TestData() {
    }

    public static Employee person(long id, String name, Role role) {
        Employee e = new Employee();
        setId(e, id);
        e.setFullName(name);
        e.setRole(role);
        e.setActive(true);
        return e;
    }

    public static Task task(long id, Employee assignee, Employee createdBy, Employee reviewer, TaskStatus status) {
        Task t = new Task();
        setId(t, id);
        t.setTitle("Task " + id);
        t.setAssignee(assignee);
        t.setCreatedBy(createdBy);
        t.setReviewer(reviewer);
        t.setStatus(status);
        t.setCreatedAt(Instant.parse("2026-10-01T04:30:00Z"));
        t.setUpdatedAt(t.getCreatedAt());
        return t;
    }

    /** Entities have no setId (the database gives ids); tests set it directly. */
    public static void setId(Object entity, long id) {
        try {
            Field f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
