package com.decentdecor.workdesk.dto.holiday;

import java.time.Instant;
import java.time.LocalDate;

public record HolidayResponse(Long id, LocalDate date, String name, String note, Instant createdAt) {
}
