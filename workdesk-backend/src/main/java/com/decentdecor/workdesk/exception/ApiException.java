package com.decentdecor.workdesk.exception;

import org.springframework.http.HttpStatus;

/**
 * Base class for errors whose message is safe to show to the person.
 * Throw one of the sub-classes from a service; GlobalExceptionHandler turns it into
 * {"status": 400, "message": "..."} with the right HTTP status.
 */
public abstract class ApiException extends RuntimeException {
    private final HttpStatus status;

    protected ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
