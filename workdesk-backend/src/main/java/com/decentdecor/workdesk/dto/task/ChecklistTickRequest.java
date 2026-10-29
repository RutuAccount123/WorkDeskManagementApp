package com.decentdecor.workdesk.dto.task;

import jakarta.validation.constraints.NotNull;

/** POST /api/tasks/{id}/checklist: tick (done=true) or untick one How step. index starts at 0. */
public record ChecklistTickRequest(@NotNull(message = "Choose a checklist item") Integer index, boolean done) {
}
