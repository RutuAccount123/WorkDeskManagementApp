package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Add an instrument (or edit its details: name, make, material code, info).
 * materialCode: units with the same code are one material. quantity (adding only, default 1): how many units to add.
 * When adding one unit, holderId (with location and project) gives it to that person straight away;
 * empty = free in the office store.
 */
public record InstrumentRequest(
        @NotBlank(message = "Write the instrument name")
        @Size(max = 120, message = "name: must be 120 characters or fewer") String name,
        @Size(max = 120, message = "make: must be 120 characters or fewer") String make,
        @Size(max = 40, message = "materialCode: must be 40 characters or fewer") String materialCode,
        @Size(max = 1000, message = "info: must be 1000 characters or fewer") String info,
        @Min(value = 1, message = "Quantity must be at least 1")
        @Max(value = 100, message = "Add at most 100 at a time") Integer quantity,
        Long holderId,
        @Size(max = 160, message = "location: must be 160 characters or fewer") String location,
        @Size(max = 160, message = "project: must be 160 characters or fewer") String project,
        @Size(max = 500, message = "note: must be 500 characters or fewer") String note) {
}
