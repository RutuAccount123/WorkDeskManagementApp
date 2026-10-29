package com.decentdecor.workdesk.util;

import com.decentdecor.workdesk.exception.BadRequestException;

/** Reads enum values sent by the screens ("HIGH", "WEEKLY"…) with a readable error. */
public final class Enums {
    private Enums() {
    }

    /** Empty → fallback. Unknown → 400 with the message. */
    public static <E extends Enum<E>> E parse(Class<E> type, String value, E fallback, String message) {
        if (value == null || value.isBlank()) {
            if (fallback == null) throw new BadRequestException(message);
            return fallback;
        }
        try {
            return Enum.valueOf(type, value.trim());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(message);
        }
    }

    /** null-safe name() for responses. */
    public static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
