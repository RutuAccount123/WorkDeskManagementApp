package com.decentdecor.workdesk.exception;

import org.springframework.http.HttpStatus;

/** 400: the request breaks a rule, e.g. "title: must not be blank". */
public class BadRequestException extends ApiException {
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
