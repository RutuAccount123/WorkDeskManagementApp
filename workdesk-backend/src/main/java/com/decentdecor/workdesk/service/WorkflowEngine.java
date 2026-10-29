package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.enums.ActivityAction;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.RunStatus;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.entity.enums.WorkflowFrequency;
import com.decentdecor.workdesk.entity.json.ChecklistItem;
import com.decentdecor.workdesk.entity.json.WorkflowStep;
import com.decentdecor.workdesk.entity.json.WorkflowStepProgress;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.repository.WorkflowRepository;
import com.decentdecor.workdesk.repository.WorkflowRunRepository;
import com.decentdecor.workdesk.service.support.ActivityLogger;
import com.decentdecor.workdesk.service.support.FormValidator;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.service.support.WorkingDays;
import com.decentdecor.workdesk.service.support.WorkSchedule;
import com.decentdecor.workdesk.util.Enums;
import com.decentdecor.workdesk.util.OfficeTime;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * How an FMS run moves forward.
 *  - Starting a run copies the steps and form, and assigns one task to step 1.
 *  - A scheduled run waits until step 1's person fills the form; "Start new" comes with the form filled.
 *  - When a step starts, its estimate is scheduled within the run's work window and carries over
 *    to the next valid workday when needed.
 *  - When the last step is done the run is DONE; cancelling a step stops the run.
 * Called by WorkflowService, TaskService and SchedulerService (always inside their transaction).
 */
@Service
public class WorkflowEngine {
    private static final Logger log = LoggerFactory.getLogger(WorkflowEngine.class);

    private final WorkflowRepository workflows;
    private final WorkflowRunRepository runs;
    private final TaskRepository tasks;
    private final EmployeeRepository employees;
    private final People people;
    private final ActivityLogger activity;
    private final NotificationService notifications;
    private final WorkingDays workingDays;
    private final OfficeTime time;
    private final WorkSchedule workSchedule;

    public WorkflowEngine(WorkflowRepository workflows, WorkflowRunRepository runs, TaskRepository tasks,
                          EmployeeRepository employees, People people, ActivityLogger activity,
                          NotificationService notifications, WorkingDays workingDays, OfficeTime time,
                          WorkSchedule workSchedule) {
        this.workflows = workflows;
        this.runs = runs;
        this.tasks = tasks;
        this.employees = employees;
        this.people = people;
        this.activity = activity;
        this.notifications = notifications;
        this.workingDays = workingDays;
        this.time = time;
        this.workSchedule = workSchedule;
    }

    /** Does this FMS start by itself on this day? (never ON_DEMAND, never Sundays or holidays) */
    public boolean runsOn(Workflow w, LocalDate day) {
        if (w.getFrequency() == WorkflowFrequency.ON_DEMAND) return false;
        return workingDays.runsOn(w.getFrequency() == WorkflowFrequency.DAILY, w.getDayOfWeek(), day);
    }

    /** Every step's person is still active (otherwise the scheduler skips it). */
    public boolean allStepPeopleActive(List<WorkflowStep> steps) {
        List<Long> ids = steps.stream().map(WorkflowStep::assigneeId).filter(Objects::nonNull).distinct().toList();
        long active = employees.findAllById(ids).stream().filter(Employee::isActive).count();
        return active == ids.size() && steps.stream().allMatch(s -> s.assigneeId() != null);
    }

    /**
     * Starts a run and assigns step 1.
     * formData null = a scheduled run (step 1's person fills the form first).
     */
    @Transactional
    public WorkflowRun startRun(Workflow w, LocalDate day, Map<String, Object> formData, Employee by, boolean manual, Task sourceTask) {
        if (formData != null) FormValidator.clean(w.getFormFields(), formData);   // check before creating anything
        WorkflowRun run = new WorkflowRun();
        run.setWorkflow(w);
        run.setName(w.getName());
        run.setRunDate(day);
        run.setCreatedBy(w.getCreatedBy());
        run.setStartTime(w.getStartTime());
        run.setEndTime(w.getEndTime());
        run.setSteps(new ArrayList<>(w.getSteps()));
        run.setFormFields(new ArrayList<>(w.getFormFields()));
        run.setStepProgress(w.getSteps().stream()
                .map(step -> new WorkflowStepProgress("WAITING", null, null)).toList());
        run.setNumber((int) runs.countByWorkflowIdAndRunDate(w.getId(), day) + 1);
        run.setManual(manual);
        run.setSourceTask(sourceTask != null ? sourceTask : w.getSourceTask());
        run.setStatus(RunStatus.RUNNING);
        run.setStartedAt(time.now());
        run = runs.save(run);

        Task step1 = createStepTask(run, 1);
        if (formData != null) saveForm(run, step1, formData, by);
        w.setLastRunOn(day);
        return run;
    }

