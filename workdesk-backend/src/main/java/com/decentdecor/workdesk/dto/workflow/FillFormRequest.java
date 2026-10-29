package com.decentdecor.workdesk.dto.workflow;

import java.util.Map;

/** POST /api/workflows/runs/{runId}/form: step 1's person fills a scheduled run's form. */
public record FillFormRequest(Map<String, Object> formData) {
}
