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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile/photo")
public class ProfilePhotoController {
    private final ProfilePhotoService photos;

    public ProfilePhotoController(ProfilePhotoService photos) {
        this.photos = photos;
    }

    @GetMapping
    public ResponseEntity<byte[]> get(@AuthenticationPrincipal CurrentUser me) {
        Optional<byte[]> image = photos.get(me);
        return image.map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .cacheControl(CacheControl.noStore())
                        .body(bytes))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public ResponseEntity<Void> save(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody ProfilePhotoRequest request) {
        photos.save(me, request.image());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> remove(@AuthenticationPrincipal CurrentUser me) {
        photos.remove(me);
        return ResponseEntity.noContent().build();
    }
}
