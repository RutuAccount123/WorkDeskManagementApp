package com.decentdecor.workdesk.exception;

import org.springframework.http.HttpStatus;

/** 403: signed in, but not allowed to do this. */
public class ForbiddenException extends ApiException {
    public static final String DEFAULT_MESSAGE = "You do not have permission to do this";

    public ForbiddenException() {
        this(DEFAULT_MESSAGE);
    }

    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }
}
