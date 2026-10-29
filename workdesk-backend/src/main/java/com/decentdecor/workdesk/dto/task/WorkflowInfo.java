package com.decentdecor.workdesk.dto.task;

import java.time.LocalDate;

/** On an FMS task: which run and its current stage. */
public record WorkflowInfo(Long runId, String name, int step, int total, LocalDate date, int number, Long sourceTaskId) {
}
