package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.entity.json.FormField;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.util.OfficeTime;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Checks a filled FMS entry form against its questions and returns clean answers:
 * text trimmed, numbers as numbers, tick boxes as true/false, every question present.
 */
public final class FormValidator {
    private FormValidator() {
    }

    public static Map<String, Object> clean(List<FormField> fields, Map<String, Object> data) {
        Map<String, Object> in = data == null ? Map.of() : data;
        Map<String, Object> out = new LinkedHashMap<>();
        for (FormField f : fields) {
            Object raw = in.get(f.id());
            if ("checkbox".equals(f.type())) {
                out.put(f.id(), Boolean.TRUE.equals(raw) || "true".equals(raw) || Integer.valueOf(1).equals(raw));
                continue;
            }
            String v = raw == null ? "" : String.valueOf(raw).trim();
            if (f.required() && v.isEmpty()) throw new BadRequestException("Please fill “" + f.label() + "”");
            if (v.isEmpty()) {
                out.put(f.id(), "");
                continue;
            }
            switch (f.type()) {
                case "number" -> {
                    try {
                        out.put(f.id(), new BigDecimal(v));
                    } catch (NumberFormatException e) {
                        throw new BadRequestException("“" + f.label() + "” must be a number");
                    }
                }
                case "select" -> {
                    if (f.options() == null || !f.options().contains(v)) {
                        throw new BadRequestException("Choose a valid option for “" + f.label() + "”");
                    }
                    out.put(f.id(), v);
                }
                case "date" -> {
                    OfficeTime.parseDate(v, f.label());
                    out.put(f.id(), v);
                }
                default -> out.put(f.id(), v);
            }
        }
        return out;
    }
}
