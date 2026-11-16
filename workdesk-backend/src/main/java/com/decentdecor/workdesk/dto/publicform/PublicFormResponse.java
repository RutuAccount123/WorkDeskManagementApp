package com.decentdecor.workdesk.dto.publicform;

import com.decentdecor.workdesk.entity.json.FormField;
import java.util.List;

/**
 * GET /api/public/forms/{token}: the FMS form as the link's visitor sees it (no internal details).
 * signedInAs: the visitor's own name when they are signed in to Work Desk, else null (then the form asks for a name).
 */
public record PublicFormResponse(String name, String description, List<FormField> formFields, String signedInAs) {
}
