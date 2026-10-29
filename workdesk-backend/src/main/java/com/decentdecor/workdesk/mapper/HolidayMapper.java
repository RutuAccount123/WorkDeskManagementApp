package com.decentdecor.workdesk.mapper;

import com.decentdecor.workdesk.dto.holiday.HolidayResponse;
import com.decentdecor.workdesk.entity.Holiday;
import org.springframework.stereotype.Component;

@Component
public class HolidayMapper {

    public HolidayResponse toResponse(Holiday h) {
        return new HolidayResponse(h.getId(), h.getHolidayDate(), h.getName(), h.getNote(), h.getCreatedAt());
    }
}
