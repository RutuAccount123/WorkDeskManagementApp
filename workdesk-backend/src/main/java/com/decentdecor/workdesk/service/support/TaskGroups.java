package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.WorkflowRun;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Groups legacy multi-task FMS runs as one piece of dashboard work. */
public final class TaskGroups {
    private TaskGroups() {
    }

    /**
     * Keeps the current stage for each run and groups its source task with the newest active run.
     * Unlinked standalone tasks are returned unchanged; separate runs remain separate.
     */
    public static List<Task> onePerWorkflowRun(List<Task> tasks) {
        Map<Object, Task> runs = new LinkedHashMap<>();
        Map<Long, Task> tasksById = new HashMap<>();
        for (Task task : tasks) {
            tasksById.put(task.getId(), task);
            if (task.getWorkflowRun() != null) {
                WorkflowRun run = task.getWorkflowRun();
                Object key = run.getId() == null ? run : run.getId();
                runs.merge(key, task, TaskGroups::preferredStage);
            }
        }

        Map<Long, Task> runBySourceTask = new HashMap<>();
        for (Task stage : runs.values()) {
            WorkflowRun run = stage.getWorkflowRun();
            if (run.getSourceTask() == null || !tasksById.containsKey(run.getSourceTask().getId())) continue;
            Long sourceTaskId = run.getSourceTask().getId();
            Task existing = runBySourceTask.get(sourceTaskId);
            if (existing == null || preferredRun(existing, stage) == stage) {
                runBySourceTask.put(sourceTaskId, stage);
            }
        }

        Set<Long> sourceTaskIds = new HashSet<>(runBySourceTask.keySet());
        Set<Object> emittedRuns = new HashSet<>();
        List<Task> result = new ArrayList<>();
        for (Task task : tasks) {
            WorkflowRun run = task.getWorkflowRun();
            if (run == null) {
                if (!sourceTaskIds.contains(task.getId())) result.add(task);
                continue;
            }
            Object key = run.getId() == null ? run : run.getId();
            if (emittedRuns.add(key)) result.add(runs.get(key));
        }
        return result;
    }

    private static Task preferredRun(Task first, Task candidate) {
        boolean firstOpen = first.getStatus().isOpen();
        boolean candidateOpen = candidate.getStatus().isOpen();
        if (firstOpen != candidateOpen) return candidateOpen ? candidate : first;

        WorkflowRun firstRun = first.getWorkflowRun();
        WorkflowRun candidateRun = candidate.getWorkflowRun();
        int dateOrder = candidateRun.getRunDate().compareTo(firstRun.getRunDate());
        if (dateOrder != 0) return dateOrder > 0 ? candidate : first;
        return candidateRun.getNumber() > firstRun.getNumber() ? candidate : first;
    }

    private static Task preferredStage(Task first, Task candidate) {
        boolean firstOpen = first.getStatus().isOpen();
        boolean candidateOpen = candidate.getStatus().isOpen();
        if (firstOpen != candidateOpen) return candidateOpen ? candidate : first;

        int firstStep = first.getWorkflowStep() == null ? 0 : first.getWorkflowStep();
        int candidateStep = candidate.getWorkflowStep() == null ? 0 : candidate.getWorkflowStep();
        if (firstOpen) return candidateStep < firstStep ? candidate : first;
        return candidateStep > firstStep ? candidate : first;
    }
}
