package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.ticket.TicketRequest;
import com.decentdecor.workdesk.dto.ticket.TicketResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.EmployeeLeave;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.TaskTicket;
import com.decentdecor.workdesk.entity.enums.ActivityAction;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.entity.enums.TicketStatus;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.EmployeeMapper;
import com.decentdecor.workdesk.mapper.TaskMapper;
import com.decentdecor.workdesk.repository.EmployeeLeaveRepository;
import com.decentdecor.workdesk.repository.TaskTicketRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.ActivityLogger;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.util.Enums;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tickets on a task. When someone needs help with a task, they raise a ticket and assign it
 * to another person with a note.
 *
 * Who can do what:
 *  - anyone who can open the task (except view-only department admins) can raise a ticket while the task is open
 *  - the person it is assigned to can open the task, and is notified
 *  - the person it is assigned to has two choices, both with a reply:
 *      resolve   → the ticket is closed and the task goes back to its assignee to carry on
 *      mark done → they finish the task themselves: it moves to them and is done; it does not go back
 *  - the person who raised it, or a full admin, can also resolve (close) it
 *  - either way the ticket shows as done for the person it was raised to
 *  - raising, resolving and marking done are written to the task's history
 *  - a ticket can also be about a leave: the employee asks an admin to change or remove it (only admins can)
 */
@Service
public class TicketService {
    private static final int MAX_OPEN_PER_TASK = 20;

    private final TaskTicketRepository tickets;
    private final TaskService taskService;
    private final People people;
    private final ActivityLogger activity;
    private final NotificationService notifications;
    private final TaskMapper taskMapper;
    private final EmployeeMapper employeeMapper;
    private final OfficeTime time;
    private final EmployeeLeaveRepository leaves;

    public TicketService(TaskTicketRepository tickets, TaskService taskService, People people, ActivityLogger activity,
                         NotificationService notifications, TaskMapper taskMapper, EmployeeMapper employeeMapper,
                         OfficeTime time, EmployeeLeaveRepository leaves) {
        this.tickets = tickets;
        this.taskService = taskService;
        this.people = people;
        this.activity = activity;
        this.notifications = notifications;
        this.taskMapper = taskMapper;
        this.employeeMapper = employeeMapper;
        this.time = time;
        this.leaves = leaves;
    }

    /** GET /api/tasks/{id}/tickets — newest first. */
    @Transactional(readOnly = true)
    public List<TicketResponse> forTask(CurrentUser user, Long taskId) {
        Task t = taskService.visibleTask(taskId, people.me(user), false);
        return tickets.findByTaskIdOrderByCreatedAtDescIdDesc(t.getId()).stream().map(this::toResponse).toList();
    }

    /** GET /api/tickets?scope=assigned|raised|all&status=OPEN|RESOLVED — open tickets first, then newest. */
    @Transactional(readOnly = true)
    public List<TicketResponse> list(CurrentUser user, String scope, String status) {
        Employee me = people.me(user);
        String s = Texts.isBlank(scope) ? "assigned" : scope;
        List<TaskTicket> found = switch (s) {
            case "assigned" -> tickets.findByAssignedToIdOrderByCreatedAtDescIdDesc(me.getId());
            case "raised" -> tickets.findByRaisedByIdOrderByCreatedAtDescIdDesc(me.getId());
            case "all" -> {
                if (!me.isAdmin()) throw new ForbiddenException("Only admins can see every ticket");
                // department admins: tickets about people in their departments, and their own
                yield tickets.findAllByOrderByCreatedAtDescIdDesc().stream().filter(t -> manages(me, t)
                        || t.getRaisedBy().getId().equals(me.getId()) || t.getAssignedTo().getId().equals(me.getId())).toList();
            }
            default -> throw new BadRequestException("Unknown scope: " + s);
        };
        TicketStatus wanted = Texts.isBlank(status) ? null
                : Enums.parse(TicketStatus.class, status, null, "Choose a valid ticket status");
        return found.stream()
                .filter(t -> wanted == null || t.getStatus() == wanted)
                .sorted(Comparator.comparing((TaskTicket t) -> !t.isOpen()))   // stable: keeps newest first inside each group
                .map(this::toResponse).toList();
    }

