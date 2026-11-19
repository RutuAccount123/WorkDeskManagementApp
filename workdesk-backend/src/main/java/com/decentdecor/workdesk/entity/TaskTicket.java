package com.decentdecor.workdesk.entity;

import com.decentdecor.workdesk.entity.enums.TicketStatus;
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

/**
 * Table: task_ticket. Someone needs help with a task, so they raise a ticket on it
 * and assign it to another person with a note. Deleted together with the task (ON DELETE CASCADE).
 */
@Entity
@Table(name = "task_ticket")
public class TaskTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The task it is about. Null for a ticket about a leave. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private Task task;

    /** The leave it is about (an employee asking an admin to change or remove it). Null once that leave is removed. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leave_id")
    private EmployeeLeave leave;

    /** Short text of what a leave ticket is about, kept even after the leave is removed. */
    @Column(name = "subject", nullable = false, length = 200)
    private String subject = "";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "raised_by_id")
    private Employee raisedBy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assigned_to_id")
    private Employee assignedTo;

    @Column(name = "note", nullable = false)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private TicketStatus status = TicketStatus.OPEN;

    @Column(name = "reply")
    private String reply;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by_id")
    private Employee resolvedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    /** true = closed by the person it was raised to marking the task done (the task moved to them). */
    @Column(name = "task_done", nullable = false)
    private boolean taskDone;

    public boolean isOpen() {
        return status == TicketStatus.OPEN;
    }

    public boolean isAboutLeave() {
        return task == null;
    }

    public EmployeeLeave getLeave() {
        return leave;
    }

    public void setLeave(EmployeeLeave leave) {
        this.leave = leave;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    // ------------------------------------------------------------ getters and setters

    public Long getId() {
        return id;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Employee getRaisedBy() {
        return raisedBy;
    }

    public void setRaisedBy(Employee raisedBy) {
        this.raisedBy = raisedBy;
    }

    public Employee getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(Employee assignedTo) {
        this.assignedTo = assignedTo;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public TicketStatus getStatus() {
        return status;
    }

    public void setStatus(TicketStatus status) {
        this.status = status;
    }

    public String getReply() {
        return reply;
    }

    public void setReply(String reply) {
        this.reply = reply;
    }

    public Employee getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(Employee resolvedBy) {
        this.resolvedBy = resolvedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public boolean isTaskDone() {
        return taskDone;
    }

    public void setTaskDone(boolean taskDone) {
        this.taskDone = taskDone;
    }
}
