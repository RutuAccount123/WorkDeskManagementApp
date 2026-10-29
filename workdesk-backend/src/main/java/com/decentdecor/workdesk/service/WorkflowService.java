package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.workflow.FormFieldRequest;
import com.decentdecor.workdesk.dto.workflow.RunResponse;
import com.decentdecor.workdesk.dto.workflow.StartRunRequest;
import com.decentdecor.workdesk.dto.workflow.WorkflowRequest;
import com.decentdecor.workdesk.dto.workflow.WorkflowResponse;
import com.decentdecor.workdesk.dto.workflow.WorkflowStepRequest;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.WeekDay;
import com.decentdecor.workdesk.entity.enums.WorkflowFrequency;
import com.decentdecor.workdesk.entity.json.FormField;
import com.decentdecor.workdesk.entity.json.WorkflowStep;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.WorkflowMapper;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.repository.WorkflowRepository;
import com.decentdecor.workdesk.repository.WorkflowRunRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.service.support.TaskRules;
import com.decentdecor.workdesk.service.support.WorkflowAccess;
import com.decentdecor.workdesk.util.Enums;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Workflows (FMS): set up, edit, pause, delete, start runs, fill a run's form, and the tracker.
 * How a run moves forward step by step is in WorkflowEngine.
 */
@Service
public class WorkflowService {
    private static final BigDecimal MAX_HOURS = BigDecimal.valueOf(24);

    private final WorkflowRepository workflows;
    private final WorkflowRunRepository runs;
    private final TaskRepository tasks;
    private final WorkflowEngine engine;
    private final WorkflowAccess access;
    private final People people;
    private final WorkflowMapper mapper;
    private final OfficeTime time;

    public WorkflowService(WorkflowRepository workflows, WorkflowRunRepository runs, TaskRepository tasks, WorkflowEngine engine,
                           WorkflowAccess access, People people, WorkflowMapper mapper, OfficeTime time) {
        this.workflows = workflows;
        this.runs = runs;
        this.tasks = tasks;
        this.engine = engine;
        this.access = access;
        this.people = people;
        this.mapper = mapper;
        this.time = time;
    }

    // ================================================================ setup

    /** All FMS the person can see; with taskId only the ones linked to that task. */
    @Transactional(readOnly = true)
    public List<WorkflowResponse> list(CurrentUser user, Long taskId) {
        Employee me = people.me(user);
        Long linkedToTask = null;
        if (taskId != null) {
            linkedToTask = tasks.findById(taskId).map(t -> t.getLinkedWorkflow() == null ? null : t.getLinkedWorkflow().getId()).orElse(null);
        }
        final Long linked = linkedToTask;
        List<Workflow> list = workflows.findAllByOrderByNameAsc().stream()
                .filter(w -> access.canSee(w, me))
                .filter(w -> taskId == null || (w.getSourceTask() != null && w.getSourceTask().getId().equals(taskId))
                        || w.getId().equals(linked))
                .sorted(Comparator.comparing((Workflow w) -> w.getName().toLowerCase(Locale.ROOT)).thenComparing(Workflow::getId))
                .toList();
        return mapper.toResponses(list);
    }

    @Transactional(readOnly = true)
    public WorkflowResponse get(CurrentUser user, Long id) {
        return mapper.toResponse(visible(id, people.me(user)));
    }

    /** Creates an FMS and starts either its scheduled run or the requested linked-task run for today. */
    @Transactional
    public WorkflowResponse create(CurrentUser user, WorkflowRequest req) {
        Employee me = people.me(user);
        Workflow w = new Workflow();
        w.setCreatedBy(me);
        w.setActive(true);
        w.setCreatedAt(time.now());
        apply(w, req, me);
        w = workflows.save(w);
        if (Boolean.TRUE.equals(req.startNow()) && w.getSourceTask() != null) {
            engine.startRun(w, time.today(), null, me, true, w.getSourceTask());
        } else {
            engine.startScheduledRunsForToday();
        }
        return mapper.toResponse(w);
    }

    /** Edits apply from the next run (runs already started keep their copy). */
    @Transactional
    public WorkflowResponse update(CurrentUser user, Long id, WorkflowRequest req) {
        Employee me = people.me(user);
        Workflow w = visible(id, me);
        apply(w, req, me);
        return mapper.toResponse(w);
    }

    @Transactional
    public WorkflowResponse setActive(CurrentUser user, Long id, boolean active) {
        Employee me = people.me(user);
        Workflow w = visible(id, me);
        access.requireOwner(w, me);
        w.setActive(active);
        if (active) engine.startScheduledRunsForToday();
        return mapper.toResponse(w);
    }

    /** Past runs and their tasks stay in the record. */
    @Transactional
    public void delete(CurrentUser user, Long id) {
        Employee me = people.me(user);
        Workflow w = visible(id, me);
        access.requireOwner(w, me);
        workflows.delete(w);
    }

