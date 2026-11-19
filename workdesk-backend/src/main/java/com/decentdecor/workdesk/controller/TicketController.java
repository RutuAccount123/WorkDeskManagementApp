package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.ticket.TicketRequest;
import com.decentdecor.workdesk.dto.ticket.TicketResolveRequest;
import com.decentdecor.workdesk.dto.ticket.TicketResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.TicketService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Tickets raised on tasks. The rules are in TicketService. */
@RestController
@RequestMapping("/api")
public class TicketController {
    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    /** ?scope=assigned (to me, default) | raised (by me) | all (admin) &status=OPEN|RESOLVED */
    @GetMapping("/tickets")
    public ResponseEntity<List<TicketResponse>> list(@AuthenticationPrincipal CurrentUser me,
                                                     @RequestParam(required = false) String scope,
                                                     @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ticketService.list(me, scope, status));
    }

    @PostMapping("/tickets/{id}/resolve")
    public ResponseEntity<TicketResponse> resolve(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                  @Valid @RequestBody TicketResolveRequest request) {
        return ResponseEntity.ok(ticketService.resolve(me, id, request.reply()));
    }

    /** The person the ticket is assigned to finishes the task themselves (it moves to them and is done). */
    @PostMapping("/tickets/{id}/done")
    public ResponseEntity<TicketResponse> markTaskDone(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                       @Valid @RequestBody TicketResolveRequest request) {
        return ResponseEntity.ok(ticketService.markTaskDone(me, id, request.reply()));
    }

    @GetMapping("/tasks/{id}/tickets")
    public ResponseEntity<List<TicketResponse>> forTask(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        return ResponseEntity.ok(ticketService.forTask(me, id));
    }

    @PostMapping("/tasks/{id}/tickets")
    public ResponseEntity<TicketResponse> raise(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                @Valid @RequestBody TicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketService.raise(me, id, request));
    }
}
