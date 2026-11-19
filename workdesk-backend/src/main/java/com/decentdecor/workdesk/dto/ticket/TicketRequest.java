package com.decentdecor.workdesk.dto.ticket;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** POST /api/tasks/{id}/tickets — who should help, and what is needed. */
public record TicketRequest(
        @NotNull(message = "assignedToId: choose a person") Long assignedToId,
        @NotBlank(message = "note: must not be blank")
        @Size(max = 4000, message = "note: must be 4000 characters or fewer") String note) {
}
