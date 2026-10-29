package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.entity.enums.WeekDay;
import com.decentdecor.workdesk.repository.HolidayRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

/** A working day = not Sunday and not an office holiday. */
@Component
public class WorkingDays {
    private final HolidayRepository holidays;

    public WorkingDays(HolidayRepository holidays) {
        this.holidays = holidays;
    }

    public boolean isWorkingDay(LocalDate day) {
        return day.getDayOfWeek() != DayOfWeek.SUNDAY && !holidays.existsByHolidayDate(day);
    }

    /** Daily = every working day; weekly = only on its day (and only if that is a working day). */
    public boolean runsOn(boolean daily, WeekDay weeklyDay, LocalDate day) {
        if (!isWorkingDay(day)) return false;
        return daily || (weeklyDay != null && weeklyDay.toDayOfWeek() == day.getDayOfWeek());
    }
}
