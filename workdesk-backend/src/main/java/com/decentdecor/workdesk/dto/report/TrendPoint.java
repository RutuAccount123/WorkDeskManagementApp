package com.decentdecor.workdesk.dto.report;

/** One month of the 6-month trend. month: "2026-10". */
public record TrendPoint(String month, Integer score, long total, long completed, Double onTimeRate) {
}
