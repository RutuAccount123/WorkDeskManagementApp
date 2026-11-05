package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.task.ActivityResponse;
import com.decentdecor.workdesk.dto.task.ChecklistTickRequest;
import com.decentdecor.workdesk.dto.task.TaskBatchApprovalRequest;
import com.decentdecor.workdesk.dto.task.TaskBatchRequest;
import com.decentdecor.workdesk.dto.task.TaskFilter;
import com.decentdecor.workdesk.dto.task.TaskRequest;
import com.decentdecor.workdesk.dto.task.TaskResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.TaskActivity;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.enums.ActivityAction;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.entity.json.ChecklistItem;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.TaskMapper;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.repository.TaskActivityRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.repository.TaskSpecifications;
import com.decentdecor.workdesk.repository.WorkflowRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.ActivityLogger;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.service.support.TaskRules;
import com.decentdecor.workdesk.service.support.WorkSchedule;
import com.decentdecor.workdesk.service.support.WorkflowAccess;
import com.decentdecor.workdesk.util.Enums;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tasks: list, create, edit, delete, status flow, comments and checklist.
 *
 * Who can do what:
 *  - anyone can assign work to anyone and choose who reviews it (not the person doing it)
 *  - the assignee starts and submits; the reviewer approves or sends back (with a note)
 *  - own work with no reviewer can be closed by the person themselves
 *  - whoever assigned it (or an admin) can edit, cancel or delete it
 *  - only people involved in a task (or admins) can open it; others get "Task not found"
 */
@Service
public class TaskService {
    private static final Set<String> SCOPES = Set.of("assigned", "created", "review", "all");

    private final TaskRepository tasks;
    private final TaskActivityRepository activities;
    private final WorkflowRepository workflows;
    private final EmployeeRepository employees;
    private final People people;
    private final ActivityLogger activity;
    private final NotificationService notifications;
    private final WorkflowEngine engine;
    private final WorkflowAccess workflowAccess;
    private final TaskMapper mapper;
    private final OfficeTime time;
    private final WorkSchedule workSchedule;
    private final TaskImageProcessor taskImages;

    public TaskService(TaskRepository tasks, TaskActivityRepository activities, WorkflowRepository workflows,
                       EmployeeRepository employees, People people, ActivityLogger activity,
                       NotificationService notifications, WorkflowEngine engine, WorkflowAccess workflowAccess,
                       TaskMapper mapper, OfficeTime time, WorkSchedule workSchedule, TaskImageProcessor taskImages) {
        this.tasks = tasks;
        this.activities = activities;
        this.workflows = workflows;
        this.employees = employees;
        this.people = people;
        this.activity = activity;
        this.notifications = notifications;
        this.engine = engine;
        this.workflowAccess = workflowAccess;
        this.mapper = mapper;
        this.time = time;
        this.workSchedule = workSchedule;
        this.taskImages = taskImages;
    }

    // ================================================================ list & read

    /** GET /api/tasks. Sorted by due date (no due date last). */
    @Transactional(readOnly = true)
    public List<TaskResponse> list(CurrentUser user, TaskFilter f) {
        Employee me = people.me(user);
        boolean admin = me.isAdmin();
        String scope = Texts.isBlank(f.scope()) ? (admin ? "all" : "assigned") : f.scope();
        if (!SCOPES.contains(scope)) throw new BadRequestException("Unknown scope: " + scope);

        Specification<Task> spec = switch (scope) {
            case "all" -> admin
                    ? (f.assigneeId() != null ? TaskSpecifications.assignedTo(f.assigneeId()) : TaskSpecifications.all())
                    : TaskSpecifications.involving(me.getId());
            case "created" -> TaskSpecifications.assignedByToOthers(me.getId());
            case "review" -> TaskSpecifications.reviewedBy(me.getId());
            // admins can look at one person's work (e.g. on the employee page)
            default -> TaskSpecifications.assignedTo(admin && f.assigneeId() != null ? f.assigneeId() : me.getId());
        };
        if (f.status() != null && !f.status().isEmpty()) {
            List<TaskStatus> statuses = f.status().stream()
                    .map(s -> Enums.parse(TaskStatus.class, s, null, "Choose a valid status")).toList();
            spec = spec.and(TaskSpecifications.statusIn(statuses));
        }
        if (!Texts.isBlank(f.priority())) {
            spec = spec.and(TaskSpecifications.priority(Enums.parse(Priority.class, f.priority(), null, "Choose a valid priority")));
        }
        Instant now = time.now();
        if (Boolean.TRUE.equals(f.overdue())) spec = spec.and(TaskSpecifications.overdue(now));
        if (!Texts.isBlank(f.q())) {
            if (f.q().length() > 200) throw new BadRequestException("Search text is too long");
            spec = spec.and(TaskSpecifications.search(f.q().trim()));
        }
        if (f.workFrom() != null) spec = spec.and(TaskSpecifications.workAtOrAfter(time.startOf(f.workFrom())));
        if (f.workTo() != null) spec = spec.and(TaskSpecifications.workBefore(time.startOf(f.workTo().plusDays(1))));

        List<Task> found = new ArrayList<>(tasks.findAll(spec));
        found.sort(Comparator.comparing(Task::getDueAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Task::getId));
        return mapper.toResponses(found, now);
    }

