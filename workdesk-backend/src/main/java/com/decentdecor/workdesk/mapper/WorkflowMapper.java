package com.decentdecor.workdesk.mapper;

import com.decentdecor.workdesk.dto.workflow.RunResponse;
import com.decentdecor.workdesk.dto.workflow.RunStepResponse;
import com.decentdecor.workdesk.dto.workflow.RunStepTask;
import com.decentdecor.workdesk.dto.workflow.WorkflowResponse;
import com.decentdecor.workdesk.dto.workflow.WorkflowStepResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.json.FormField;
import com.decentdecor.workdesk.entity.json.WorkflowStep;
import com.decentdecor.workdesk.entity.json.WorkflowStepProgress;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.util.Enums;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Workflow (FMS) and run entities → response DTOs.
 * Steps are stored as JSON with only the person's id, so the people are looked up in one query.
 */
@Component
public class WorkflowMapper {
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final EmployeeMapper employees;
    private final TaskMapper tasks;
    private final EmployeeRepository employeeRepository;

    public WorkflowMapper(EmployeeMapper employees, TaskMapper tasks, EmployeeRepository employeeRepository) {
        this.employees = employees;
        this.tasks = tasks;
        this.employeeRepository = employeeRepository;
    }

    public static String hhmm(LocalTime t) {
        return t == null ? null : HH_MM.format(t);
    }

    /** Everyone named in these steps, by id. */
    public Map<Long, Employee> peopleIn(Collection<List<WorkflowStep>> stepLists) {
        List<Long> ids = stepLists.stream().flatMap(List::stream).map(WorkflowStep::assigneeId)
                .filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return new HashMap<>();
        return employeeRepository.findAllById(ids).stream().collect(Collectors.toMap(Employee::getId, Function.identity()));
    }

    // ------------------------------------------------------------ workflow (setup)

    public List<WorkflowResponse> toResponses(List<Workflow> list) {
        Map<Long, Employee> people = peopleIn(list.stream().map(Workflow::getSteps).toList());
        return list.stream().map(w -> toResponse(w, people)).toList();
    }

    public WorkflowResponse toResponse(Workflow w) {
        return toResponse(w, peopleIn(List.of(w.getSteps())));
    }

    private WorkflowResponse toResponse(Workflow w, Map<Long, Employee> people) {
        List<WorkflowStepResponse> steps = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (int i = 0; i < w.getSteps().size(); i++) {
            WorkflowStep s = w.getSteps().get(i);
            steps.add(new WorkflowStepResponse(i + 1, s.title(), s.hours(), s.priority() == null ? "MEDIUM" : s.priority(),
                    employees.toRef(people.get(s.assigneeId())), s.how() == null ? "" : s.how(),
                    s.checklist() == null ? List.of() : s.checklist()));
            if (s.hours() != null) total = total.add(s.hours());
        }
        return new WorkflowResponse(w.getId(), w.getName(), w.getDescription(), w.getFrequency().name(), Enums.name(w.getDayOfWeek()),
                hhmm(w.getStartTime()), hhmm(w.getEndTime()), w.isActive(), w.getLastRunOn(), w.getCreatedAt(),
                employees.toRef(w.getCreatedBy()), tasks.toRef(w.getSourceTask()), formFields(w.getFormFields()), steps, total);
    }

    // ------------------------------------------------------------ runs (tracker rows)

    /**
     * Maps runs and their current task; older runs may still have one task row per stage.
     */
    public List<RunResponse> toRunResponses(List<WorkflowRun> runs, List<Task> stepTasks, Instant now) {
        Map<Long, Map<Integer, Task>> byRun = new HashMap<>();
        for (Task t : stepTasks) {
            byRun.computeIfAbsent(t.getWorkflowRun().getId(), k -> new HashMap<>()).put(t.getWorkflowStep(), t);
        }
        Map<Long, Employee> people = peopleIn(runs.stream().map(WorkflowRun::getSteps).toList());
        return runs.stream().map(r -> toRunResponse(r, byRun.getOrDefault(r.getId(), Map.of()), people, now)).toList();
    }

    private RunResponse toRunResponse(WorkflowRun r, Map<Integer, Task> stepTasks, Map<Long, Employee> people, Instant now) {
        List<RunStepResponse> steps = new ArrayList<>();
        for (int i = 0; i < r.getSteps().size(); i++) {
            WorkflowStep s = r.getSteps().get(i);
            Task t = stepTasks.get(i + 1);
            boolean hasProgress = r.getStepProgress() != null && !r.getStepProgress().isEmpty();
            WorkflowStepProgress progress = hasProgress && i < r.getStepProgress().size() ? r.getStepProgress().get(i) : null;
            boolean currentStep = r.getCurrentStep() == i + 1;
            RunStepTask task = null;
            Instant planned = progress == null ? (t == null ? null : t.getDueAt()) : progress.dueAt();
            Instant actual = progress == null ? (t == null ? null : t.getCompletedAt()) : progress.completedAt();
            if (progress != null && !progress.status().equals("WAITING")) {
                boolean currentTask = currentStep && t != null;
                boolean overdue = currentTask ? t.isOverdue(now)
                        : (progress.status().equals("TODO") || progress.status().equals("IN_PROGRESS"))
                                && progress.dueAt() != null && progress.dueAt().isBefore(now);
                task = new RunStepTask(currentTask ? t.getId() : null,
                        currentTask ? t.getStatus().name() : progress.status(),
                        currentTask ? t.getDueAt() : progress.dueAt(),
                        currentTask ? t.getCompletedAt() : progress.completedAt(), overdue);
            } else if (progress == null && t != null) {
                task = new RunStepTask(t.getId(), t.getStatus().name(), t.getDueAt(), t.getCompletedAt(), t.isOverdue(now));
            }
            Long delay = null;
            if (planned != null) {
                Instant end = actual != null ? actual : now;
                delay = Math.round(Duration.between(planned, end).toSeconds() / 60.0);
            }
            steps.add(new RunStepResponse(i + 1, s.title(), s.hours(), employees.toRef(people.get(s.assigneeId())),
                    s.how() == null ? "" : s.how(), s.checklist() == null ? List.of() : s.checklist(), task,
                    planned, actual, delay));
        }
        return new RunResponse(r.getId(), r.getWorkflow() == null ? null : r.getWorkflow().getId(), r.getName(), r.getRunDate(),
                r.getStatus().name(), r.getNumber(), label(r), formFields(r.getFormFields()), r.getFormData(), r.needsForm(),
                employees.toRef(r.getFormFilledBy()), r.getFormFilledAt(), hhmm(r.getStartTime()), hhmm(r.getEndTime()),
                r.getStartedAt(), r.getFinishedAt(), r.getCurrentStep(), r.totalSteps(), tasks.toRef(r.getSourceTask()), steps);
    }

    /** The first filled answer that isn't a tick box, e.g. the site name. Shown next to the run. */
    private String label(WorkflowRun r) {
        if (r.getFormData() == null) return null;
        for (FormField f : r.getFormFields()) {
            if ("checkbox".equals(f.type())) continue;
            Object v = r.getFormData().get(f.id());
            if (v != null && !String.valueOf(v).isEmpty()) return String.valueOf(v);
        }
        return null;
    }

    private static List<FormField> formFields(List<FormField> fields) {
        return fields == null ? List.of() : fields;
    }
}
