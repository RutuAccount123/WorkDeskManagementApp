package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.leave.LeaveRequest;
import com.decentdecor.workdesk.dto.leave.LeaveResponse;
import com.decentdecor.workdesk.dto.ticket.TicketRequest;
import com.decentdecor.workdesk.dto.ticket.TicketResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.LeaveService;
import com.decentdecor.workdesk.service.TicketService;
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

/** Personal leave. The rules are in LeaveService. */
@RestController
@RequestMapping("/api/leaves")
public class LeaveController {
    private final LeaveService leaveService;
    private final TicketService ticketService;

    public LeaveController(LeaveService leaveService, TicketService ticketService) {
        this.leaveService = leaveService;
        this.ticketService = ticketService;
    }

    @GetMapping
    public ResponseEntity<List<LeaveResponse>> list(@AuthenticationPrincipal CurrentUser me,
                                                    @RequestParam(required = false) Long employeeId,
                                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                    @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(leaveService.list(me, employeeId, from, to));
    }

    @PostMapping
    public ResponseEntity<LeaveResponse> create(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody LeaveRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(leaveService.create(me, request));
    }

    /** Admins only. */
    @PutMapping("/{id}")
    public ResponseEntity<LeaveResponse> update(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                @Valid @RequestBody LeaveRequest request) {
        return ResponseEntity.ok(leaveService.update(me, id, request));
    }

    /** The person on leave asks an admin to change or remove it. */
    @PostMapping("/{id}/tickets")
    public ResponseEntity<TicketResponse> raiseTicket(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                      @Valid @RequestBody TicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketService.raiseOnLeave(me, id, request));
    }

    /** Admins only. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        leaveService.delete(me, id);
        return ResponseEntity.noContent().build();
    }
}
