package com.decentdecor.workdesk.dto.instrument;

import com.decentdecor.workdesk.dto.common.PersonRef;
import java.time.Instant;

/**
 * One line of an instrument's history: who had it, where, from when to when.
 * endedAt / endAction null = they still have it. endAction: SUBMITTED (back to the office store) or SHIFTED (to another person).
 */
public record InstrumentUseResponse(
        Long id,
        PersonRef holder,
        String location,
        String project,
        PersonRef givenBy,
        Instant startedAt,
        String note,
        Instant endedAt,
        PersonRef endedBy,
        String endAction,
        String endNote) {
}
