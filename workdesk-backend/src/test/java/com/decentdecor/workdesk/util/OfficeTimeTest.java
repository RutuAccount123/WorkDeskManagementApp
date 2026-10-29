package com.decentdecor.workdesk.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.decentdecor.workdesk.exception.BadRequestException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class OfficeTimeTest {
    // 28 Oct 2026, 23:00 in India = 17:30 UTC
    final OfficeTime time = new OfficeTime(Clock.fixed(Instant.parse("2026-10-28T17:30:00Z"), ZoneOffset.UTC), "Asia/Kolkata");

    @Test
    void todayIsInOfficeTime() {
        assertEquals(LocalDate.of(2026, 10, 28), time.today());
        assertEquals(Instant.parse("2026-10-28T12:30:00Z"), time.at(LocalDate.of(2026, 10, 28), LocalTime.of(18, 0)));
        assertEquals(LocalDate.of(2026, 10, 26), time.mondayOf(LocalDate.of(2026, 11, 1)));
    }

    @Test
    void readsDatesFromTheScreens() {
        assertEquals(Instant.parse("2026-10-30T12:30:00Z"), time.parseDateTime("2026-10-30T18:00"));
        assertEquals(Instant.parse("2026-10-30T12:30:00Z"), time.parseDateTime("2026-10-30T12:30:00Z"));
        assertNull(time.parseDateTime(""));
        assertThrows(BadRequestException.class, () -> time.parseDateTime("tomorrow"));
        assertEquals(LocalTime.of(18, 0), OfficeTime.parseTime("18:00", "x"));
        assertThrows(BadRequestException.class, () -> OfficeTime.parseMonth("2026-13"));
    }

    @Test
    void friendlyText() {
        assertEquals("30 Oct, 6:00 PM", time.friendly(Instant.parse("2026-10-30T12:30:00Z")));
    }
}
