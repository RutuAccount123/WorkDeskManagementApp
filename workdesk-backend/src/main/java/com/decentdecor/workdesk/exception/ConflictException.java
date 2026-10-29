package com.decentdecor.workdesk.exception;

import org.springframework.http.HttpStatus;

/** 409: clashes with existing data, e.g. the email is already used. */
public class ConflictException extends ApiException {
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
