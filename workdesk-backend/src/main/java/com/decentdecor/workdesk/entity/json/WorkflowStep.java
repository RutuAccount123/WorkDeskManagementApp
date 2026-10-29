package com.decentdecor.workdesk.entity.json;

import java.math.BigDecimal;
import java.util.List;

/**
 * One step (column) of an FMS, stored inside workflow.steps (jsonb).
 * hours: time allowed after the previous step is done. how: a note. checklist: numbered How steps.
 */
public record WorkflowStep(String title, Long assigneeId, BigDecimal hours, String priority, String how, List<String> checklist) {
}
