package com.decentdecor.workdesk.exception;

import org.springframework.http.HttpStatus;

/** 429: too many tries (sign-in limit). */
public class TooManyRequestsException extends ApiException {
    public TooManyRequestsException(String message) {
        super(HttpStatus.TOO_MANY_REQUESTS, message);
    }
}
