package com.decentdecor.workdesk.dto.workflow;

import com.decentdecor.workdesk.dto.common.PersonRef;
import com.decentdecor.workdesk.dto.common.TaskRef;
import com.decentdecor.workdesk.entity.json.FormField;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * One run of an FMS (one row of the tracker).
 * label: the first filled answer (e.g. the site). needsForm: waiting for step 1 to fill the form.
 */
public record RunResponse(
        Long id,
        Long workflowId,
        String name,
        LocalDate date,
        String status,
        int number,
        String label,
        List<FormField> formFields,
        Map<String, Object> formData,
        boolean needsForm,
        PersonRef formFilledBy,
        Instant formFilledAt,
        String startTime,
        String endTime,
        Instant startedAt,
        Instant finishedAt,
        int currentStep,
        int totalSteps,
        TaskRef sourceTask,
        List<RunStepResponse> steps) {
}
