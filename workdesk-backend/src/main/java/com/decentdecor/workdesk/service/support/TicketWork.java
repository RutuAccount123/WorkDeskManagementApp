package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.TaskTicket;
import com.decentdecor.workdesk.entity.enums.ActivityAction;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.entity.enums.TicketStatus;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.service.NotificationService;
import com.decentdecor.workdesk.util.OfficeTime;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import org.springframework.stereotype.Component;

/**
 * A ticket is also work for the person it is raised to, so it becomes a task of their own ("Ticket: …"):
 * it shows in their task list and calendar and counts in their performance.
 *  - resolving the ticket closes that task: done when they resolve it, cancelled when someone else closes the ticket
 *  - marking that task done resolves the ticket (their note is the answer)
 *  - when they take over and finish the original task through the ticket, the ticket task is not needed and is removed
 */
@Component
public class TicketWork {
    private static final int MAX_TITLE = 200;
    private static final LocalTime END_OF_DAY = LocalTime.of(18, 0);

    private final TaskRepository tasks;
    private final ActivityLogger activity;
    private final NotificationService notifications;
    private final OfficeTime time;

    public TicketWork(TaskRepository tasks, ActivityLogger activity, NotificationService notifications, OfficeTime time) {
        this.tasks = tasks;
        this.activity = activity;
        this.notifications = notifications;
        this.time = time;
    }

    /** Makes the ticket's task for the person it was raised to. aboutDue: due time of the task it is about, if any. */
    public Task create(TaskTicket ticket, String about, Priority priority, Instant aboutDue) {
        Instant now = time.now();
        Task t = new Task();
        String title = "Ticket: " + about;
        t.setTitle(title.length() > MAX_TITLE ? title.substring(0, MAX_TITLE) : title);
        t.setDescription(ticket.getRaisedBy().getFullName() + " raised a ticket to you: " + ticket.getNote());
        t.setAssignee(ticket.getAssignedTo());
        t.setCreatedBy(ticket.getRaisedBy());
        t.setReviewer(null);   // answering the ticket is the check
        t.setPriority(priority == null ? Priority.MEDIUM : priority);
        t.setStatus(TaskStatus.TODO);
        t.setDueAt(due(aboutDue, now));
        t.setCreatedAt(now);
        t.setUpdatedAt(now);
        t.setFromTicket(ticket);
        t.setDueSoonReminded(true);   // the "ticket raised" notice already tells them
        t = tasks.save(t);
        activity.log(t, ticket.getRaisedBy(), ActivityAction.CREATED, null, TaskStatus.TODO,
                "Ticket from " + ticket.getRaisedBy().getFullName());
        return t;
    }

    /** Due with the task it is about, if that is still ahead; otherwise by the end of today (or in an hour, if that has passed). */
    private Instant due(Instant aboutDue, Instant now) {
        if (aboutDue != null && aboutDue.isAfter(now)) return aboutDue;
        Instant endOfDay = time.at(time.today(), END_OF_DAY);
        return endOfDay.isAfter(now) ? endOfDay : now.plus(Duration.ofHours(1));
    }

    /** The ticket was resolved: its task is done when its own person resolved it, cancelled when someone else closed it. */
    public void onResolved(TaskTicket ticket, Employee by, String reply) {
        Task t = tasks.findFirstByFromTicketId(ticket.getId()).orElse(null);
        if (t == null || !t.getStatus().isOpen()) return;
        boolean theirs = by.getId().equals(t.getAssignee().getId());
        TaskStatus from = t.getStatus();
        TaskStatus to = theirs ? TaskStatus.COMPLETED : TaskStatus.CANCELLED;
        Instant now = time.now();
        t.setStatus(to);
        t.setUpdatedAt(now);
        if (theirs) {
            if (t.getStartedAt() == null) t.setStartedAt(now);
            t.setSubmittedAt(now);
            t.setCompletedAt(now);
        }
        activity.log(t, by, ActivityAction.STATUS_CHANGED, from, to,
                theirs ? "Ticket resolved: " + reply : "Ticket closed by " + by.getFullName() + ": " + reply);
    }

    /** They finished the original task through the ticket, so that task already records the work. */
    public void removeFor(TaskTicket ticket) {
        tasks.findFirstByFromTicketId(ticket.getId()).ifPresent(tasks::delete);
    }

    /** The ticket's task was marked done: the ticket is resolved, with their note as the answer. */
    public void onTaskDone(Task t, Employee me, String note) {
        TaskTicket ticket = t.getFromTicket();
        if (ticket == null || !ticket.isOpen()) return;
        String reply = note == null || note.isBlank() ? "Done" : note.trim();
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setReply(reply);
        ticket.setResolvedBy(me);
        ticket.setResolvedAt(time.now());
        Task about = ticket.getTask();
        if (about != null) {
            activity.note(about, me, ActivityAction.TICKET_RESOLVED,
                    "Ticket from " + ticket.getRaisedBy().getFullName() + " resolved: " + reply);
        }
        if (!ticket.getRaisedBy().getId().equals(me.getId())) {
            String what = about != null ? "on \"" + about.getTitle() + "\"" : "about " + ticket.getSubject().toLowerCase(java.util.Locale.ROOT);
            notifications.send(ticket.getRaisedBy(), about, NotificationType.TICKET_RESOLVED,
                    me.getFullName() + " resolved the ticket " + what + ": " + reply);
        }
    }
}
