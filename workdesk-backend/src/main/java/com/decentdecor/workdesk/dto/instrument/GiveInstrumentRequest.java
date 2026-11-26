package com.decentdecor.workdesk.dto.instrument;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Give a free instrument to a person, or shift it from its holder to another person. */
public record GiveInstrumentRequest(
        @NotNull(message = "Choose the person") Long holderId,
        @NotBlank(message = "Write the site location")
        @Size(max = 160, message = "location: must be 160 characters or fewer") String location,
        @Size(max = 160, message = "project: must be 160 characters or fewer") String project,
        @Size(max = 500, message = "note: must be 500 characters or fewer") String note) {
}
