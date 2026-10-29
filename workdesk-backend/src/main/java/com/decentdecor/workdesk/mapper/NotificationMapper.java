package com.decentdecor.workdesk.mapper;

import com.decentdecor.workdesk.dto.notification.NotificationResponse;
import com.decentdecor.workdesk.entity.Notification;
import org.springframework.stereotype.Component;

@Component
public class NotificationMapper {

    public NotificationResponse toResponse(Notification n) {
        return new NotificationResponse(n.getId(), n.getTask() == null ? null : n.getTask().getId(), n.getType().name(),
                n.getMessage(), n.isRead(), n.getCreatedAt());
    }
}
