package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/**
 * Add an instrument (or edit its details: name, weight, info).
 * When adding, holderId (with location and project) gives it to that person straight away; empty = free in the office store.
 */
public record InstrumentRequest(
        @NotBlank(message = "Write the instrument name")
        @Size(max = 120, message = "name: must be 120 characters or fewer") String name,
        @DecimalMin(value = "0.01", message = "Weight must be more than 0 kg")
        @DecimalMax(value = "999999", message = "Weight is too large") BigDecimal weightKg,
        @Size(max = 1000, message = "info: must be 1000 characters or fewer") String info,
        Long holderId,
        @Size(max = 160, message = "location: must be 160 characters or fewer") String location,
        @Size(max = 160, message = "project: must be 160 characters or fewer") String project,
        @Size(max = 500, message = "note: must be 500 characters or fewer") String note) {
}
