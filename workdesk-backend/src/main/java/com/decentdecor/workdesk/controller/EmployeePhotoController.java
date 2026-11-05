package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.employee.ProfilePhotoRequest;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.ProfilePhotoService;
import jakarta.validation.Valid;
import java.util.Optional;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Admin access to an employee's profile photo. */
@RestController
public class EmployeePhotoController {
    private final ProfilePhotoService photos;

    public EmployeePhotoController(ProfilePhotoService photos) {
        this.photos = photos;
    }

    @GetMapping("/api/employees/{id}/photo")
    public ResponseEntity<byte[]> get(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        Optional<byte[]> image = photos.getForEmployee(me, id);
        return image.map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .cacheControl(CacheControl.noStore())
                        .body(bytes))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/api/employees/{id}/photo")
    public ResponseEntity<Void> save(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id,
                                     @Valid @RequestBody ProfilePhotoRequest request) {
        photos.saveForEmployee(me, id, request.image());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/employees/{id}/photo")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        photos.removeForEmployee(me, id);
        return ResponseEntity.noContent().build();
    }
}
