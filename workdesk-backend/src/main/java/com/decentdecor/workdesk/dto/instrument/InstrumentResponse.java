package com.decentdecor.workdesk.dto.instrument;

import com.decentdecor.workdesk.dto.common.PersonRef;
import java.time.Instant;

/**
 * One instrument, as the Instruments tab shows it.
 * srNo: its number in the list (1 = first added). materialCode: units with the same code are one material.
 * status: FREE (in the office store), IN_USE (someone has it at a site), REPAIR (under repair) or REMOVED.
 * holder / location / project / heldSince: who has it now and where ("Office store" when free, the repair shop when under repair).
 * repair: the open repair, when under repair. historyCount / repairCount: how many times it was used / repaired.
 * removedAt / removedBy / removedReason: set once it is removed from the list.
 */
public record InstrumentResponse(
        Long id,
        long srNo,
        String name,
        String make,
        String materialCode,
        String info,
        String status,
        PersonRef holder,
        String location,
        String project,
        Instant heldSince,
        int historyCount,
        PersonRef createdBy,
        Instant createdAt,
        InstrumentRepairResponse repair,
        int repairCount,
        Instant removedAt,
        PersonRef removedBy,
        String removedReason) {
}
