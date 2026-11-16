package com.decentdecor.workdesk.dto.publicform;

import java.time.LocalDate;

/** POST /api/public/forms/{token}: the entry was saved as run #number of that day. */
public record PublicFormSubmitResponse(LocalDate runDate, int number) {
}