    /** POST /api/tasks/{id}/tickets */
    @Transactional
    public TicketResponse raise(CurrentUser user, Long taskId, TicketRequest req) {
        Employee me = people.me(user);
        Task task = taskService.visibleTask(taskId, me, true);
        if (!task.getStatus().isOpen()) throw new BadRequestException("This task is closed, so a ticket cannot be raised on it");
        Employee to = people.activeAssignee(req.assignedToId());
        if (to.getId().equals(me.getId())) throw new BadRequestException("Choose someone else to raise the ticket to");
        long open = tickets.findByTaskIdOrderByCreatedAtDescIdDesc(task.getId()).stream().filter(TaskTicket::isOpen).count();
        if (open >= MAX_OPEN_PER_TASK) throw new BadRequestException("This task already has " + open + " open tickets");

        String note = req.note().trim();
        Instant now = time.now();
        TaskTicket ticket = new TaskTicket();
        ticket.setTask(task);
        ticket.setRaisedBy(me);
        ticket.setAssignedTo(to);
        ticket.setNote(note);
        ticket.setStatus(TicketStatus.OPEN);
        ticket.setCreatedAt(now);
        ticket = tickets.save(ticket);

        activity.note(task, me, ActivityAction.TICKET_RAISED, "Ticket to " + to.getFullName() + ": " + note);
        notifications.send(to, task, NotificationType.TICKET_RAISED,
                me.getFullName() + " raised a ticket to you on \"" + task.getTitle() + "\": " + note);
        return toResponse(ticket);
    }

    /**
     * POST /api/leaves/{id}/tickets — the person on leave asks an admin to change or remove it
     * (employees can add leave, but only admins edit or delete it).
     */
    @Transactional
    public TicketResponse raiseOnLeave(CurrentUser user, Long leaveId, TicketRequest req) {
        Employee me = people.me(user);
        EmployeeLeave leave = leaves.findById(leaveId).orElseThrow(() -> NotFoundException.of("Leave"));
        if (!leave.getEmployee().getId().equals(me.getId())) throw NotFoundException.of("Leave");
        Employee to = people.activeAssignee(req.assignedToId());
        if (!to.canManage(me)) throw new BadRequestException("Choose an admin who can change your leave");
        if (to.getId().equals(me.getId())) throw new BadRequestException("Choose someone else to raise the ticket to");

        String note = req.note().trim();
        String subject = "Leave " + LeaveService.range(leave);
        TaskTicket ticket = new TaskTicket();
        ticket.setLeave(leave);
        ticket.setSubject(subject);
        ticket.setRaisedBy(me);
        ticket.setAssignedTo(to);
        ticket.setNote(note);
        ticket.setStatus(TicketStatus.OPEN);
        ticket.setCreatedAt(time.now());
        ticket = tickets.save(ticket);
        notifications.send(to, null, NotificationType.TICKET_RAISED,
                me.getFullName() + " raised a ticket to you about their " + subject.toLowerCase(java.util.Locale.ROOT) + ": " + note);
        return toResponse(ticket);
    }

    /** Admin powers over a ticket: over the person whose task or leave it is about. */
    private static boolean manages(Employee me, TaskTicket t) {
        Employee about = t.getTask() != null ? t.getTask().getAssignee()
                : t.getLeave() != null ? t.getLeave().getEmployee() : null;
        return me.isFullAdmin() || (about != null && me.canManage(about));
    }

    /** POST /api/tickets/{id}/resolve */
    @Transactional
    public TicketResponse resolve(CurrentUser user, Long ticketId, String replyText) {
        Employee me = people.me(user);
        TaskTicket ticket = tickets.findById(ticketId).orElseThrow(() -> NotFoundException.of("Ticket"));
        boolean assigned = ticket.getAssignedTo().getId().equals(me.getId());
        boolean raiser = ticket.getRaisedBy().getId().equals(me.getId());
        if (!assigned && !raiser && !manages(me, ticket)) throw NotFoundException.of("Ticket");
        if (!ticket.isOpen()) throw new BadRequestException("This ticket is already resolved");

        String reply = replyText.trim();
        Instant now = time.now();
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setReply(reply);
        ticket.setResolvedBy(me);
        ticket.setResolvedAt(now);

        Task task = ticket.getTask();
        if (task != null) {
            activity.note(task, me, ActivityAction.TICKET_RESOLVED,
                    "Ticket from " + ticket.getRaisedBy().getFullName() + " resolved: " + reply);
        }
        String about = task != null ? "on \"" + task.getTitle() + "\"" : "about " + ticket.getSubject().toLowerCase(java.util.Locale.ROOT);
        String msg = me.getFullName() + " resolved the ticket " + about + ": " + reply;
        for (Employee e : List.of(ticket.getRaisedBy(), ticket.getAssignedTo())) {
            if (!e.getId().equals(me.getId())) notifications.send(e, task, NotificationType.TICKET_RESOLVED, msg);
        }
        return toResponse(ticket);
    }

