package com.decentdecor.workdesk.dto.leave;

import com.decentdecor.workdesk.dto.common.PersonRef;
import java.time.Instant;
import java.time.LocalDate;

/** One personal leave. */
public record LeaveResponse(Long id, PersonRef employee, LocalDate startDate, LocalDate endDate, String reason,
                            PersonRef createdBy, Instant createdAt) {
}
