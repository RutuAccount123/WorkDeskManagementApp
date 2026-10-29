package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.employee.EmployeeRequest;
import com.decentdecor.workdesk.dto.employee.EmployeeResponse;
import com.decentdecor.workdesk.dto.employee.PersonResponse;
import com.decentdecor.workdesk.dto.employee.ResetPasswordRequest;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.EmployeeService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** People (everyone) and employee records (admin only). */
@RestController
public class EmployeeController {
    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    @GetMapping("/api/people")
    public ResponseEntity<List<PersonResponse>> people(@AuthenticationPrincipal CurrentUser me) {
        return ResponseEntity.ok(employeeService.people(me));
    }

    @GetMapping("/api/employees")
    public ResponseEntity<List<EmployeeResponse>> list(@AuthenticationPrincipal CurrentUser me) {
        return ResponseEntity.ok(employeeService.list(me));
    }

    @GetMapping("/api/employees/{id}")
    public ResponseEntity<EmployeeResponse> get(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        return ResponseEntity.ok(employeeService.get(me, id));
    }

    @PostMapping("/api/employees")
    public ResponseEntity<EmployeeResponse> create(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody EmployeeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeService.create(me, request));
    }

    @PutMapping("/api/employees/{id}")
    public ResponseEntity<EmployeeResponse> update(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                   @Valid @RequestBody EmployeeRequest request) {
        return ResponseEntity.ok(employeeService.update(me, id, request));
    }

    @PatchMapping("/api/employees/{id}/active")
    public ResponseEntity<EmployeeResponse> setActive(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id, @RequestParam boolean value) {
        return ResponseEntity.ok(employeeService.setActive(me, id, value));
    }

    @PostMapping("/api/employees/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                              @RequestBody ResetPasswordRequest request) {
        employeeService.resetPassword(me, id, request.newPassword());
        return ResponseEntity.noContent().build();
    }
}
