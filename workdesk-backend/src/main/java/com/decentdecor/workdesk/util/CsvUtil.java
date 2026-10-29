package com.decentdecor.workdesk.util;

import java.util.List;

/** CSV that opens safely in Excel: quoted cells, and text starting with = + - @ cannot run as a formula. */
public final class CsvUtil {
    private CsvUtil() {
    }

    public static String cell(Object value) {
        if (value == null) return "";
        String original = String.valueOf(value);
        String v = original;
        if (!(value instanceof Number) && !v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0) v = "'" + v;
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r") || !v.equals(original)) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    public static String row(List<?> cells) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(cell(cells.get(i)));
        }
        return sb.toString();
    }
}
