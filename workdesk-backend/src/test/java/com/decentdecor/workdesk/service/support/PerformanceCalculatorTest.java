package com.decentdecor.workdesk.service.support;

import static com.decentdecor.workdesk.TestData.person;
import static com.decentdecor.workdesk.TestData.task;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.decentdecor.workdesk.dto.report.Performance;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** score = 60% completion + 40% on time. */
class PerformanceCalculatorTest {
    final Employee priya = person(2, "Priya Sharma", Role.EMPLOYEE);
    final Employee admin = person(1, "System Admin", Role.ADMIN);
    final Instant from = Instant.parse("2026-09-30T18:30:00Z");   // 1 Oct 2026, office time
    final Instant to = Instant.parse("2026-10-31T18:30:00Z");
    final Instant now = Instant.parse("2026-10-20T06:00:00Z");

    Task done(long id, String due, String completed) {
        Task t = task(id, priya, admin, admin, TaskStatus.COMPLETED);
        t.setDueAt(Instant.parse(due));
        t.setCompletedAt(Instant.parse(completed));
        return t;
    }

    @Test
    void scoreFromCompletionAndOnTime() {
        Task onTime = done(1, "2026-10-05T12:00:00Z", "2026-10-05T10:00:00Z");
        Task late = done(2, "2026-10-06T12:00:00Z", "2026-10-07T10:00:00Z");
        Task open = task(3, priya, admin, admin, TaskStatus.TODO);
        open.setDueAt(Instant.parse("2026-10-10T12:00:00Z"));
        Task future = task(4, priya, admin, admin, TaskStatus.TODO);
        future.setDueAt(Instant.parse("2026-10-28T12:00:00Z"));   // not due yet: not counted
        Task cancelled = task(5, priya, admin, admin, TaskStatus.CANCELLED);
        cancelled.setDueAt(Instant.parse("2026-10-08T12:00:00Z"));

        Performance p = PerformanceCalculator.of(List.of(onTime, late, open, future, cancelled), priya.getId(), from, to, now);
        assertEquals(3, p.total());
        assertEquals(2, p.completed());
        assertEquals(1, p.completedOnTime());
        assertEquals(1, p.overdue());
        assertEquals(66.7, p.completionRate());
        assertEquals(50.0, p.onTimeRate());
        assertEquals(Math.round(100 * (0.6 * 2 / 3 + 0.4 * 0.5)), p.score().longValue());
        assertEquals("Needs attention", p.rating());
    }

    @Test
    void noWorkMeansNoScore() {
        Performance p = PerformanceCalculator.of(List.of(), priya.getId(), from, to, now);
        assertNull(p.score());
        assertEquals("No work yet", p.rating());
    }
}
