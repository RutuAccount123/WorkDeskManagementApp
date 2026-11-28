package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.util.OfficeTime;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The background jobs (called by scheduler/SchedulerJobs every few minutes):
 *  1. make recurring task copies for the next 7 days
 *  2. start today's scheduled FMS runs
 *  3. send "due soon" (next 24 h) and "overdue" reminders, once per task
 *  4. day reminders, once each day: on the day before the due date and on the due day.
 *     High / urgent work: whatever its status. Other work: only while still in To do (not started).
 * Safe to run often: nothing is created or sent twice.
 */
@Service
public class SchedulerService {
    private final RecurringGenerator recurring;
    private final WorkflowEngine engine;
    private final TaskRepository tasks;
    private final NotificationService notifications;
    private final OfficeTime time;

    public SchedulerService(RecurringGenerator recurring, WorkflowEngine engine, TaskRepository tasks,
                            NotificationService notifications, OfficeTime time) {
        this.recurring = recurring;
        this.engine = engine;
        this.tasks = tasks;
        this.notifications = notifications;
        this.time = time;
    }

    public record Result(int recurringCopies, int workflowRuns, int reminders) {
    }

    /** Runs all three jobs; each one in its own transaction, so one failing doesn't undo the others. */
    public Result runAll() {
        int copies = recurring.fillAll();
        int runs = engine.startScheduledRunsForToday();
        int reminders = sendReminders();
        return new Result(copies, runs, reminders);
    }

    /** "Due soon" to the assignee; "overdue" to the assignee and whoever assigned it. */
    @Transactional
    public int sendReminders() {
        Instant now = time.now();
        Instant soon = now.plus(Duration.ofHours(24));
        int sent = sendDayReminders(now);
        for (Task t : tasks.findNeedingReminder(TaskStatus.OPEN, now, soon)) {
            if (t.isPending()) continue;   // waiting on a ticket: remind again after it is resolved
            if (t.isOnLeave()) continue;   // due on a leave day: the person decides when back
            if (t.getDueAt().isBefore(now)) {
                notifications.send(t.getAssignee(), t, NotificationType.OVERDUE,
                        "Overdue: \"" + t.getTitle() + "\" was due " + time.friendly(t.getDueAt()));
                if (!t.isSelfAdded()) {
                    notifications.send(t.getCreatedBy(), t, NotificationType.OVERDUE,
                            "Overdue: \"" + t.getTitle() + "\" assigned to " + t.getAssignee().getFullName());
                }
                t.setOverdueReminded(true);
                t.setDueSoonReminded(true);
            } else {
                String reminder = t.getScheduledAt() == null
                        ? "Reminder: \"" + t.getTitle() + "\" is due " + time.friendly(t.getDueAt())
                        : "Scheduled now: \"" + t.getTitle() + "\" is due " + time.friendly(t.getDueAt());
                notifications.send(t.getAssignee(), t, NotificationType.DUE_SOON, reminder);
                t.setDueSoonReminded(true);
            }
            sent++;
        }
        return sent;
    }

    /** "Due tomorrow" on the day before and "Due today" on the due day; at most one a day per task. */
    private int sendDayReminders(Instant now) {
        LocalDate today = time.today();
        int sent = 0;
        for (Task t : tasks.findNeedingDayReminder(TaskStatus.OPEN, now, time.startOf(today.plusDays(2)), today)) {
            if (t.isPending() || t.isOnLeave()) continue;
            boolean important = t.getPriority() == Priority.HIGH || t.getPriority() == Priority.URGENT;
            boolean notStarted = t.getStatus() == TaskStatus.TODO || t.getStatus() == TaskStatus.REOPENED;
            if (!important && !notStarted) continue;
            boolean dueToday = time.dayOf(t.getDueAt()).equals(today);
            String what = important ? t.getPriority().name().charAt(0) + t.getPriority().name().substring(1).toLowerCase() + " priority: " : "";
            notifications.send(t.getAssignee(), t, NotificationType.DAY_REMINDER,
                    (dueToday ? "Due today: " : "Due tomorrow: ") + what + "\"" + t.getTitle() + "\" is due " + time.friendly(t.getDueAt())
                            + (notStarted ? " and is not started yet" : ""));
            t.setDayRemindedOn(today);
            t.setDueSoonReminded(true);   // no second "due soon" for the same deadline
            sent++;
        }
        return sent;
    }
}
