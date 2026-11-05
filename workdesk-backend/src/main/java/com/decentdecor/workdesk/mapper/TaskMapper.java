package com.decentdecor.workdesk.mapper;

import com.decentdecor.workdesk.dto.common.TaskRef;
import com.decentdecor.workdesk.dto.task.ActivityResponse;
import com.decentdecor.workdesk.dto.task.TaskResponse;
import com.decentdecor.workdesk.dto.task.WorkflowInfo;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.TaskActivity;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.util.Enums;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import org.springframework.stereotype.Component;

/** Task / history entities → response DTOs. Call inside a service transaction (it reads linked people). */
@Component
public class TaskMapper {
    private final EmployeeMapper employees;

    public TaskMapper(EmployeeMapper employees) {
        this.employees = employees;
    }

    public TaskResponse toResponse(Task t, Instant now) {
        return toResponse(t, now, false);
    }

    public TaskResponse toResponse(Task t, Instant now, boolean includeImage) {
        return new TaskResponse(
                t.getId(),
                t.getTitle(),
                t.getDescription(),
                employees.toRef(t.getAssignee()),
                employees.toRef(t.getCreatedBy()),
                t.getPriority().name(),
                t.getStatus().name(),
                t.getDueAt(),
                t.getScheduledAt(),
                t.getEstimatedHours(),
                t.isOverdue(now),
                t.getRecurringTemplate() != null,
                t.getRecurringTemplate() == null ? null : t.getRecurringTemplate().getFrequency().name(),
                t.getLinkedWorkflow() == null ? null : t.getLinkedWorkflow().getId(),
                t.isSelfAdded(),
                employees.toRef(t.effectiveReviewer()),
                workflowInfo(t),
                t.getChecklist() == null ? List.of() : t.getChecklist(),
                t.getCreatedAt(),
                t.getUpdatedAt(),
                t.getStartedAt(),
                t.getSubmittedAt(),
                t.getCompletedAt(),
                includeImage ? image(t) : null);
    }

    private String image(Task task) {
        byte[] image = task.getImageData() != null ? task.getImageData()
                : task.getRecurringTemplate() != null ? task.getRecurringTemplate().getImageData() : null;
        return image == null ? null : Base64.getEncoder().encodeToString(image);
    }

    public List<TaskResponse> toResponses(List<Task> tasks, Instant now) {
        return tasks.stream().map(t -> toResponse(t, now)).toList();
    }

    /** For an FMS step: which run, which FMS, step x of y. */
    private WorkflowInfo workflowInfo(Task t) {
        WorkflowRun run = t.getWorkflowRun();
        if (run == null) return null;
        int step = t.getWorkflowStep() == null ? 0 : t.getWorkflowStep();
        Long sourceTaskId = run.getSourceTask() == null ? null : run.getSourceTask().getId();
        return new WorkflowInfo(run.getId(), run.getName(), step, run.totalSteps(), run.getRunDate(), run.getNumber(), sourceTaskId);
    }

    public ActivityResponse toActivity(TaskActivity a) {
        return new ActivityResponse(a.getId(), a.getAction().name(), a.getActor() == null ? "System" : a.getActor().getFullName(),
                Enums.name(a.getFromStatus()), Enums.name(a.getToStatus()), a.getComment(), a.getCreatedAt());
    }

    public TaskRef toRef(Task t) {
        return t == null ? null : new TaskRef(t.getId(), t.getTitle());
    }
}
