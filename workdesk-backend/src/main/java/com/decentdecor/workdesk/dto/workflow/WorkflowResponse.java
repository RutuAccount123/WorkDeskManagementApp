package com.decentdecor.workdesk.dto.workflow;

import com.decentdecor.workdesk.dto.common.PersonRef;
import com.decentdecor.workdesk.dto.common.TaskRef;
import com.decentdecor.workdesk.entity.json.FormField;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** One FMS. startTime / endTime: "10:00". totalHours: all steps added up. */
public record WorkflowResponse(
        Long id,
        String name,
        String description,
        String frequency,
        String dayOfWeek,
        String startTime,
        String endTime,
        boolean active,
        LocalDate lastRunOn,
        Instant createdAt,
        PersonRef createdBy,
        TaskRef sourceTask,
        List<FormField> formFields,
        List<WorkflowStepResponse> steps,
        BigDecimal totalHours) {
}
