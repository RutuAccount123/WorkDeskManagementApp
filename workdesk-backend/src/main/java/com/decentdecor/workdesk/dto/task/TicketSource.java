package com.decentdecor.workdesk.dto.task;

import com.decentdecor.workdesk.dto.common.PersonRef;
import com.decentdecor.workdesk.dto.common.TaskRef;

/**
 * For a task that is a ticket's work: the ticket, the task it was raised on (null for a leave ticket),
 * what it is about, who raised it, and whether the ticket is still OPEN or RESOLVED.
 */
public record TicketSource(Long ticketId, TaskRef task, String subject, PersonRef raisedBy, String status) {
}
