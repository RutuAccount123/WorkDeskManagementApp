package com.decentdecor.workdesk.entity.json;

import java.util.List;

/**
 * One question of an FMS entry form, stored inside workflow.form_fields (jsonb).
 * type: text | textarea | number | date | select | checkbox. options: only for select.
 */
public record FormField(String id, String label, String type, boolean required, List<String> options) {

    public static final List<String> TYPES = List.of("text", "textarea", "number", "date", "select", "checkbox");
}
