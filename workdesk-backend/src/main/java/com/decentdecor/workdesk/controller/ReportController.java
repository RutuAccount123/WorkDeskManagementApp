package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.report.DailyRow;
import com.decentdecor.workdesk.dto.report.DashboardResponse;
import com.decentdecor.workdesk.dto.report.EmployeeSummaryRow;
import com.decentdecor.workdesk.dto.report.PerformanceResponse;
import com.decentdecor.workdesk.dto.report.TeamMemberResponse;
import com.decentdecor.workdesk.dto.report.YearlyResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.ReportService;
import com.decentdecor.workdesk.util.CsvUtil;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Reports. Employees only ever see their own numbers (ReportService makes sure of it). */
@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private static final String CSV_HEADER =
            "Employee,Department,Assigned,Completed,On time,Late,Open now,Overdue now,On-time %,Avg hours to complete";

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardResponse> dashboard(@AuthenticationPrincipal CurrentUser me) {
        return ResponseEntity.ok(reportService.dashboard(me));
    }

    @GetMapping("/team")
    public ResponseEntity<List<TeamMemberResponse>> team(@AuthenticationPrincipal CurrentUser me,
                                                         @RequestParam(defaultValue = "today") String period) {
        return ResponseEntity.ok(reportService.team(me, period));
    }

    /** ?employeeId=&month=2026-10 */
    @GetMapping("/performance")
    public ResponseEntity<PerformanceResponse> performance(@AuthenticationPrincipal CurrentUser me,
                                                           @RequestParam(required = false) Long employeeId,
                                                           @RequestParam(required = false) String month) {
        return ResponseEntity.ok(reportService.performance(me, employeeId, month));
    }

    @GetMapping("/yearly")
    public ResponseEntity<YearlyResponse> yearly(@AuthenticationPrincipal CurrentUser me,
                                                 @RequestParam(required = false) Long employeeId,
                                                 @RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(reportService.yearly(me, employeeId, year));
    }

    @GetMapping("/employees")
    public ResponseEntity<List<EmployeeSummaryRow>> employees(@AuthenticationPrincipal CurrentUser me,
                                                              @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                              @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(reportService.employeeSummary(me, from, to));
    }

    /** The same rows as a CSV file that opens in Excel. */
    @GetMapping("/employees.csv")
    public ResponseEntity<byte[]> employeesCsv(@AuthenticationPrincipal CurrentUser me,
                                               @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                               @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        StringBuilder csv = new StringBuilder(CSV_HEADER).append('\n');
        for (EmployeeSummaryRow r : reportService.employeeSummary(me, from, to)) {
            csv.append(CsvUtil.row(java.util.Arrays.asList(r.employeeName(), r.department(), r.assigned(), r.completed(),
                    r.completedOnTime(), r.completedLate(), r.openNow(), r.overdueNow(), r.onTimeRate(), r.avgCompletionHours())))
               .append('\n');
        }
        byte[] body = ("﻿" + csv).getBytes(StandardCharsets.UTF_8);   // BOM: Excel reads Hindi / Marathi names correctly
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("employee-summary_" + from + "_to_" + to + ".csv").build().toString())
                .body(body);
    }

    @GetMapping("/daily")
    public ResponseEntity<List<DailyRow>> daily(@AuthenticationPrincipal CurrentUser me,
                                                @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                @RequestParam(required = false) Long employeeId) {
        return ResponseEntity.ok(reportService.daily(me, from, to, employeeId));
    }
}