    // ================================================================ runs

    /** "Start new": anyone who can see the FMS fills its form, and step 1 starts at once. */
    @Transactional
    public RunResponse startNow(CurrentUser user, Long id, StartRunRequest req) {
        Employee me = people.me(user);
        Workflow w = visible(id, me);
        if (!w.isActive()) throw new BadRequestException("This workflow is paused");
        if (!engine.allStepPeopleActive(w.getSteps())) throw new BadRequestException("A step’s person is inactive. Edit the FMS first.");
        LocalDate today = time.today();
        Task source = w.getSourceTask();
        if (req != null && req.sourceTaskId() != null) {
            source = tasks.findById(req.sourceTaskId()).filter(t -> TaskRules.canSee(t, me))
                    .orElseThrow(() -> new BadRequestException("Choose a task you can see"));
        }
        Map<String, Object> form = w.getFormFields().isEmpty() ? null : (req == null || req.formData() == null ? Map.of() : req.formData());
        WorkflowRun run = engine.startRun(w, today, form, me, true, source);
        return toRun(run);
    }

    /** Runs on a day (default today), or the runs started for a task. */
    @Transactional(readOnly = true)
    public List<RunResponse> runs(CurrentUser user, LocalDate date, Long taskId) {
        Employee me = people.me(user);
        List<WorkflowRun> list = taskId != null ? runs.findBySourceTaskId(taskId) : runs.findByRunDate(date == null ? time.today() : date);
        List<WorkflowRun> visible = list.stream()
                .filter(r -> access.canSee(r, me))
                .sorted(Comparator.comparing(WorkflowRun::getStartTime).thenComparing(WorkflowRun::getName).thenComparing(WorkflowRun::getId))
                .toList();
        return toRuns(visible);
    }

    @Transactional(readOnly = true)
    public RunResponse run(CurrentUser user, Long runId) {
        return toRun(visibleRun(runId, people.me(user)));
    }

    /** Step 1's person (or the owner / an admin) fills a scheduled run's form; this starts step 1. */
    @Transactional
    public RunResponse fillForm(CurrentUser user, Long runId, Map<String, Object> formData) {
        Employee me = people.me(user);
        WorkflowRun run = visibleRun(runId, me);
        run = runs.findByIdForUpdate(run.getId()).orElseThrow(() -> NotFoundException.of("Workflow run"));
        if (!run.needsForm()) throw new BadRequestException("The form for this run is already filled");
        boolean stepOnePerson = me.getId().equals(run.getSteps().get(0).assigneeId());
        if (!me.isAdmin() && !run.getCreatedBy().getId().equals(me.getId()) && !stepOnePerson) {
            throw new ForbiddenException("Only step 1’s person fills this form");
        }
        engine.saveForm(run, null, formData == null ? Map.of() : formData, me);
        return toRun(run);
    }

    /** Tracker: every run of one FMS between two dates, newest first (like the rows of the FMS sheet). */
    @Transactional(readOnly = true)
    public List<RunResponse> tracker(CurrentUser user, Long id, LocalDate from, LocalDate to) {
        Workflow w = visible(id, people.me(user));
        List<WorkflowRun> list = runs.findByWorkflowIdAndRunDateBetween(w.getId(),
                from == null ? LocalDate.of(1900, 1, 1) : from, to == null ? LocalDate.of(2999, 12, 31) : to);
        List<WorkflowRun> sorted = list.stream()
                .sorted(Comparator.comparing(WorkflowRun::getStartedAt).thenComparing(WorkflowRun::getId).reversed())
                .toList();
        return toRuns(sorted);
    }

    // ================================================================ inside

    private Workflow visible(Long id, Employee me) {
        Workflow w = workflows.findById(id).orElseThrow(() -> NotFoundException.of("Workflow"));
        if (!access.canSee(w, me)) throw NotFoundException.of("Workflow");
        return w;
    }

    private WorkflowRun visibleRun(Long id, Employee me) {
        WorkflowRun r = runs.findById(id).orElseThrow(() -> NotFoundException.of("Workflow run"));
        if (!access.canSee(r, me)) throw NotFoundException.of("Workflow run");
        return r;
    }

    private RunResponse toRun(WorkflowRun run) {
        return toRuns(List.of(run)).get(0);
    }

    private List<RunResponse> toRuns(List<WorkflowRun> list) {
        List<Long> ids = list.stream().map(WorkflowRun::getId).toList();
        List<Task> stepTasks = ids.isEmpty() ? List.of() : tasks.findByWorkflowRunIdIn(ids);
        return mapper.toRunResponses(list, stepTasks, time.now());
    }

