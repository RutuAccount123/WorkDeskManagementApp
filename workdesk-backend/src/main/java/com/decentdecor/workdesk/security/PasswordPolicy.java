package com.decentdecor.workdesk.security;

import java.nio.charset.StandardCharsets;

/** One password rule for sign-up, reset and change. */
public final class PasswordPolicy {
    private PasswordPolicy() {}

    /** A readable problem with the password, or null when it is fine. */
    public static String problem(String password, String field) {
        if (password == null || password.length() < 8) return field + ": must be at least 8 characters";
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) return field + ": must be 72 characters or fewer";
        if (password.isBlank()) return field + ": must not be only spaces";
        boolean letter = password.chars().anyMatch(Character::isLetter);
        boolean digit = password.chars().anyMatch(Character::isDigit);
        if (!letter || !digit) return field + ": use letters and at least one number";
        return null;
    }
}
