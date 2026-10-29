package com.decentdecor.workdesk.util;

/** Small text helpers. */
public final class Texts {
    private Texts() {
    }

    public static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    /** Trimmed text, or null when empty. */
    public static String trimToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }

    /** Trimmed text, or "" when empty. */
    public static String trimToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    /** "task" / "tasks". */
    public static String plural(long n, String word) {
        return n == 1 ? word : word + "s";
    }

    /** One decimal: 66.66 → 66.7 */
    public static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }
}
