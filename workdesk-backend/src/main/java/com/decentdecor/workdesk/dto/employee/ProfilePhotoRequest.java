package com.decentdecor.workdesk.dto.employee;

import jakarta.validation.constraints.NotBlank;

public record ProfilePhotoRequest(@NotBlank String image) {
}
