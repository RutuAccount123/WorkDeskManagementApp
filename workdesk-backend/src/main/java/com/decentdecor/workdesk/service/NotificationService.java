package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.common.CountResponse;
import com.decentdecor.workdesk.dto.notification.NotificationResponse;
import com.decentdecor.workdesk.dto.report.TodayCounts;
import com.decentdecor.workdesk.entity.DigestLog;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Notification;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.NotificationMapper;
import com.decentdecor.workdesk.repository.DigestLogRepository;
import com.decentdecor.workdesk.repository.NotificationRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.service.support.TodayWork;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notifications (the bell panel): sending them, listing them, marking them read,
 * and the once-a-day summary each person gets as their first notification of the day.
 */
@Service
public class NotificationService {
    private static final int MAX_LIST = 50;

    private final NotificationRepository notifications;
    private final DigestLogRepository digests;
    private final TaskRepository tasks;
    private final NotificationMapper mapper;
    private final People people;
    private final OfficeTime time;

    public NotificationService(NotificationRepository notifications, DigestLogRepository digests, TaskRepository tasks,
                               NotificationMapper mapper, People people, OfficeTime time) {
        this.notifications = notifications;
        this.digests = digests;
        this.tasks = tasks;
        this.mapper = mapper;
        this.people = people;
        this.time = time;
    }

    // ------------------------------------------------------------ used by other services

    /** Sends a notification. Inactive people get nothing. task may be null. */
    public void send(Employee recipient, Task task, NotificationType type, String message) {
        if (recipient == null || !recipient.isActive()) return;
        Notification n = new Notification();
        n.setRecipient(recipient);
        n.setTask(task);
        n.setType(type);
        n.setMessage(message);
        n.setRead(false);
        n.setCreatedAt(time.now());
        notifications.save(n);
    }

    // ------------------------------------------------------------ API

    @Transactional
    public List<NotificationResponse> list(CurrentUser user, Integer limit) {
        Employee me = people.me(user);
        ensureDailySummary(me);
        int size = limit == null ? MAX_LIST : Math.max(1, Math.min(limit, MAX_LIST));
        return notifications.findByRecipientIdOrderByCreatedAtDescIdDesc(me.getId(), Pageable.ofSize(size))
                .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public CountResponse unreadCount(CurrentUser user) {
        Employee me = people.me(user);
        ensureDailySummary(me);
        return new CountResponse(notifications.countByRecipientIdAndReadFalse(me.getId()));
    }

    @Transactional
    public void markRead(CurrentUser user, Long id) {
        Notification n = notifications.findByIdAndRecipientId(id, user.id())
                .orElseThrow(() -> NotFoundException.of("Notification"));
        n.setRead(true);
    }

    @Transactional
    public void markAllRead(CurrentUser user) {
        notifications.markAllRead(user.id());
    }

    // ------------------------------------------------------------ daily summary

    /** Once a day each person gets a summary of their day. */
    void ensureDailySummary(Employee me) {
        LocalDate today = time.today();
        if (digests.existsById(new DigestLog.Key(me.getId(), today))) return;
        digests.save(new DigestLog(me.getId(), today));
        send(me, null, NotificationType.DAILY_DIGEST, me.isAdmin() ? adminSummary(today) : employeeSummary(me, today));
    }

    private String adminSummary(LocalDate today) {
        Instant now = time.now();
        List<Task> open = tasks.findAll().stream().filter(t -> t.getStatus().isOpen()).toList();
        long review = open.stream().filter(t -> t.getStatus() == TaskStatus.SUBMITTED).count();
        long late = open.stream().filter(t -> t.isOverdue(now)).count();
        long due = open.stream().filter(t -> time.dayOf(t.workAt()).equals(today)).count();
        return "Today's summary for the team: " + due + " " + Texts.plural(due, "task") + " due, " + late + " overdue, "
                + review + " waiting for your review.";
    }

    private String employeeSummary(Employee me, LocalDate today) {
        Instant now = time.now();
        List<Task> mine = tasks.findByAssigneeId(me.getId());
        TodayCounts c = TodayWork.count(TodayWork.on(mine, time.startOf(today), time.startOf(today.plusDays(1))));
        long late = mine.stream().filter(t -> t.isOverdue(now)).count();
        String msg = c.total() > 0
                ? "Your work today: you have " + c.total() + " " + Texts.plural(c.total(), "task") + ": " + c.todo() + " to do, "
                  + c.inProgress() + " in progress, " + c.done() + " done."
                : "Nothing is scheduled for you today. Add the work you plan to do.";
        if (late > 0) msg += " " + late + " overdue " + (late == 1 ? "task needs" : "tasks need") + " attention.";
        return msg;
    }
}
