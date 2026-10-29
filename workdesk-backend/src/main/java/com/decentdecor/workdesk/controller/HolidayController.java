package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.holiday.HolidayRequest;
import com.decentdecor.workdesk.dto.holiday.HolidayResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.HolidayService;
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

/** Office holidays: everyone reads, admin changes. */
@RestController
@RequestMapping("/api/holidays")
public class HolidayController {
    private final HolidayService holidayService;

    public HolidayController(HolidayService holidayService) {
        this.holidayService = holidayService;
    }

    @GetMapping
    public ResponseEntity<List<HolidayResponse>> list(@AuthenticationPrincipal CurrentUser me,
                                                      @RequestParam(required = false) Integer year,
                                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(holidayService.list(me, year, from, to));
    }

    @PostMapping
    public ResponseEntity<HolidayResponse> create(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody HolidayRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(holidayService.create(me, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<HolidayResponse> update(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                                  @Valid @RequestBody HolidayRequest request) {
        return ResponseEntity.ok(holidayService.update(me, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        holidayService.delete(me, id);
        return ResponseEntity.noContent().build();
    }
}
