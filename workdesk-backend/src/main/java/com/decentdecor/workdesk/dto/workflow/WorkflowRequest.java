package com.decentdecor.workdesk.dto.workflow;

import java.util.List;

/**
 * Create or edit an FMS.
 * frequency: DAILY | WEEKLY (needs dayOfWeek) | ON_DEMAND. startTime / endTime: "10:00".
 * sourceTaskId: the task it is for (optional). startNow: start a run for that task straight away (only when creating).
 * Steps and questions with an empty title / label are skipped.
 */
public record WorkflowRequest(
        String name,
        String description,
        String frequency,
        String dayOfWeek,
        String startTime,
        String endTime,
        Long sourceTaskId,
        Boolean startNow,
        List<FormFieldRequest> formFields,
        List<WorkflowStepRequest> steps) {
}
