package com.decentdecor.workdesk.dto.common;

/** A short reference to a person, used inside other responses. */
public record PersonRef(Long id, String fullName, String department) {
}
