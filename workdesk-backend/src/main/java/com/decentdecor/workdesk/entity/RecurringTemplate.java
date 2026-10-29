package com.decentdecor.workdesk.entity;

import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.RepeatFrequency;
import com.decentdecor.workdesk.entity.enums.WeekDay;
import java.math.BigDecimal;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Table: recurring_template. A daily or weekly task.
 * A copy (a normal Task) is created for each working day in the next 7 days.
 */
@Entity
@Table(name = "recurring_template")
public class RecurringTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", nullable = false)
    private String description = "";

    /** Who does the work. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignee_id")
    private Employee assignee;

    /** Who set it up (admin, or the employee for their own work). */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id")
    private Employee createdBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 10)
    private Priority priority = Priority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(name = "frequency", nullable = false, length = 10)
    private RepeatFrequency frequency;

    /** Only for WEEKLY. */
    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", length = 10)
    private WeekDay dayOfWeek;

    @Column(name = "due_time", nullable = false)
    private LocalTime dueTime;

    @Column(name = "estimated_hours", precision = 7, scale = 4)
    private BigDecimal estimatedHours;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /** The latest day a copy was created for. */
    @Column(name = "last_generated_on")
    private LocalDate lastGeneratedOn;

    /** Optional FMS linked to the copies. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_id")
    private Workflow workflow;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;


    /** Work the employee set up for themselves (no review needed). */
    public boolean isSelfOwned() {
        return createdBy.getId().equals(assignee.getId());
    }

    // ------------------------------------------------------------ getters and setters

    public Long getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Employee getAssignee() {
        return assignee;
    }

    public void setAssignee(Employee assignee) {
        this.assignee = assignee;
    }

    public Employee getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Employee createdBy) {
        this.createdBy = createdBy;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public RepeatFrequency getFrequency() {
        return frequency;
    }

    public void setFrequency(RepeatFrequency frequency) {
        this.frequency = frequency;
    }

    public WeekDay getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(WeekDay dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public LocalTime getDueTime() {
        return dueTime;
    }

    public void setDueTime(LocalTime dueTime) {
        this.dueTime = dueTime;
    }

    public BigDecimal getEstimatedHours() {
        return estimatedHours;
    }

    public void setEstimatedHours(BigDecimal estimatedHours) {
        this.estimatedHours = estimatedHours;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public LocalDate getLastGeneratedOn() {
        return lastGeneratedOn;
    }

    public void setLastGeneratedOn(LocalDate lastGeneratedOn) {
        this.lastGeneratedOn = lastGeneratedOn;
    }

    public Workflow getWorkflow() {
        return workflow;
    }

    public void setWorkflow(Workflow workflow) {
        this.workflow = workflow;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

}
