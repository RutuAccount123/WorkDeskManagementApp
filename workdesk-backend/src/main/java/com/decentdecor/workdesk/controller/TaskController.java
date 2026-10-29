package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.task.ActivityResponse;
import com.decentdecor.workdesk.dto.task.ChecklistTickRequest;
import com.decentdecor.workdesk.dto.task.CommentRequest;
import com.decentdecor.workdesk.dto.task.StatusRequest;
import com.decentdecor.workdesk.dto.task.TaskFilter;
import com.decentdecor.workdesk.dto.task.TaskRequest;
import com.decentdecor.workdesk.dto.task.TaskResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.TaskService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Tasks. The rules (who can do what) are in TaskService. */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** ?scope=assigned|created|review|all &status=TODO&status=… &assigneeId= &priority= &overdue= &q= &workFrom= &workTo= */
    @GetMapping
    public ResponseEntity<List<TaskResponse>> list(@AuthenticationPrincipal CurrentUser me,
                                                   @RequestParam(required = false) String scope,
                                                   @RequestParam(required = false) List<String> status,
                                                   @RequestParam(required = false) Long assigneeId,
                                                   @RequestParam(required = false) String priority,
                                                   @RequestParam(required = false) Boolean overdue,
                                                   @RequestParam(required = false) String q,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workFrom,
                                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workTo) {
        TaskFilter filter = new TaskFilter(scope, status, assigneeId, priority, overdue, q, workFrom, workTo);
        return ResponseEntity.ok(taskService.list(me, filter));
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody TaskRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.create(me, request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> get(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        return ResponseEntity.ok(taskService.get(me, id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> update(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                               @Valid @RequestBody TaskRequest request) {
        return ResponseEntity.ok(taskService.update(me, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        taskService.delete(me, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<TaskResponse> changeStatus(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                     @Valid @RequestBody StatusRequest request) {
        return ResponseEntity.ok(taskService.changeStatus(me, id, request.status(), request.comment()));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<ActivityResponse> comment(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                    @Valid @RequestBody CommentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.comment(me, id, request.comment()));
    }

    @GetMapping("/{id}/activity")
    public ResponseEntity<List<ActivityResponse>> activity(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        return ResponseEntity.ok(taskService.activity(me, id));
    }

    @PostMapping("/{id}/checklist")
    public ResponseEntity<TaskResponse> tick(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                             @Valid @RequestBody ChecklistTickRequest request) {
        return ResponseEntity.ok(taskService.tick(me, id, request));
    }
}
