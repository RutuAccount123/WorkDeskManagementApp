package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.instrument.GiveInstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.InstrumentRepairResponse;
import com.decentdecor.workdesk.dto.instrument.InstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.RemoveInstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.RepairDoneRequest;
import com.decentdecor.workdesk.dto.instrument.RepairInstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.InstrumentResponse;
import com.decentdecor.workdesk.dto.instrument.InstrumentUseResponse;
import com.decentdecor.workdesk.dto.instrument.SubmitInstrumentRequest;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.InstrumentService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Instruments tab: site instruments, who has them, and their history. Open to everyone signed in. */
@RestController
@RequestMapping("/api/instruments")
public class InstrumentController {
    private final InstrumentService instrumentService;

    public InstrumentController(InstrumentService instrumentService) {
        this.instrumentService = instrumentService;
    }

    /** removed=true: the removed instruments (with who removed them and why) instead of the list. */
    @GetMapping
    public ResponseEntity<List<InstrumentResponse>> list(@AuthenticationPrincipal CurrentUser me,
                                                         @RequestParam(defaultValue = "false") boolean removed) {
        return ResponseEntity.ok(instrumentService.list(me, removed));
    }

    @GetMapping("/{id}/repairs")
    public ResponseEntity<List<InstrumentRepairResponse>> repairs(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        return ResponseEntity.ok(instrumentService.repairs(me, id));
    }

    /** Send for repair: the repair form. */
    @PostMapping("/{id}/repair")
    public ResponseEntity<InstrumentResponse> repair(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                     @Valid @RequestBody RepairInstrumentRequest request) {
        return ResponseEntity.ok(instrumentService.repair(me, id, request));
    }

    /** Back from repair: free in the office store. */
    @PostMapping("/{id}/repair/done")
    public ResponseEntity<InstrumentResponse> repairDone(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                         @Valid @RequestBody(required = false) RepairDoneRequest request) {
        return ResponseEntity.ok(instrumentService.repairDone(me, id, request));
    }

    /** Remove from the list (with the reason); history is kept. */
    @PostMapping("/{id}/remove")
    public ResponseEntity<InstrumentResponse> remove(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                     @Valid @RequestBody RemoveInstrumentRequest request) {
        return ResponseEntity.ok(instrumentService.remove(me, id, request));
    }

    @PostMapping
    public ResponseEntity<InstrumentResponse> create(@AuthenticationPrincipal CurrentUser me,
                                                     @Valid @RequestBody InstrumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(instrumentService.create(me, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InstrumentResponse> update(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                     @Valid @RequestBody InstrumentRequest request) {
        return ResponseEntity.ok(instrumentService.update(me, id, request));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<InstrumentUseResponse>> history(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        return ResponseEntity.ok(instrumentService.history(me, id));
    }

    /** Give a free instrument to a person, or shift it to another person. */
    @PostMapping("/{id}/give")
    public ResponseEntity<InstrumentResponse> give(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                   @Valid @RequestBody GiveInstrumentRequest request) {
        return ResponseEntity.ok(instrumentService.give(me, id, request));
    }

    /** Back to the office store. */
    @PostMapping("/{id}/submit")
    public ResponseEntity<InstrumentResponse> submit(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                     @Valid @RequestBody(required = false) SubmitInstrumentRequest request) {
        return ResponseEntity.ok(instrumentService.submit(me, id, request));
    }
}