    /** Checks the setup and copies it onto the workflow. Blank steps and questions are skipped. */
    private void apply(Workflow w, WorkflowRequest req, Employee me) {
        if (Texts.isBlank(req.name())) throw new BadRequestException("Give the workflow a name");
        WorkflowFrequency frequency = Enums.parse(WorkflowFrequency.class, req.frequency(), null, "Choose how often this FMS runs");
        WeekDay day = null;
        if (frequency == WorkflowFrequency.WEEKLY) {
            day = Enums.parse(WeekDay.class, req.dayOfWeek(), null, "Choose a day of the week for weekly workflows");
        }
        String timeMessage = "Set a start time and an end time";
        LocalTime start = OfficeTime.parseTime(cut(req.startTime()), timeMessage);
        LocalTime end = OfficeTime.parseTime(cut(req.endTime()), timeMessage);
        if (!end.isAfter(start)) throw new BadRequestException("End time must be after start time");

        List<WorkflowStep> steps = steps(req.steps());
        if (steps.size() < 2) throw new BadRequestException("A workflow needs at least 2 steps");
        List<FormField> fields = formFields(req.formFields());

        Task source = null;
        if (req.sourceTaskId() != null) {
            if (w.getSourceTask() != null && w.getSourceTask().getId().equals(req.sourceTaskId())) {
                source = w.getSourceTask();
            } else {
                source = tasks.findById(req.sourceTaskId()).filter(t -> TaskRules.canSee(t, me))
                        .orElseThrow(() -> new BadRequestException("Choose a task you can see"));
            }
        }
        w.setName(req.name().trim());
        w.setDescription(Texts.trimToEmpty(req.description()));
        w.setFrequency(frequency);
        w.setDayOfWeek(day);
        w.setStartTime(start);
        w.setEndTime(end);
        w.setSourceTask(source);
        w.setSteps(steps);
        w.setFormFields(fields);
    }

    /** "10:00:00" → "10:00" */
    private static String cut(String t) {
        return t == null || t.length() < 5 ? t : t.substring(0, 5);
    }

    private List<WorkflowStep> steps(List<WorkflowStepRequest> input) {
        List<WorkflowStep> out = new ArrayList<>();
        if (input == null) return out;
        for (WorkflowStepRequest s : input) {
            if (s == null || Texts.isBlank(s.title())) continue;
            int n = out.size() + 1;
            BigDecimal hours = s.hours();
            if (hours == null || hours.signum() <= 0 || hours.compareTo(MAX_HOURS) > 0) {
                throw new BadRequestException("Step " + n + ": hours must be between 0.25 and 24");
            }
            Employee person = people.activeAssignee(s.assigneeId());
            Priority priority = Enums.parse(Priority.class, s.priority(), Priority.MEDIUM, "Step " + n + ": choose a valid priority");
            List<String> checklist = s.checklist() == null ? List.of()
                    : s.checklist().stream().filter(c -> !Texts.isBlank(c)).map(String::trim).toList();
            out.add(new WorkflowStep(s.title().trim(), person.getId(), hours, priority.name(), Texts.trimToEmpty(s.how()), checklist));
        }
        return out;
    }

    /** Questions keep their id when editing, so old answers still match. New ones get f1, f2, … */
    private List<FormField> formFields(List<FormFieldRequest> input) {
        List<FormField> out = new ArrayList<>();
        if (input == null) return out;
        Set<String> given = new HashSet<>();
        input.stream().filter(f -> f != null && f.id() != null).forEach(f -> given.add(f.id()));
        Set<String> used = new HashSet<>();
        for (FormFieldRequest f : input) {
            if (f == null || Texts.isBlank(f.label())) continue;
            int n = out.size() + 1;
            String label = f.label().trim();
            if (f.type() == null || !FormField.TYPES.contains(f.type())) throw new BadRequestException("Form field " + n + ": choose a field type");
            List<String> options = List.of();
            if ("select".equals(f.type())) {
                options = options(f.options());
                if (options.size() < 2) throw new BadRequestException("“" + label + "”: give at least 2 options, separated by commas");
            }
            String id = f.id() != null && !used.contains(f.id()) ? f.id() : null;
            for (int k = n; id == null; k++) {
                String candidate = "f" + k;
                if (!used.contains(candidate) && !given.contains(candidate)) id = candidate;
            }
            used.add(id);
            out.add(new FormField(id, label, f.type(), Boolean.TRUE.equals(f.required()), options));
        }
        return out;
    }

    /** Options from a list, or from text like "PIL, AIGP". */
    private static List<String> options(Object raw) {
        List<String> values = new ArrayList<>();
        if (raw instanceof List<?> list) {
            list.forEach(o -> values.add(String.valueOf(o)));
        } else if (raw != null) {
            values.addAll(Arrays.asList(String.valueOf(raw).split(",")));
        }
        return values.stream().map(String::trim).filter(v -> !v.isEmpty()).toList();
    }
}