    /**
     * POST /api/tickets/{id}/done — only the person the ticket is assigned to. They finish the task themselves:
     * it is assigned to them and marked done (no review), and the ticket is closed. It is not sent back.
     */
    @Transactional
    public TicketResponse markTaskDone(CurrentUser user, Long ticketId, String replyText) {
        Employee me = people.me(user);
        TaskTicket ticket = tickets.findById(ticketId).orElseThrow(() -> NotFoundException.of("Ticket"));
        if (!ticket.getAssignedTo().getId().equals(me.getId())) {
            if (ticket.getRaisedBy().getId().equals(me.getId()) || me.isAdmin()) {
                throw new ForbiddenException("Only the person this ticket is assigned to can mark the task done");
            }
            throw NotFoundException.of("Ticket");
        }
        if (!ticket.isOpen()) throw new BadRequestException("This ticket is already resolved");
        if (ticket.isAboutLeave()) throw new BadRequestException("This ticket is about a leave, not a task");
        Task task = taskService.visibleTask(ticket.getTask().getId(), me, true);
        if (!task.getStatus().isOpen()) throw new BadRequestException("This task is already closed");
        if (task.isWorkflowStep()) {
            throw new BadRequestException("This is an FMS step: resolve the ticket so the step's person can finish it");
        }

        String reply = replyText.trim();
        Instant now = time.now();
        Employee previous = task.getAssignee();
        TaskStatus from = task.getStatus();
        if (!previous.getId().equals(me.getId())) {
            if (task.getReviewer() != null && task.getReviewer().getId().equals(me.getId())) task.setReviewer(null);
            task.setAssignee(me);
            activity.note(task, me, ActivityAction.REASSIGNED,
                    "Took over from " + previous.getFullName() + " through a ticket");
        }
        task.setStatus(TaskStatus.COMPLETED);
        if (task.getStartedAt() == null) task.setStartedAt(now);
        if (task.getSubmittedAt() == null) task.setSubmittedAt(now);
        task.setCompletedAt(now);
        task.setUpdatedAt(now);
        activity.log(task, me, ActivityAction.STATUS_CHANGED, from, TaskStatus.COMPLETED, "Marked done through a ticket: " + reply);

        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setTaskDone(true);
        ticket.setReply(reply);
        ticket.setResolvedBy(me);
        ticket.setResolvedAt(now);
        activity.note(task, me, ActivityAction.TICKET_RESOLVED,
                "Ticket from " + ticket.getRaisedBy().getFullName() + " closed: " + me.getFullName() + " finished the task");

        String msg = me.getFullName() + " finished \"" + task.getTitle() + "\" through the ticket: " + reply;
        LinkedHashSet<Long> told = new LinkedHashSet<>(List.of(me.getId()));
        for (Employee e : List.of(ticket.getRaisedBy(), previous, task.getCreatedBy())) {
            if (told.add(e.getId())) notifications.send(e, task, NotificationType.TICKET_RESOLVED, msg);
        }
        return toResponse(ticket);
    }

    private TicketResponse toResponse(TaskTicket t) {
        return new TicketResponse(t.getId(), taskMapper.toRef(t.getTask()), t.getTask() == null ? null : t.getTask().getStatus().name(),
                employeeMapper.toRef(t.getRaisedBy()), employeeMapper.toRef(t.getAssignedTo()), t.getNote(),
                t.getStatus().name(), t.getReply(), employeeMapper.toRef(t.getResolvedBy()), t.getCreatedAt(), t.getResolvedAt(),
                t.isTaskDone(), t.getSubject(), t.getLeave() == null ? null : t.getLeave().getId());
    }
}
