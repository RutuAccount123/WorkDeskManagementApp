package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.publicform.PublicFormResponse;
import com.decentdecor.workdesk.dto.publicform.PublicFormSubmitRequest;
import com.decentdecor.workdesk.dto.publicform.PublicFormSubmitResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.PublicFormService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Shareable FMS form links. Open to everyone (no sign-in): the secret token is the permission.
 * When a Work Desk member is signed in, `me` is set and the entry is saved under their name.
 */
@RestController
@RequestMapping("/api/public/forms")
public class PublicFormController {
    private final PublicFormService publicForms;

    public PublicFormController(PublicFormService publicForms) {
        this.publicForms = publicForms;
    }

    @GetMapping("/{token}")
    public ResponseEntity<PublicFormResponse> get(@AuthenticationPrincipal CurrentUser me, @PathVariable String token) {
        return ResponseEntity.ok(publicForms.get(token, me));
    }

    @PostMapping("/{token}")
    public ResponseEntity<PublicFormSubmitResponse> submit(@AuthenticationPrincipal CurrentUser me, @PathVariable String token,
                                                           @RequestBody(required = false) PublicFormSubmitRequest request,
                                                           HttpServletRequest http) {
        return ResponseEntity.status(HttpStatus.CREATED).body(publicForms.submit(token,
                request == null ? null : request.formData(), request == null ? null : request.filledByName(),
                me, http.getRemoteAddr()));
    }
}
