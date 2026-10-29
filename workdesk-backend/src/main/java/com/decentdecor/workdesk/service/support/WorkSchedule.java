package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.util.OfficeTime;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Calculates effort deadlines inside working-hour windows and valid office days. */
@Component
public class WorkSchedule {
    private static final int MAX_DAYS_TO_SEARCH = 36500;

    private final WorkingDays workingDays;
    private final OfficeTime time;
    private final LocalTime defaultStart;
    private final LocalTime defaultEnd;

    public WorkSchedule(WorkingDays workingDays, OfficeTime time,
                        @Value("${wd.workday.start:10:00}") String defaultStart,
                        @Value("${wd.workday.end:18:00}") String defaultEnd) {
        this.workingDays = workingDays;
        this.time = time;
        this.defaultStart = LocalTime.parse(defaultStart);
        this.defaultEnd = LocalTime.parse(defaultEnd);
        if (!this.defaultEnd.isAfter(this.defaultStart)) {
            throw new IllegalArgumentException("Workday end must be after workday start");
        }
    }

    public Instant deadline(Instant startedAt, BigDecimal effortHours) {
        return deadline(startedAt, effortHours, defaultStart, defaultEnd);
    }

    public Instant deadline(Instant startedAt, BigDecimal effortHours, LocalTime workStart, LocalTime workEnd) {
        Objects.requireNonNull(startedAt, "startedAt");
        Objects.requireNonNull(effortHours, "effortHours");
        if (effortHours.signum() <= 0 || !workEnd.isAfter(workStart)) {
            throw new IllegalArgumentException("Effort must be positive and workday end must be after its start");
        }

        long remainingMinutes = effortHours.multiply(BigDecimal.valueOf(60))
                .setScale(0, RoundingMode.HALF_UP).longValueExact();
        LocalDate day = time.dayOf(startedAt);
        LocalTime start = startedAt.atZone(time.zone()).toLocalTime();

        for (int searched = 0; searched < MAX_DAYS_TO_SEARCH; searched++) {
            if (workingDays.isWorkingDay(day)) {
                LocalTime cursor = start.isBefore(workStart) ? workStart : start;
                if (cursor.isBefore(workEnd)) {
                    Instant cursorAt = time.at(day, cursor);
                    long availableMinutes = Duration.between(cursorAt, time.at(day, workEnd)).toMinutes();
                    if (remainingMinutes <= availableMinutes) {
                        return cursorAt.plusSeconds(remainingMinutes * 60);
                    }
                    remainingMinutes -= availableMinutes;
                }
            }
            day = day.plusDays(1);
            start = workStart;
        }
        throw new IllegalStateException("Could not find a working day for the task deadline");
    }
}
