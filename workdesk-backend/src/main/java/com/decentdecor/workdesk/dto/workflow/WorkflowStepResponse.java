package com.decentdecor.workdesk.dto.workflow;

import com.decentdecor.workdesk.dto.common.PersonRef;
import java.math.BigDecimal;
import java.util.List;

public record WorkflowStepResponse(int step, String title, BigDecimal hours, String priority, PersonRef assignee, String how, List<String> checklist) {
}
