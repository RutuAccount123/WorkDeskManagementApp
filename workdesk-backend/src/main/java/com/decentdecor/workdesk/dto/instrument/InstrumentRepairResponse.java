package com.decentdecor.workdesk.dto.instrument;

import com.decentdecor.workdesk.dto.common.PersonRef;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** One time an instrument went for repair. returnedAt null = it is still under repair. */
public record InstrumentRepairResponse(
        Long id,
        String problem,
        String repairShop,
        LocalDate expectedBack,
        BigDecimal estimatedCost,
        String note,
        PersonRef sentBy,
        Instant sentAt,
        Instant returnedAt,
        PersonRef returnedBy,
        BigDecimal repairCost,
        String returnNote) {
}
