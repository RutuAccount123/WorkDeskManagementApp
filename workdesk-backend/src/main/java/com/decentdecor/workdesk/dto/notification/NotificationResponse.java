package com.decentdecor.workdesk.dto.notification;

import java.time.Instant;

/** One message in the bell panel. taskId: the task it is about (null for the daily summary). */
public record NotificationResponse(Long id, Long taskId, String type, String message, boolean read, Instant createdAt) {
}