    /** Stores the run's form answers. Filling the form starts step 1. */
    @Transactional
    public void saveForm(WorkflowRun run, Task step1, Map<String, Object> formData, Employee by) {
        run.setFormData(FormValidator.clean(run.getFormFields(), formData));
        run.setFormFilledBy(by);
        run.setFormFilledAt(time.now());
        Task t = step1 != null ? step1 : tasks.findByWorkflowRunIdAndWorkflowStep(run.getId(), 1).orElse(null);
        if (t != null && t.getStatus() == TaskStatus.TODO) {
            Instant startedAt = time.now();
            t.setStatus(TaskStatus.IN_PROGRESS);
            t.setStartedAt(startedAt);
            if (t.getEstimatedHours() != null) {
                t.setDueAt(workSchedule.deadline(startedAt, t.getEstimatedHours(), run.getStartTime(), run.getEndTime()));
                t.setDueSoonReminded(false);
                t.setOverdueReminded(false);
            }
            t.setUpdatedAt(startedAt);
            activity.log(t, by, ActivityAction.STATUS_CHANGED, TaskStatus.TODO, TaskStatus.IN_PROGRESS, "Filled the workflow form. Work started.");
            updateProgress(run, run.getCurrentStep(), TaskStatus.IN_PROGRESS, t.getDueAt(), null);
        }
    }

    /** Called after a step's task changed status. Done → the next step starts; cancelled → the run stops. */
    @Transactional
    public void onStepStatusChanged(Task t, TaskStatus to) {
        WorkflowRun run = runs.findByIdForUpdate(t.getWorkflowRun().getId()).orElse(null);
        if (run == null) return;
        int step = t.getWorkflowStep();
        int total = run.totalSteps();
        if (!run.getStepProgress().isEmpty()) {
            updateProgress(run, step, to, t.getDueAt(), to == TaskStatus.COMPLETED ? time.now() : null);
        }
        if (to == TaskStatus.COMPLETED) {
            if (step < total) {
                if (!run.getStepProgress().isEmpty()
                        || !tasks.existsByWorkflowRunIdAndWorkflowStep(run.getId(), step + 1)) {
                    createStepTask(run, step + 1, t);
                }
            } else {
                finishRun(run, t, total);
            }
        } else if (to == TaskStatus.CANCELLED) {
            run.setStatus(RunStatus.STOPPED);
            run.setFinishedAt(time.now());
        } else if ((to == TaskStatus.TODO || to == TaskStatus.IN_PROGRESS || to == TaskStatus.REOPENED)
                && (run.getStatus() == RunStatus.STOPPED || run.getStatus() == RunStatus.DONE)) {
            run.setStatus(RunStatus.RUNNING);
            run.setFinishedAt(null);
        }
    }

    /** Scheduler: start today's run of every active FMS that runs today. Returns how many started. */
    @Transactional
    public int startScheduledRunsForToday() {
        LocalDate today = time.today();
        int started = 0;
        for (Workflow w : workflows.findByActiveTrue()) {
            if (!runsOn(w, today)) continue;
            if (runs.existsByWorkflowIdAndRunDate(w.getId(), today)) continue;
            if (!allStepPeopleActive(w.getSteps())) {
                log.warn("FMS '{}' not started today: a step's person is inactive", w.getName());
                continue;
            }
            startRun(w, today, null, null, false, null);
            started++;
        }
        return started;
    }

    // ------------------------------------------------------------ inside

    /** Assigns one step (1-based); the estimate starts counting when the assignee starts work. */
    Task createStepTask(WorkflowRun run, int stepNo) {
        return createStepTask(run, stepNo, null);
    }

