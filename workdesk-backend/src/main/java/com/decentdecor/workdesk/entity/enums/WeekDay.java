package com.decentdecor.workdesk.entity.enums;

import java.time.DayOfWeek;

/** Working days a weekly task or weekly FMS can run on. Sunday is the weekly off. */
public enum WeekDay {
    MONDAY,
    TUESDAY,
    WEDNESDAY,
    THURSDAY,
    FRIDAY,
    SATURDAY;

    public DayOfWeek toDayOfWeek() {
        return DayOfWeek.valueOf(name());
    }
}
