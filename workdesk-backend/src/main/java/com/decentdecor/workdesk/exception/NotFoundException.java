package com.decentdecor.workdesk.exception;

import org.springframework.http.HttpStatus;

/**
 * 404: it doesn't exist, or the person may not see it.
 * (Someone else's task also answers "Task not found", so outsiders learn nothing.)
 */
public class NotFoundException extends ApiException {
    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }

    /** NotFoundException.of("Task") → "Task not found" */
    public static NotFoundException of(String what) {
        return new NotFoundException(what + " not found");
    }
}
