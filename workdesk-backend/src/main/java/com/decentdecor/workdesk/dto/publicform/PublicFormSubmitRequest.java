package com.decentdecor.workdesk.dto.publicform;

import java.util.Map;

/**
 * POST /api/public/forms/{token}: the filled form, e.g. {"f1": "PIL", "f2": 40}.
 * filledByName: the name typed on the form; always required. It is what the FMS sheet shows as "Filled by".
 */
public record PublicFormSubmitRequest(Map<String, Object> formData, String filledByName) {
}
