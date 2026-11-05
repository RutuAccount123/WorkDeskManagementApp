package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.entity.RecurringTemplate;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.ActivityAction;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.RepeatFrequency;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.repository.RecurringTemplateRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.service.support.ActivityLogger;
import com.decentdecor.workdesk.service.support.WorkingDays;
import com.decentdecor.workdesk.util.OfficeTime;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Duration;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Makes the copies of recurring tasks.
 * Every active repeating task gets its matching normal Task in the next 7 days
 * (so they show in the Week / Month views). Never on Sundays or office holidays, never twice.
 */
@Service
public class RecurringGenerator {
    /** Copies are made this many days ahead. */
    public static final int DAYS_AHEAD = 7;

    private final RecurringTemplateRepository templates;
    private final TaskRepository tasks;
    private final WorkingDays workingDays;
    private final ActivityLogger activity;
    private final NotificationService notifications;
    private final OfficeTime time;

    public RecurringGenerator(RecurringTemplateRepository templates, TaskRepository tasks, WorkingDays workingDays,
                              ActivityLogger activity, NotificationService notifications, OfficeTime time) {
        this.templates = templates;
        this.tasks = tasks;
        this.workingDays = workingDays;
        this.activity = activity;
        this.notifications = notifications;
        this.time = time;
    }

    /** Scheduler: fill in every active repeating task. Returns how many copies were made. */
    @Transactional
    public int fillAll() {
        int made = 0;
        for (RecurringTemplate tpl : templates.findByActiveTrue()) made += fill(tpl);
        return made;
    }

    /** Fill in one repeating task for the next 7 days. */
    @Transactional
    public int fill(RecurringTemplate tpl) {
        if (!tpl.isActive() || !tpl.getAssignee().isActive()) return 0;
        int made = 0;
        LocalDate today = time.today();
        for (int i = 0; i < DAYS_AHEAD; i++) {
            LocalDate day = today.plusDays(i);
            if (runsOn(tpl, day) && !hasCopyOn(tpl, day)) {
                makeCopy(tpl, day);
                made++;
            }
        }
        return made;
    }

    public boolean runsOn(RecurringTemplate tpl, LocalDate day) {
        return workingDays.runsOn(tpl.getFrequency(), tpl.getDayOfWeek(), tpl.getStartDate(), day);
    }

    public boolean hasCopyOn(RecurringTemplate tpl, LocalDate day) {
        return tasks.existsCopyBetween(tpl.getId(), time.startOf(day), time.startOf(day.plusDays(1)));
    }

    /** Makes the copy for one day. Only today's copy is announced; future ones appear quietly in the calendar. */
    @Transactional
    public Task makeCopy(RecurringTemplate tpl, LocalDate day) {
        Instant now = time.now();
        boolean selfOwned = tpl.isSelfOwned();
        Task t = new Task();
        t.setTitle(tpl.getTitle());
        t.setDescription(tpl.getDescription());
        t.setImageData(tpl.getImageData());
        t.setAssignee(tpl.getAssignee());
        t.setCreatedBy(tpl.getCreatedBy());
        t.setReviewer(tpl.getReviewer());
        t.setPriority(tpl.getPriority());
        t.setStatus(TaskStatus.TODO);
        Instant scheduledAt = tpl.getScheduledTime() == null ? null : time.at(day, tpl.getScheduledTime());
        t.setScheduledAt(scheduledAt);
        t.setDueAt(scheduledAt == null
                ? time.at(day, tpl.getDueTime())
                : scheduledAt.plus(Duration.ofMinutes(tpl.getDurationMinutes())));
        t.setEstimatedHours(tpl.getEstimatedHours());
        t.setCreatedAt(now);
        t.setUpdatedAt(now);
        t.setRecurringTemplate(tpl);
        t.setLinkedWorkflow(tpl.getWorkflow());
        t = tasks.save(t);
        String recurrence = switch (tpl.getFrequency()) {
            case DAILY -> "Daily task";
            case WEEKLY -> "Weekly task";
            case MONTHLY -> "Monthly task";
            case YEARLY -> "Yearly task";
        };
        activity.log(t, null, ActivityAction.AUTO_GENERATED, null, TaskStatus.TODO, recurrence);
        if (day.equals(time.today()) && !selfOwned && scheduledAt == null) {
            notifications.send(tpl.getAssignee(), t, NotificationType.TASK_ASSIGNED,
                    "New " + tpl.getFrequency().name().toLowerCase(Locale.ROOT) + " task: " + t.getTitle());
        }
        if (tpl.getLastGeneratedOn() == null || day.isAfter(tpl.getLastGeneratedOn())) tpl.setLastGeneratedOn(day);
        return t;
    }

    /** Remove future copies nobody has started (when the repeating task is paused, changed or deleted). */
    @Transactional
    public void removeFutureCopies(Long templateId) {
        tasks.deleteCopiesFrom(templateId, TaskStatus.TODO, time.startOf(time.today().plusDays(1)));
    }
}
