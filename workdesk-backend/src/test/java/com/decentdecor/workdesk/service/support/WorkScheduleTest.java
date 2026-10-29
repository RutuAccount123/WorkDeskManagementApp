package com.decentdecor.workdesk.service.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.decentdecor.workdesk.repository.HolidayRepository;
import com.decentdecor.workdesk.util.OfficeTime;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class WorkScheduleTest {
    private static final ZoneId OFFICE = ZoneId.of("Asia/Kolkata");
    private final HolidayRepository holidays = mock(HolidayRepository.class);
    private final WorkSchedule schedule = new WorkSchedule(
            new WorkingDays(holidays),
            new OfficeTime(Clock.fixed(Instant.parse("2025-01-03T00:00:00Z"), OFFICE), OFFICE.getId()),
            "10:00", "18:00");

    @Test
    void carriesRemainingEffortToTheNextWorkingDay() {
        Instant start = LocalDate.of(2025, 1, 3).atTime(17, 0).atZone(OFFICE).toInstant();

        Instant due = schedule.deadline(start, new BigDecimal("4"));

        assertEquals(LocalDate.of(2025, 1, 4).atTime(13, 0).atZone(OFFICE).toInstant(), due);
    }

    @Test
    void skipsSundayAndOfficeHolidays() {
        when(holidays.existsByHolidayDate(LocalDate.of(2025, 1, 6))).thenReturn(true);
        Instant start = LocalDate.of(2025, 1, 4).atTime(17, 0).atZone(OFFICE).toInstant();

        Instant due = schedule.deadline(start, new BigDecimal("4"));

        assertEquals(LocalDate.of(2025, 1, 7).atTime(13, 0).atZone(OFFICE).toInstant(), due);
    }

    @Test
    void startsOutsideTheWindowAtTheNextWorkingStart() {
        Instant start = LocalDate.of(2025, 1, 3).atTime(18, 30).atZone(OFFICE).toInstant();

        Instant due = schedule.deadline(start, BigDecimal.ONE, LocalTime.of(10, 0), LocalTime.of(18, 0));

        assertEquals(LocalDate.of(2025, 1, 4).atTime(11, 0).atZone(OFFICE).toInstant(), due);
    }
}