    @Transactional(readOnly = true)
    public TaskResponse get(CurrentUser user, Long id) {
        return mapper.toResponse(visibleTask(id, people.me(user), false), time.now(), true);
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> activity(CurrentUser user, Long id) {
        Task t = visibleTask(id, people.me(user), false);
        return activities.findByTaskIdOrderByCreatedAtAscIdAsc(t.getId()).stream().map(mapper::toActivity).toList();
    }

    // ================================================================ create

    /** POST /api/tasks */
    @Transactional
    public TaskResponse create(CurrentUser user, TaskRequest req) {
        return createOne(user, req, taskImages.normalize(req.image()));
    }

    private TaskResponse createOne(CurrentUser user, TaskRequest req, byte[] imageData) {
        Employee me = people.me(user);
        Employee assignee = req.assigneeId() == null ? me : people.activeAssignee(req.assigneeId());
        boolean self = assignee.getId().equals(me.getId());
        // default reviewer: the person assigning (own work: no review)
        Employee reviewer = people.pickReviewer(req.reviewerId(), assignee, self ? null : me);

        // own work can be added already started (or done, if nobody reviews it)
        TaskStatus status = TaskStatus.TODO;
        if (self && !Texts.isBlank(req.status())) {
            TaskStatus wanted = Enums.parse(TaskStatus.class, req.status(), TaskStatus.TODO, "Choose a valid status");
            boolean allowed = wanted == TaskStatus.IN_PROGRESS || (wanted == TaskStatus.COMPLETED && reviewer == null);
            if (allowed) status = wanted;
        }

        Instant now = time.now();
        validateEstimatedHours(req.estimatedHours());
        Task t = new Task();
        t.setTitle(req.title().trim());
        t.setDescription(Texts.trimToEmpty(req.description()));
        t.setImageData(imageData);
        t.setAssignee(assignee);
        t.setCreatedBy(me);
        t.setReviewer(reviewer);
        t.setPriority(Enums.parse(Priority.class, req.priority(), Priority.MEDIUM, "Choose a valid priority"));
        t.setStatus(status);
        t.setEstimatedHours(req.estimatedHours());
        t.setDueAt(req.estimatedHours() != null
                ? (status == TaskStatus.TODO ? null : workSchedule.deadline(now, req.estimatedHours()))
                : time.parseDateTime(req.dueAt()));
        t.setCreatedAt(now);
        t.setUpdatedAt(now);
        t.setStartedAt(status == TaskStatus.TODO ? null : now);
        t.setSubmittedAt(status == TaskStatus.COMPLETED ? now : null);
        t.setCompletedAt(status == TaskStatus.COMPLETED ? now : null);
        t.setLinkedWorkflow(linkableWorkflow(req.workflowId(), me));
        t = tasks.save(t);

        List<String> notes = new ArrayList<>();
        if (self) notes.add("Added own work");
        if (reviewer != null) notes.add("Reviewer: " + reviewer.getFullName());
        activity.log(t, me, ActivityAction.CREATED, null, status, notes.isEmpty() ? null : String.join(". ", notes));
        if (!self) notifications.send(assignee, t, NotificationType.TASK_ASSIGNED, me.getFullName() + " assigned you: " + t.getTitle());
        if (reviewer != null && !reviewer.getId().equals(me.getId())) {
            notifications.send(reviewer, t, NotificationType.REVIEW_ASSIGNED,
                    me.getFullName() + " made you the reviewer for \"" + t.getTitle() + "\" (" + assignee.getFullName() + ")");
        }
        return mapper.toResponse(t, now);
    }

    /** Creates independent copies in one transaction so the selection succeeds or fails together. */
    @Transactional
    public List<TaskResponse> createBatch(CurrentUser user, TaskBatchRequest request) {
        List<Long> assigneeIds = request.assigneeIds();
        if (new HashSet<>(assigneeIds).size() != assigneeIds.size()) {
            throw new BadRequestException("Choose each employee only once");
        }
        TaskRequest task = request.task();
        byte[] imageData = taskImages.normalize(task.image());
        return assigneeIds.stream()
                .map(assigneeId -> createOne(user, new TaskRequest(
                        task.title(), task.description(), assigneeId, task.reviewerId(), task.priority(),
                        task.dueAt(), task.status(), task.workflowId(), task.estimatedHours(), null), imageData))
                .toList();
    }

    /** Approves selected tasks atomically using the normal reviewer/admin status rules. */
    @Transactional
    public List<TaskResponse> approveBatch(CurrentUser user, TaskBatchApprovalRequest request) {
        List<Long> taskIds = request.taskIds();
        if (new HashSet<>(taskIds).size() != taskIds.size()) {
            throw new BadRequestException("Choose each task only once");
        }
        return taskIds.stream()
                .map(taskId -> changeStatus(user, taskId, TaskStatus.COMPLETED.name(), null))
                .toList();
    }

    // ================================================================ edit & delete

    /** PUT /api/tasks/{id} — admin, or whoever assigned / added it. */
    @Transactional
    public TaskResponse update(CurrentUser user, Long id, TaskRequest req) {
        Employee me = people.me(user);
        Task t = visibleTask(id, me, true);
        if (!TaskRules.canEdit(t, me)) throw new ForbiddenException("Only the person who assigned this task can change it");

        String title = req.title().trim();
        Priority priority = Enums.parse(Priority.class, req.priority(), t.getPriority(), "Choose a valid priority");
        validateEstimatedHours(req.estimatedHours());
        Instant due = req.estimatedHours() == null ? time.parseDateTime(req.dueAt())
                : t.getStartedAt() != null && t.getStatus() != TaskStatus.TODO && t.getStatus() != TaskStatus.REOPENED
                        ? deadline(t, t.getStartedAt(), req.estimatedHours()) : null;
        List<String> changes = new ArrayList<>();
        if (!t.getTitle().equals(title)) changes.add("title");
        if (t.getPriority() != priority) changes.add("priority " + t.getPriority() + " → " + priority);
        if (!Objects.equals(t.getDueAt(), due)) {
            changes.add("due date");
            t.setDueSoonReminded(false);   // a new due date gets fresh reminders
            t.setOverdueReminded(false);
        }
        if (!Objects.equals(t.getEstimatedHours(), req.estimatedHours())) changes.add("estimated effort");

        if (req.assigneeId() != null && !req.assigneeId().equals(t.getAssignee().getId())) {
            Employee previous = t.getAssignee();
            Employee next = people.activeAssignee(req.assigneeId());
            if (t.getReviewer() != null && t.getReviewer().getId().equals(next.getId())) t.setReviewer(null);
            t.setAssignee(next);
            activity.note(t, me, ActivityAction.REASSIGNED, "Reassigned from " + previous.getFullName() + " to " + next.getFullName());
            notifications.send(next, t, NotificationType.TASK_ASSIGNED, "New task: " + title);
        }

        // reviewer: empty = whoever assigned it (or no review for own work)
        Employee fallback = t.isSelfAdded() ? null : t.getCreatedBy();
        Employee reviewer = people.pickReviewer(req.reviewerId(), t.getAssignee(), fallback);
        Long oldReviewerId = t.effectiveReviewer() == null ? null : t.effectiveReviewer().getId();
        Long newReviewerId = reviewer == null ? null : reviewer.getId();
        if (!t.isWorkflowStep() && !Objects.equals(oldReviewerId, newReviewerId)) {
            t.setReviewer(reviewer);
            changes.add(reviewer == null ? "no review needed" : "reviewer → " + reviewer.getFullName());
            if (reviewer != null && !reviewer.getId().equals(me.getId())) {
                notifications.send(reviewer, t, NotificationType.REVIEW_ASSIGNED,
                        me.getFullName() + " made you the reviewer for \"" + t.getTitle() + "\"");
            }
        }

        t.setTitle(title);
        t.setDescription(Texts.trimToEmpty(req.description()));
        if (req.image() != null) t.setImageData(taskImages.normalize(req.image()));
        t.setPriority(priority);
        t.setDueAt(due);
        t.setEstimatedHours(req.estimatedHours());
        t.setUpdatedAt(time.now());
        if (!changes.isEmpty()) activity.note(t, me, ActivityAction.UPDATED, "Changed " + String.join(", ", changes));
        return mapper.toResponse(t, time.now());
    }

    /** DELETE /api/tasks/{id}. Its history and notifications go with it. */
    @Transactional
    public void delete(CurrentUser user, Long id) {
        Employee me = people.me(user);
        Task t = visibleTask(id, me, true);
        if (!TaskRules.canEdit(t, me)) throw new ForbiddenException();
        tasks.delete(t);
    }

    // ================================================================ status flow

    /** POST /api/tasks/{id}/status */
    @Transactional
    public TaskResponse changeStatus(CurrentUser user, Long id, String toValue, String comment) {
        Employee me = people.me(user);
        Task t = visibleTask(id, me, true);
        TaskStatus to = Enums.parse(TaskStatus.class, toValue, null, "Choose a valid status");
        TaskStatus from = t.getStatus();
        String note = Texts.trimToNull(comment);
        boolean mine = t.getAssignee().getId().equals(me.getId());
        Employee reviewer = t.effectiveReviewer();

        if (from == to) throw new BadRequestException("Task is already " + to);
        if (!TaskRules.canMove(t, me, to)) throw new ForbiddenException("You cannot move this task from " + from + " to " + to);
        checkWorkflowRules(t, me, from, to);
        if (to == TaskStatus.COMPLETED && mine && t.getChecklist().stream().anyMatch(c -> !c.done())) {
            throw new BadRequestException("Tick every checklist item first, then mark the step done");
        }
        if (to == TaskStatus.REOPENED && note == null) throw new BadRequestException("Please add a comment explaining what needs to be redone");

        Instant now = time.now();
        t.setStatus(to);
        t.setUpdatedAt(now);
        if (t.getEstimatedHours() != null
                && (to == TaskStatus.IN_PROGRESS || (to == TaskStatus.COMPLETED && t.getStartedAt() == null))) {
            t.setStartedAt(now);
            t.setDueAt(deadline(t, now, t.getEstimatedHours()));
            t.setDueSoonReminded(false);
            t.setOverdueReminded(false);
        } else if (t.getEstimatedHours() != null && (to == TaskStatus.TODO || to == TaskStatus.REOPENED)) {
            t.setDueAt(null);
            t.setDueSoonReminded(false);
            t.setOverdueReminded(false);
        } else if (to == TaskStatus.IN_PROGRESS && t.getStartedAt() == null) {
            t.setStartedAt(now);
        }
        if (to == TaskStatus.SUBMITTED) t.setSubmittedAt(now);
        if (to == TaskStatus.COMPLETED) {
            t.setCompletedAt(now);
            if (t.getSubmittedAt() == null) t.setSubmittedAt(now);
        }
        // back to work (sent back, reopened, "not done yet"): it is no longer finished
        if (to == TaskStatus.REOPENED || to == TaskStatus.TODO || to == TaskStatus.IN_PROGRESS) {
            t.setCompletedAt(null);
            t.setSubmittedAt(null);
        }
        activity.log(t, me, ActivityAction.STATUS_CHANGED, from, to, note);

        if (t.isWorkflowStep()) engine.onStepStatusChanged(t, to);
        notifyStatusChange(t, me, to, mine, reviewer, note);
        return mapper.toResponse(t, now);
    }

    // ================================================================ comments & checklist

    /** POST /api/tasks/{id}/comments — everyone involved is told, except the writer. */
    @Transactional
    public ActivityResponse comment(CurrentUser user, Long id, String comment) {
        Employee me = people.me(user);
        Task t = visibleTask(id, me, false);
        String text = comment.trim();
        TaskActivity a = activity.note(t, me, ActivityAction.COMMENTED, text);
        String msg = me.getFullName() + " commented on \"" + t.getTitle() + "\": " + text;
        for (Employee e : involvedPeople(t)) {
            if (!e.getId().equals(me.getId())) notifications.send(e, t, NotificationType.COMMENT, msg);
        }
        return mapper.toActivity(a);
    }

    /** POST /api/tasks/{id}/checklist — tick or untick one How step of an FMS step. */
    @Transactional
    public TaskResponse tick(CurrentUser user, Long id, ChecklistTickRequest req) {
        Employee me = people.me(user);
        Task t = visibleTask(id, me, true);
        if (!t.getAssignee().getId().equals(me.getId()) && !me.isAdmin()) {
            throw new ForbiddenException("Only the person doing this step can tick its checklist");
        }
        if (!t.getStatus().isOpen()) throw new BadRequestException("This task is closed");
        int index = req.index();
        if (index < 0 || index >= t.getChecklist().size()) throw NotFoundException.of("Checklist item");

        List<ChecklistItem> list = new ArrayList<>(t.getChecklist());
        ChecklistItem old = list.get(index);
        list.set(index, new ChecklistItem(old.text(), req.done(), req.done() ? time.now().toString() : null));
        t.setChecklist(list);   // a new list, so the change is saved
        t.setUpdatedAt(time.now());
        activity.note(t, me, ActivityAction.UPDATED, (req.done() ? "Ticked: " : "Unticked: ") + old.text());
        return mapper.toResponse(t, time.now());
    }

    // ================================================================ inside

    /** A task the person may open (admins: any). lock = lock the row for changing. Otherwise "Task not found". */
    private Task visibleTask(Long id, Employee me, boolean lock) {
        Task t = (lock ? tasks.findByIdForUpdate(id) : tasks.findById(id)).orElseThrow(() -> NotFoundException.of("Task"));
        if (!TaskRules.canSee(t, me)) throw NotFoundException.of("Task");
        return t;
    }

    /** Extra rules for FMS steps. */
    private void checkWorkflowRules(Task t, Employee me, TaskStatus from, TaskStatus to) {
        WorkflowRun run = t.getWorkflowRun();
        if (run == null) return;
        if (to == TaskStatus.CANCELLED && !me.isAdmin() && !t.getCreatedBy().getId().equals(me.getId())) {
            throw new ForbiddenException("Only the workflow owner can stop it");
        }
        if (run.getCurrentStep() == 1 && (to == TaskStatus.IN_PROGRESS || to == TaskStatus.COMPLETED) && run.needsForm()) {
            throw new BadRequestException("Fill the workflow form first. The work starts after the form is filled.");
        }
        if (run.getStepProgress().isEmpty() && from == TaskStatus.COMPLETED
                && tasks.existsByWorkflowRunIdAndWorkflowStep(run.getId(), t.getWorkflowStep() + 1)) {
            throw new BadRequestException("The next step has already started, so this step stays done");
        }
    }

    private void notifyStatusChange(Task t, Employee me, TaskStatus to, boolean mine, Employee reviewer, String note) {
        if (to == TaskStatus.SUBMITTED && reviewer != null) {
            String msg = me.getFullName() + " submitted \"" + t.getTitle() + "\" for your review";
            if (reviewer.isActive()) {
                notifications.send(reviewer, t, NotificationType.TASK_SUBMITTED, msg);
            } else {   // the reviewer has left: admins take over
                employees.findByRoleAndActiveTrue(Role.ADMIN).forEach(a -> notifications.send(a, t, NotificationType.TASK_SUBMITTED, msg));
            }
        }
        if (to == TaskStatus.COMPLETED && !mine) {
            notifications.send(t.getAssignee(), t, NotificationType.TASK_APPROVED, me.getFullName() + " approved: " + t.getTitle());
            Employee creator = t.getCreatedBy();
            if (!creator.getId().equals(me.getId()) && !creator.getId().equals(t.getAssignee().getId())) {
                notifications.send(creator, t, NotificationType.TASK_APPROVED,
                        me.getFullName() + " approved \"" + t.getTitle() + "\" (" + t.getAssignee().getFullName() + ")");
            }
        }
        if (to == TaskStatus.REOPENED) {
            notifications.send(t.getAssignee(), t, NotificationType.TASK_REOPENED,
                    me.getFullName() + " sent back \"" + t.getTitle() + "\": " + note);
        }
    }

    /** Assignee, assigner and reviewer, each once. */
    private List<Employee> involvedPeople(Task t) {
        LinkedHashSet<Long> seen = new LinkedHashSet<>();
        List<Employee> out = new ArrayList<>();
        for (Employee e : new Employee[] {t.getAssignee(), t.getCreatedBy(), t.effectiveReviewer()}) {
            if (e != null && seen.add(e.getId())) out.add(e);
        }
        return out;
    }

    /** "Save form data in existing FMS": only an FMS the person can see. */
    private Workflow linkableWorkflow(Long workflowId, Employee me) {
        if (workflowId == null) return null;
        Workflow w = workflows.findById(workflowId).orElse(null);
        if (w == null || !workflowAccess.canSee(w, me)) throw new BadRequestException("Choose an FMS you can access");
        return w;
    }

    private Instant deadline(Task task, Instant startedAt, BigDecimal estimatedHours) {
        WorkflowRun run = task.getWorkflowRun();
        return run == null
                ? workSchedule.deadline(startedAt, estimatedHours)
                : workSchedule.deadline(startedAt, estimatedHours, run.getStartTime(), run.getEndTime());
    }

    private void validateEstimatedHours(BigDecimal estimatedHours) {
        if (estimatedHours != null
                && (estimatedHours.compareTo(new BigDecimal("0.25")) < 0
                || estimatedHours.compareTo(new BigDecimal("24")) > 0)) {
            throw new BadRequestException("Estimated hours must be between 0.25 and 24");
        }
    }
}
