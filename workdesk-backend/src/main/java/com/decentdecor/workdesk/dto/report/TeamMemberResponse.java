package com.decentdecor.workdesk.dto.report;

import com.decentdecor.workdesk.dto.employee.EmployeeResponse;
import java.util.List;

/** GET /api/reports/team: one card per employee on the admin dashboard. */
public record TeamMemberResponse(
        EmployeeResponse employee,
        TodayCounts today,
        List<TodayTask> todayTasks,
        TodayCounts range,
        List<TodayTask> rangeTasks,
        long rangeOverdue,
        long overdue,
        long waitingReview,
        MonthSummary month) {
}
