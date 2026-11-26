package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Remove an instrument from the list, e.g. "damaged beyond repair", "lost at site", "sold". */
public record RemoveInstrumentRequest(
        @NotBlank(message = "Write why it is removed")
        @Size(max = 500, message = "reason: must be 500 characters or fewer") String reason) {
}
