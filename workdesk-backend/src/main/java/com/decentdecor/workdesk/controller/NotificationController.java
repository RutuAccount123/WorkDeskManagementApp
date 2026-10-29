package com.decentdecor.workdesk.controller;

import com.decentdecor.workdesk.dto.common.CountResponse;
import com.decentdecor.workdesk.dto.notification.NotificationResponse;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.NotificationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Your own notifications only. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> list(@AuthenticationPrincipal CurrentUser me, @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(notificationService.list(me, limit));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<CountResponse> unreadCount(@AuthenticationPrincipal CurrentUser me) {
        return ResponseEntity.ok(notificationService.unreadCount(me));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal CurrentUser me, @PathVariable Long id) {
        notificationService.markRead(me, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal CurrentUser me) {
        notificationService.markAllRead(me);
        return ResponseEntity.noContent().build();
    }
}
