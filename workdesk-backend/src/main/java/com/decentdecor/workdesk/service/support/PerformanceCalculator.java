package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.dto.report.Performance;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.util.Texts;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.OptionalDouble;

/**
 * Performance for one person over a period [from, to).
 *   completion rate = done ÷ all work in the period (cancelled not counted)
 *   on-time rate    = done by the due time ÷ done
 *   score           = 60% completion + 40% on time, out of 100
 * Work counts once it was due; future work only counts once it is finished early.
 */
public final class PerformanceCalculator {
    private PerformanceCalculator() {
    }

    /** tasks: all tasks of that person (any period). */
    public static Performance of(List<Task> tasks, Long employeeId, Instant from, Instant to, Instant now) {
        Instant cutoff = to.isBefore(now) ? to : now;
        List<Task> list = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.CANCELLED)
                .filter(t -> {
                    Instant w = t.workAt();
                    boolean dueSoFar = !w.isBefore(from) && w.isBefore(cutoff);
                    boolean finishedInPeriod = t.getStatus() == TaskStatus.COMPLETED && !w.isBefore(from) && w.isBefore(to);
                    return dueSoFar || finishedInPeriod;
                })
                .toList();
        List<Task> done = list.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).toList();
        long ok = done.stream().filter(PerformanceCalculator::onTime).count();
        long open = list.stream().filter(t -> t.getStatus().isOpen()).count();
        long overdue = list.stream().filter(t -> t.isOverdue(now)).count();
        long selfAdded = list.stream().filter(t -> t.getCreatedBy().getId().equals(employeeId)).count();

        Double completionRate = list.isEmpty() ? null : (double) done.size() / list.size();
        Double onTimeRate = done.isEmpty() ? null : (double) ok / done.size();
        Integer score = list.isEmpty() ? null
                : (int) Math.round(100 * (0.6 * completionRate + 0.4 * (onTimeRate == null ? 0 : onTimeRate)));
        OptionalDouble avg = done.stream()
                .mapToDouble(t -> Duration.between(t.getCreatedAt(), t.getCompletedAt()).toMinutes() / 60.0)
                .filter(h -> h >= 0)
                .average();
        Double avgHours = avg.isPresent() ? avg.getAsDouble() : null;

        return new Performance(list.size(), done.size(), ok, done.size() - ok, open, overdue, selfAdded,
                completionRate == null ? null : Texts.round1(100 * completionRate),
                onTimeRate == null ? null : Texts.round1(100 * onTimeRate),
                score, rating(score), Texts.round1(avgHours));
    }

    public static boolean onTime(Task t) {
        return t.getDueAt() == null || !t.getCompletedAt().isAfter(t.getDueAt());
    }

    public static String rating(Integer score) {
        if (score == null) return "No work yet";
        if (score >= 85) return "Excellent";
        if (score >= 70) return "Good";
        if (score >= 50) return "Needs attention";
        return "Poor";
    }
}
