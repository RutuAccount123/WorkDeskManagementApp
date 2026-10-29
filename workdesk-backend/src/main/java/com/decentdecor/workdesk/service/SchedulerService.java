package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.util.OfficeTime;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The background jobs (called by scheduler/SchedulerJobs every few minutes):
 *  1. make daily & weekly task copies for the next 7 days
 *  2. start today's scheduled FMS runs
 *  3. send "due soon" (next 24 h) and "overdue" reminders, once per task
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
        int sent = 0;
        for (Task t : tasks.findNeedingReminder(TaskStatus.OPEN, now, soon)) {
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
                notifications.send(t.getAssignee(), t, NotificationType.DUE_SOON,
                        "Reminder: \"" + t.getTitle() + "\" is due " + time.friendly(t.getDueAt()));
                t.setDueSoonReminded(true);
            }
            sent++;
        }
        return sent;
    }
}
