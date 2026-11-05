package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.recurring.RecurringRequest;
import com.decentdecor.workdesk.dto.recurring.RecurringBatchRequest;
import com.decentdecor.workdesk.dto.recurring.RecurringResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.RecurringTaskService;
import jakarta.validation.Valid;
import java.util.List;
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

/** Repeating tasks. */
@RestController
@RequestMapping("/api/recurring")
public class RecurringTaskController {
    private final RecurringTaskService recurringService;

    public RecurringTaskController(RecurringTaskService recurringService) {
        this.recurringService = recurringService;
    }

    @GetMapping
    public ResponseEntity<List<RecurringResponse>> list(@AuthenticationPrincipal CurrentUser me) {
        return ResponseEntity.ok(recurringService.list(me));
    }

    @PostMapping
    public ResponseEntity<RecurringResponse> create(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody RecurringRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(recurringService.create(me, request));
    }

    @PostMapping("/batch")
    public ResponseEntity<List<RecurringResponse>> createBatch(@AuthenticationPrincipal CurrentUser me,
                                                               @Valid @RequestBody RecurringBatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(recurringService.createBatch(me, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecurringResponse> update(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                    @Valid @RequestBody RecurringRequest request) {
        return ResponseEntity.ok(recurringService.update(me, id, request));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<RecurringResponse> setActive(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id, @RequestParam boolean value) {
        return ResponseEntity.ok(recurringService.setActive(me, id, value));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        recurringService.delete(me, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/generate-now")
    public ResponseEntity<Void> generateNow(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        recurringService.generateNow(me, id);
        return ResponseEntity.noContent().build();
    }
}
