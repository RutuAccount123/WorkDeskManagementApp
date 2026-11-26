package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Send an instrument for repair: what is wrong, where it goes, when it should be back, and the estimated cost. */
public record RepairInstrumentRequest(
        @NotBlank(message = "Write what is wrong with it")
        @Size(max = 500, message = "problem: must be 500 characters or fewer") String problem,
        @NotBlank(message = "Write the repair shop or service centre")
        @Size(max = 160, message = "repairShop: must be 160 characters or fewer") String repairShop,
        LocalDate expectedBack,
        @DecimalMin(value = "0", message = "Cost cannot be below 0")
        @DecimalMax(value = "9999999999", message = "Cost is too large") BigDecimal estimatedCost,
        @Size(max = 500, message = "note: must be 500 characters or fewer") String note) {
}