    private Task createStepTask(WorkflowRun run, int stepNo, Task existing) {
        WorkflowStep step = run.getSteps().get(stepNo - 1);
        Employee assignee = people.get(step.assigneeId());
        Instant now = time.now();
        Task t = existing;
        if (t == null && !run.getStepProgress().isEmpty()) {
            t = tasks.findByWorkflowRunIdOrderByWorkflowStepAsc(run.getId()).stream().findFirst().orElse(null);
        }
        boolean created = t == null;
        if (created) t = new Task();
        t.setTitle(step.title());
        t.setDescription(step.how() == null ? "" : step.how());
        t.setAssignee(assignee);
        t.setCreatedBy(run.getCreatedBy());
        t.setReviewer(null);   // steps need no review
        t.setPriority(Enums.parse(Priority.class, step.priority(), Priority.MEDIUM, "Choose a valid priority"));
        t.setStatus(TaskStatus.TODO);
        t.setEstimatedHours(step.hours());
        t.setDueAt(null);
        if (created) t.setCreatedAt(now);
        t.setUpdatedAt(now);
        t.setWorkflowRun(run);
        t.setWorkflowStep(stepNo);
        t.setStartedAt(null);
        t.setSubmittedAt(null);
        t.setCompletedAt(null);
        t.setDueSoonReminded(false);
        t.setOverdueReminded(false);
        List<ChecklistItem> checklist = new ArrayList<>();
        if (step.checklist() != null) step.checklist().forEach(text -> checklist.add(ChecklistItem.notDone(text)));
        t.setChecklist(checklist);
        t = tasks.save(t);
        run.setCurrentStep(stepNo);
        if (!run.getStepProgress().isEmpty()) {
            updateProgress(run, stepNo, TaskStatus.TODO, t.getDueAt(), null);
        }

        int total = run.totalSteps();
        activity.log(t, null, created ? ActivityAction.AUTO_GENERATED : ActivityAction.STATUS_CHANGED,
                created ? null : TaskStatus.COMPLETED, TaskStatus.TODO,
                run.getName() + ": step " + stepNo + " of " + total
                        + (stepNo > 1 ? " (started after step " + (stepNo - 1) + " was completed)" : ""));
        if (stepNo == 1) {
            notifications.send(assignee, t, NotificationType.WORKFLOW_STEP,
                    run.getName() + ": step 1 \"" + t.getTitle() + "\" is yours today");
        } else {
            WorkflowStep prev = run.getSteps().get(stepNo - 2);
            String prevName = employees.findById(prev.assigneeId()).map(Employee::getFullName).orElse("previous step");
            notifications.send(assignee, t, NotificationType.WORKFLOW_STEP,
                    run.getName() + ": " + prevName + " finished step " + (stepNo - 1) + ". Step " + stepNo + " \""
                            + t.getTitle() + "\" is now yours");
        }
        return t;
    }

    private void updateProgress(WorkflowRun run, int stepNo, TaskStatus status, Instant dueAt, Instant completedAt) {
        if (stepNo < 1 || stepNo > run.getStepProgress().size()) return;
        List<WorkflowStepProgress> progress = new ArrayList<>(run.getStepProgress());
        progress.set(stepNo - 1, new WorkflowStepProgress(status.name(), dueAt, completedAt));
        run.setStepProgress(progress);
    }

    private void finishRun(WorkflowRun run, Task lastStep, int total) {
        run.setStatus(RunStatus.DONE);
        run.setFinishedAt(time.now());
        notifications.send(run.getCreatedBy(), lastStep, NotificationType.WORKFLOW_DONE,
                run.getName() + " (" + run.getRunDate() + "): all " + total + " steps completed");
        Task src = run.getSourceTask();
        if (src == null) return;
        activity.note(src, null, ActivityAction.COMMENTED, "FMS “" + run.getName() + "” finished: all " + total + " steps completed.");
        List<Employee> told = new ArrayList<>();
        for (Employee e : List.of(src.getAssignee(), src.getCreatedBy())) {
            boolean already = told.stream().anyMatch(x -> x.getId().equals(e.getId()));
            if (already || e.getId().equals(run.getCreatedBy().getId())) continue;
            told.add(e);
            notifications.send(e, src, NotificationType.WORKFLOW_DONE,
                    "FMS “" + run.getName() + "” for “" + src.getTitle() + "” is complete");
        }
    }
}
