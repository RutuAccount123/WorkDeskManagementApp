package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Add an instrument (or edit its details: name, make, info).
 * When adding, holderId (with location and project) gives it to that person straight away; empty = free in the office store.
 */
public record InstrumentRequest(
        @NotBlank(message = "Write the instrument name")
        @Size(max = 120, message = "name: must be 120 characters or fewer") String name,
        @Size(max = 120, message = "make: must be 120 characters or fewer") String make,
        @Size(max = 1000, message = "info: must be 1000 characters or fewer") String info,
        Long holderId,
        @Size(max = 160, message = "location: must be 160 characters or fewer") String location,
        @Size(max = 160, message = "project: must be 160 characters or fewer") String project,
        @Size(max = 500, message = "note: must be 500 characters or fewer") String note) {
}
