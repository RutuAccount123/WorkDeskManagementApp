package com.decentdecor.workdesk.mapper;

import com.decentdecor.workdesk.dto.recurring.RecurringResponse;
import com.decentdecor.workdesk.entity.RecurringTemplate;
import com.decentdecor.workdesk.util.Enums;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Component;

@Component
public class RecurringMapper {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss");
    private final EmployeeMapper employees;

    public RecurringMapper(EmployeeMapper employees) {
        this.employees = employees;
    }

    public RecurringResponse toResponse(RecurringTemplate t) {
        return new RecurringResponse(t.getId(), t.getTitle(), t.getDescription(), employees.toRef(t.getAssignee()),
                t.getPriority().name(), t.getFrequency().name(), Enums.name(t.getDayOfWeek()), TIME.format(t.getDueTime()),
                t.getStartDate(), t.getScheduledTime() == null ? null : TIME.format(t.getScheduledTime()), t.getDurationMinutes(),
                t.getEstimatedHours(), t.isActive(), t.getLastGeneratedOn(), t.getCreatedAt(), employees.toRef(t.getCreatedBy()), t.isSelfOwned(),
                t.getWorkflow() == null ? null : t.getWorkflow().getId());
    }
}
