package com.decentdecor.workdesk.exception;

import org.springframework.http.HttpStatus;

/** 401: not signed in, or wrong email / password. */
public class UnauthorizedException extends ApiException {
    public UnauthorizedException(String message) {
        super(HttpStatus.UNAUTHORIZED, message);
    }
}
