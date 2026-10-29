package com.decentdecor.workdesk.dto.workflow;

import java.math.BigDecimal;
import java.util.List;

/** One step (column) when setting up an FMS. hours: 0.25 to 24. checklist: numbered How steps. */
public record WorkflowStepRequest(String title, Long assigneeId, BigDecimal hours, String priority, String how, List<String> checklist) {
}
