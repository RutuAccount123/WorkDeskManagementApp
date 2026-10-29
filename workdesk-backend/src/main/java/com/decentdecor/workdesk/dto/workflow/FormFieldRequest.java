package com.decentdecor.workdesk.dto.workflow;

/**
 * One entry-form question when setting up an FMS.
 * options (for type "select"): a list, or text like "PIL, AIGP". id: keep it when editing so old answers still match.
 */
public record FormFieldRequest(String id, String label, String type, Boolean required, Object options) {
}
