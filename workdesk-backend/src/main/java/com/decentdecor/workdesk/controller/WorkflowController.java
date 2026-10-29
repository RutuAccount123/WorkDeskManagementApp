package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.workflow.FillFormRequest;
import com.decentdecor.workdesk.dto.workflow.RunResponse;
import com.decentdecor.workdesk.dto.workflow.StartRunRequest;
import com.decentdecor.workdesk.dto.workflow.WorkflowRequest;
import com.decentdecor.workdesk.dto.workflow.WorkflowResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.WorkflowService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Workflows (FMS), their runs, and the tracker. */
@RestController
@RequestMapping("/api/workflows")
public class WorkflowController {
    private final WorkflowService workflowService;

    public WorkflowController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    /** All FMS you can see; ?taskId= for the ones linked to a task. */
    @GetMapping
    public ResponseEntity<List<WorkflowResponse>> list(@AuthenticationPrincipal CurrentUser me, @RequestParam(required = false) Long taskId) {
        return ResponseEntity.ok(workflowService.list(me, taskId));
    }

    @PostMapping
    public ResponseEntity<WorkflowResponse> create(@AuthenticationPrincipal CurrentUser me, @RequestBody WorkflowRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workflowService.create(me, request));
    }

    /** Runs on a day (?date=, default today) or for a task (?taskId=). */
    @GetMapping("/runs")
    public ResponseEntity<List<RunResponse>> runs(@AuthenticationPrincipal CurrentUser me,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                                  @RequestParam(required = false) Long taskId) {
        return ResponseEntity.ok(workflowService.runs(me, date, taskId));
    }

    @GetMapping("/runs/{runId}")
    public ResponseEntity<RunResponse> run(@AuthenticationPrincipal CurrentUser me, @PathVariable Long runId) {
        return ResponseEntity.ok(workflowService.run(me, runId));
    }

    @PostMapping("/runs/{runId}/form")
    public ResponseEntity<RunResponse> fillForm(@AuthenticationPrincipal CurrentUser me, @PathVariable Long runId,
                                                @RequestBody FillFormRequest request) {
        return ResponseEntity.ok(workflowService.fillForm(me, runId, request.formData()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkflowResponse> get(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        return ResponseEntity.ok(workflowService.get(me, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<WorkflowResponse> update(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                   @RequestBody WorkflowRequest request) {
        return ResponseEntity.ok(workflowService.update(me, id, request));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<WorkflowResponse> setActive(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id, @RequestParam boolean value) {
        return ResponseEntity.ok(workflowService.setActive(me, id, value));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        workflowService.delete(me, id);
        return ResponseEntity.noContent().build();
    }

    /** Start a new run now with the form filled in. */
    @PostMapping("/{id}/start-now")
    public ResponseEntity<RunResponse> startNow(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                @RequestBody(required = false) StartRunRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workflowService.startNow(me, id, request));
    }

    /** Tracker rows between two dates, newest first. */
    @GetMapping("/{id}/runs")
    public ResponseEntity<List<RunResponse>> tracker(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(workflowService.tracker(me, id, from, to));
    }
}
