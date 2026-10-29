package com.decentdecor.workdesk.util;

import com.decentdecor.workdesk.exception.BadRequestException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Everything about "now", "today" and dates in the office time zone (wd.timezone, Asia/Kolkata).
 * All services use this instead of new Date() / LocalDate.now(), so tests can fix the time.
 */
@Component
public class OfficeTime {
    private static final Pattern DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Pattern MONTH = Pattern.compile("^\\d{4}-\\d{2}$");
    private static final DateTimeFormatter MESSAGE_FORMAT = DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.ENGLISH);

    private final Clock clock;
    private final ZoneId zone;

    public OfficeTime(Clock clock, @Value("${wd.timezone:Asia/Kolkata}") String timezone) {
        this.clock = clock;
        this.zone = ZoneId.of(timezone);
    }

    public ZoneId zone() {
        return zone;
    }

    public Instant now() {
        return clock.instant();
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(zone));
    }

    /** The local day of an instant. */
    public LocalDate dayOf(Instant instant) {
        return instant.atZone(zone).toLocalDate();
    }

    /** Midnight at the start of a local day, as an instant. */
    public Instant startOf(LocalDate day) {
        return day.atStartOfDay(zone).toInstant();
    }

    /** A local day + time, as an instant (e.g. 2026-10-28 at 18:00). */
    public Instant at(LocalDate day, LocalTime time) {
        return day.atTime(time).atZone(zone).toInstant();
    }

    /** Monday of the week that contains the day. */
    public LocalDate mondayOf(LocalDate day) {
        return day.minusDays(day.getDayOfWeek().getValue() - DayOfWeek.MONDAY.getValue());
    }

    /** "27 Oct, 6:00 PM" for notification messages. */
    public String friendly(Instant instant) {
        return MESSAGE_FORMAT.format(instant.atZone(zone));
    }

    // ------------------------------------------------------------ reading values sent by the screens

    /**
     * A date-time from the screen. "2026-10-30T18:00" (no zone) is office time.
     * A value with a zone ("…Z" or "+05:30") is used as it is. Empty = null.
     */
    public Instant parseDateTime(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        try {
            if (v.endsWith("Z") || v.matches(".*[+-]\\d{2}:?\\d{2}$")) return OffsetDateTime.parse(v).toInstant();
            if (DATE.matcher(v).matches()) return startOf(LocalDate.parse(v));
            return LocalDateTime.parse(v).atZone(zone).toInstant();
        } catch (DateTimeParseException e) {
            throw new BadRequestException("Invalid date or time: " + value);
        }
    }

    /** "2026-10-30" → date; empty = null. */
    public static LocalDate parseDate(String value, String label) {
        if (value == null || value.isBlank()) return null;
        if (!DATE.matcher(value.trim()).matches()) throw new BadRequestException("Invalid " + label + ": " + value);
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new BadRequestException("Invalid " + label + ": " + value);
        }
    }

    /** "18:00" or "18:00:00" → time. */
    public static LocalTime parseTime(String value, String message) {
        if (value == null || !value.trim().matches("^\\d{2}:\\d{2}(:\\d{2})?$")) throw new BadRequestException(message);
        try {
            return LocalTime.parse(value.trim().length() == 5 ? value.trim() + ":00" : value.trim());
        } catch (DateTimeParseException e) {
            throw new BadRequestException(message);
        }
    }

    /** "2026-10" → month. */
    public static YearMonth parseMonth(String value) {
        if (value == null || !MONTH.matcher(value).matches()) throw new BadRequestException("Invalid month: " + value);
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException e) {
            throw new BadRequestException("Invalid month: " + value);
        }
    }
}
