package com.decentdecor.workdesk.dto.report;

import java.time.Instant;

public record TodayTask(Long id, String title, String status, Instant dueAt, boolean overdue) {
}
