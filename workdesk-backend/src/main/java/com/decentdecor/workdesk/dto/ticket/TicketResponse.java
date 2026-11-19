package com.decentdecor.workdesk.dto.ticket;

import com.decentdecor.workdesk.dto.common.PersonRef;
import com.decentdecor.workdesk.dto.common.TaskRef;
import java.time.Instant;

/**
 * One ticket. Either about a task (task set), or about a leave (task null, subject = "Leave …", leaveId set
 * while that leave still exists). taskDone: closed by marking the task done (it moved to the helper), not by resolving.
 */
public record TicketResponse(
        Long id,
        TaskRef task,
        String taskStatus,
        PersonRef raisedBy,
        PersonRef assignedTo,
        String note,
        String status,
        String reply,
        PersonRef resolvedBy,
        Instant createdAt,
        Instant resolvedAt,
        boolean taskDone,
        String subject,
        Long leaveId) {
}
