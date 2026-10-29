package com.decentdecor.workdesk.dto.report;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

/** One month inside the yearly report. */
public record MonthPerformance(String month, @JsonUnwrapped Performance performance) {
}
