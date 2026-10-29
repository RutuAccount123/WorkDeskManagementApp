package com.decentdecor.workdesk.entity;

import com.decentdecor.workdesk.entity.enums.RunStatus;
import com.decentdecor.workdesk.entity.json.FormField;
import com.decentdecor.workdesk.entity.json.WorkflowStep;
import com.decentdecor.workdesk.entity.json.WorkflowStepProgress;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Table: workflow_run. One run of an FMS (one row of the FMS tracker).
 * The steps and form are copied when the run starts, so later edits of the FMS don't change it.
 */
@Entity
@Table(name = "workflow_run")
public class WorkflowRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null if the FMS was deleted later. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workflow_id")
    private Workflow workflow;

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "run_date", nullable = false)
    private LocalDate runDate;

    /** The FMS owner. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id")
    private Employee createdBy;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "steps", nullable = false)
    private List<WorkflowStep> steps = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_fields", nullable = false)
    private List<FormField> formFields = new ArrayList<>();

    /** Per-stage status and dates, retained as the single task advances through the run. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "step_progress", nullable = false)
    private List<WorkflowStepProgress> stepProgress = new ArrayList<>();

    /** The filled entry form, null until filled. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "form_data")
    private Map<String, Object> formData;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "form_filled_by")
    private Employee formFilledBy;

    @Column(name = "form_filled_at")
    private Instant formFilledAt;

    /** 1, 2, 3… for runs of the same FMS on the same day. */
    @Column(name = "number", nullable = false)
    private int number = 1;

    /** true = started with Start new; false = started by the scheduler. */
    @Column(name = "manual", nullable = false)
    private boolean manual;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_task_id")
    private Task sourceTask;

    @Column(name = "current_step", nullable = false)
    private int currentStep;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private RunStatus status = RunStatus.RUNNING;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;


    /** A scheduled run waits until step 1's person fills the entry form. */
    public boolean needsForm() {
        return !formFields.isEmpty() && formData == null;
    }

    public int totalSteps() {
        return steps.size();
    }

    // ------------------------------------------------------------ getters and setters

    public Long getId() {
        return id;
    }

    public Workflow getWorkflow() {
        return workflow;
    }

    public void setWorkflow(Workflow workflow) {
        this.workflow = workflow;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getRunDate() {
        return runDate;
    }

    public void setRunDate(LocalDate runDate) {
        this.runDate = runDate;
    }

    public Employee getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Employee createdBy) {
        this.createdBy = createdBy;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public List<WorkflowStep> getSteps() {
        return steps;
    }

    public void setSteps(List<WorkflowStep> steps) {
        this.steps = steps;
    }

    public List<FormField> getFormFields() {
        return formFields;
    }

    public void setFormFields(List<FormField> formFields) {
        this.formFields = formFields;
    }

    public List<WorkflowStepProgress> getStepProgress() {
        return stepProgress;
    }

    public void setStepProgress(List<WorkflowStepProgress> stepProgress) {
        this.stepProgress = stepProgress;
    }

    public Map<String, Object> getFormData() {
        return formData;
    }

    public void setFormData(Map<String, Object> formData) {
        this.formData = formData;
    }

    public Employee getFormFilledBy() {
        return formFilledBy;
    }

    public void setFormFilledBy(Employee formFilledBy) {
        this.formFilledBy = formFilledBy;
    }

    public Instant getFormFilledAt() {
        return formFilledAt;
    }

    public void setFormFilledAt(Instant formFilledAt) {
        this.formFilledAt = formFilledAt;
    }

    public int getNumber() {
        return number;
    }

    public void setNumber(int number) {
        this.number = number;
    }

    public boolean isManual() {
        return manual;
    }

    public void setManual(boolean manual) {
        this.manual = manual;
    }

    public Task getSourceTask() {
        return sourceTask;
    }

    public void setSourceTask(Task sourceTask) {
        this.sourceTask = sourceTask;
    }

    public int getCurrentStep() {
        return currentStep;
    }

    public void setCurrentStep(int currentStep) {
        this.currentStep = currentStep;
    }

    public RunStatus getStatus() {
        return status;
    }

    public void setStatus(RunStatus status) {
        this.status = status;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public void setFinishedAt(Instant finishedAt) {
        this.finishedAt = finishedAt;
    }

}
