package com.decentdecor.workdesk.dto.report;

/** Today's work for one person. inProgress includes work waiting for review. */
public record TodayCounts(long total, long todo, long inProgress, long done) {
}
