package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.dto.report.TodayCounts;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/** Today's work for one person (used by the team cards and the daily summary). */
public final class TodayWork {
    private TodayWork() {
    }

    /** Tasks (not cancelled) whose work day is in [dayStart, dayEnd), sorted by time. */
    public static List<Task> on(List<Task> tasks, Instant dayStart, Instant dayEnd) {
        List<Task> today = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.CANCELLED)
                .filter(t -> !t.workAt().isBefore(dayStart) && t.workAt().isBefore(dayEnd))
                .sorted(Comparator.comparing(Task::workAt).thenComparing(Task::getId))
                .toList();
        return TaskGroups.onePerWorkflowRun(today).stream()
                .sorted(Comparator.comparing(Task::workAt).thenComparing(Task::getId))
                .toList();
    }

    public static TodayCounts count(List<Task> today) {
        long todo = today.stream().filter(t -> t.getStatus() == TaskStatus.TODO || t.getStatus() == TaskStatus.REOPENED).count();
        long progress = today.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS || t.getStatus() == TaskStatus.SUBMITTED).count();
        long done = today.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
        return new TodayCounts(today.size(), todo, progress, done);
    }
}
