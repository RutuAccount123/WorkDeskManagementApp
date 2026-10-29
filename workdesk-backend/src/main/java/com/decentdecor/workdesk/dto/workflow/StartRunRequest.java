package com.decentdecor.workdesk.dto.workflow;

import java.util.Map;

/** POST /api/workflows/{id}/start-now: the filled form ({"f1": "PIL", …}) and optionally the task it is for. */
public record StartRunRequest(Map<String, Object> formData, Long sourceTaskId) {
}
