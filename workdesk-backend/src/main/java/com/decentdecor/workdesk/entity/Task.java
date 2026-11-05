package com.decentdecor.workdesk.entity;

import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.entity.json.ChecklistItem;
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
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Table: task. One piece of work for one person.
 * Also used for recurring copies (recurringTemplate is set) and as the single active task for an FMS run
 * (workflowRun is set; workflowStep identifies its current stage).
 */
@Entity
@Table(name = "task")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", nullable = false)
    private String description = "";

    @Column(name = "image_data")
    private byte[] imageData;

    /** The person doing the work. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignee_id")
    private Employee assignee;

    /** The person who assigned or added it. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id")
    private Employee createdBy;

    /** Who approves it. Null = no review needed. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id")
    private Employee reviewer;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 10)
    private Priority priority = Priority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 12)
    private TaskStatus status = TaskStatus.TODO;

    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "estimated_hours", precision = 7, scale = 4)
    private BigDecimal estimatedHours;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /** Set when this is a copy of a daily / weekly task. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_template_id")
    private RecurringTemplate recurringTemplate;

    /** An FMS linked to this task (save form data in an existing FMS). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_id")
    private Workflow linkedWorkflow;

    /** Set when this task is a step of an FMS run. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_run_id")
    private WorkflowRun workflowRun;

    /** Which step of the run (1, 2, 3…). */
    @Column(name = "workflow_step")
    private Integer workflowStep;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "checklist", nullable = false)
    private List<ChecklistItem> checklist = new ArrayList<>();

    @Column(name = "due_soon_reminded", nullable = false)
    private boolean dueSoonReminded;

    @Column(name = "overdue_reminded", nullable = false)
    private boolean overdueReminded;


    /** FMS steps never need review; otherwise the chosen reviewer (may be null). */
    public Employee effectiveReviewer() {
        return workflowRun != null ? null : reviewer;
    }

    public boolean isWorkflowStep() {
        return workflowRun != null;
    }

    public boolean isSelfAdded() {
        return createdBy.getId().equals(assignee.getId());
    }

    /** The day this work belongs to: its due date, or the day it was added. */
    public Instant workAt() {
        return dueAt != null ? dueAt : createdAt;
    }

    /** Open work whose due time has passed. */
    public boolean isOverdue(Instant now) {
        return status.isOpen() && dueAt != null && dueAt.isBefore(now)
                && (estimatedHours == null || startedAt != null);
    }

    /** The assignee, assigner and reviewer are "involved" and can open the task. */
    public boolean involves(Long employeeId) {
        Employee r = effectiveReviewer();
        return assignee.getId().equals(employeeId) || createdBy.getId().equals(employeeId)
                || (r != null && r.getId().equals(employeeId));
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

    public byte[] getImageData() {
        return imageData;
    }

    public void setImageData(byte[] imageData) {
        this.imageData = imageData;
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

    public Employee getReviewer() {
        return reviewer;
    }

    public void setReviewer(Employee reviewer) {
        this.reviewer = reviewer;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public void setDueAt(Instant dueAt) {
        this.dueAt = dueAt;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(Instant scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public BigDecimal getEstimatedHours() {
        return estimatedHours;
    }

    public void setEstimatedHours(BigDecimal estimatedHours) {
        this.estimatedHours = estimatedHours;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public RecurringTemplate getRecurringTemplate() {
        return recurringTemplate;
    }

    public void setRecurringTemplate(RecurringTemplate recurringTemplate) {
        this.recurringTemplate = recurringTemplate;
    }

    public Workflow getLinkedWorkflow() {
        return linkedWorkflow;
    }

    public void setLinkedWorkflow(Workflow linkedWorkflow) {
        this.linkedWorkflow = linkedWorkflow;
    }

    public WorkflowRun getWorkflowRun() {
        return workflowRun;
    }

    public void setWorkflowRun(WorkflowRun workflowRun) {
        this.workflowRun = workflowRun;
    }

    public Integer getWorkflowStep() {
        return workflowStep;
    }

    public void setWorkflowStep(Integer workflowStep) {
        this.workflowStep = workflowStep;
    }

    public List<ChecklistItem> getChecklist() {
        return checklist;
    }

    public void setChecklist(List<ChecklistItem> checklist) {
        this.checklist = checklist;
    }

    public boolean isDueSoonReminded() {
        return dueSoonReminded;
    }

    public void setDueSoonReminded(boolean dueSoonReminded) {
        this.dueSoonReminded = dueSoonReminded;
    }

    public boolean isOverdueReminded() {
        return overdueReminded;
    }

    public void setOverdueReminded(boolean overdueReminded) {
        this.overdueReminded = overdueReminded;
    }

}
