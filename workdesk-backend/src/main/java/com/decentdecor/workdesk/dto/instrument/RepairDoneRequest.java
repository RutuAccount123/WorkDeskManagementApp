package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** Back from repair: what it cost and what was done. It goes back to the office store, free. */
public record RepairDoneRequest(
        @DecimalMin(value = "0", message = "Cost cannot be below 0")
        @DecimalMax(value = "9999999999", message = "Cost is too large") BigDecimal repairCost,
        @Size(max = 500, message = "note: must be 500 characters or fewer") String note) {
}
