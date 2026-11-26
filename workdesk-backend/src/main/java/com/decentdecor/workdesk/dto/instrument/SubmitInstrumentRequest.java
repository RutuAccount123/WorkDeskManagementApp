package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.Size;

/** Return an instrument to the office store. note: e.g. "working fine" or "battery low". */
public record SubmitInstrumentRequest(
        @Size(max = 500, message = "note: must be 500 characters or fewer") String note) {
}
