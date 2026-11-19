package com.decentdecor.workdesk.dto.ticket;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** POST /api/tickets/{id}/resolve — the answer to the ticket. */
public record TicketResolveRequest(
        @NotBlank(message = "reply: must not be blank")
        @Size(max = 4000, message = "reply: must be 4000 characters or fewer") String reply) {
}
