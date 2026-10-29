package com.decentdecor.workdesk.dto.holiday;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Add or edit a holiday. date: "2026-11-14". */
public record HolidayRequest(
        @NotBlank(message = "Choose a date") String date,
        @NotBlank(message = "Give the holiday a name")
        @Size(max = 120, message = "name: must be 120 characters or fewer") String name,
        @Size(max = 300, message = "note: must be 300 characters or fewer") String note) {
}
