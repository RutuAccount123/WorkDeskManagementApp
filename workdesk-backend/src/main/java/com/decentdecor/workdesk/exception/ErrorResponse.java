package com.decentdecor.workdesk.exception;

/** The body of every error: {"status": 404, "message": "Task not found"}. */
public record ErrorResponse(int status, String message) {
}
