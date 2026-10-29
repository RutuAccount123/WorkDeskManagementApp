package com.decentdecor.workdesk.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

/**
 * Table: digest_log. Remembers that a person already got today's summary notification,
 * so they get it only once a day. Primary key = (employee, day).
 */
@Entity
@Table(name = "digest_log")
@IdClass(DigestLog.Key.class)
public class DigestLog {

    @Id
    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Id
    @Column(name = "day", nullable = false)
    private LocalDate summaryDay;

    protected DigestLog() {
        // for JPA
    }

    public DigestLog(Long employeeId, LocalDate summaryDay) {
        this.employeeId = employeeId;
        this.summaryDay = summaryDay;
    }

    public Long getEmployeeId() {
        return employeeId;
    }

    public LocalDate getSummaryDay() {
        return summaryDay;
    }

    /** The composite primary key. */
    public static class Key implements Serializable {
        private Long employeeId;
        private LocalDate summaryDay;

        public Key() {
        }

        public Key(Long employeeId, LocalDate summaryDay) {
            this.employeeId = employeeId;
            this.summaryDay = summaryDay;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(employeeId, k.employeeId) && Objects.equals(summaryDay, k.summaryDay);
        }

        @Override
        public int hashCode() {
            return Objects.hash(employeeId, summaryDay);
        }
    }
}
