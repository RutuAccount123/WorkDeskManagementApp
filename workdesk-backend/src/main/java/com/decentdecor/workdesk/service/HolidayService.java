package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.holiday.HolidayRequest;
import com.decentdecor.workdesk.dto.holiday.HolidayResponse;
import com.decentdecor.workdesk.entity.Holiday;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.HolidayMapper;
import com.decentdecor.workdesk.repository.HolidayRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Office holidays: everyone can see them, only admins change them.
 * A new holiday removes the daily / weekly copies already made for that day;
 * deleting one brings them back.
 */
@Service
public class HolidayService {
    private final HolidayRepository holidays;
    private final TaskRepository tasks;
    private final RecurringGenerator generator;
    private final People people;
    private final HolidayMapper mapper;
    private final OfficeTime time;

    public HolidayService(HolidayRepository holidays, TaskRepository tasks, RecurringGenerator generator, People people,
                          HolidayMapper mapper, OfficeTime time) {
        this.holidays = holidays;
        this.tasks = tasks;
        this.generator = generator;
        this.people = people;
        this.mapper = mapper;
        this.time = time;
    }

    /** ?year=2026, or ?from=&to=, or everything. */
    @Transactional(readOnly = true)
    public List<HolidayResponse> list(CurrentUser user, Integer year, LocalDate from, LocalDate to) {
        people.me(user);
        List<Holiday> list;
        if (year != null) {
            list = holidays.findByHolidayDateBetweenOrderByHolidayDateAsc(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
        } else if (from != null || to != null) {
            list = holidays.findByHolidayDateBetweenOrderByHolidayDateAsc(from == null ? LocalDate.of(1900, 1, 1) : from,
                    to == null ? LocalDate.of(2999, 12, 31) : to);
        } else {
            list = holidays.findAllByOrderByHolidayDateAsc();
        }
        return list.stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public HolidayResponse create(CurrentUser user, HolidayRequest req) {
        people.requireAdmin(user);
        LocalDate day = checkDate(req, null);
        Holiday h = new Holiday();
        h.setHolidayDate(day);
        h.setName(req.name().trim());
        h.setNote(Texts.trimToEmpty(req.note()));
        h.setCreatedAt(time.now());
        h = holidays.saveAndFlush(h);
        removeCopiesOn(day);
        return mapper.toResponse(h);
    }

    @Transactional
    public HolidayResponse update(CurrentUser user, Long id, HolidayRequest req) {
        people.requireAdmin(user);
        Holiday h = holidays.findById(id).orElseThrow(() -> NotFoundException.of("Holiday"));
        LocalDate oldDay = h.getHolidayDate();
        LocalDate day = checkDate(req, id);
        h.setHolidayDate(day);
        h.setName(req.name().trim());
        h.setNote(Texts.trimToEmpty(req.note()));
        h = holidays.saveAndFlush(h);
        removeCopiesOn(day);
        if (!oldDay.equals(day)) generator.fillAll();   // the old date is a working day again
        return mapper.toResponse(holidays.findById(id).orElseThrow());
    }

    @Transactional
    public void delete(CurrentUser user, Long id) {
        people.requireAdmin(user);
        Holiday h = holidays.findById(id).orElseThrow(() -> NotFoundException.of("Holiday"));
        holidays.delete(h);
        holidays.flush();
        generator.fillAll();
    }

    // ------------------------------------------------------------ inside

    private LocalDate checkDate(HolidayRequest req, Long id) {
        LocalDate day = OfficeTime.parseDate(req.date(), "date");
        if (day == null) throw new BadRequestException("Choose a date");
        holidays.findByHolidayDate(day).filter(other -> !other.getId().equals(id)).ifPresent(other -> {
            throw new BadRequestException(day + " is already a holiday (" + other.getName() + ")");
        });
        return day;
    }

    /** Daily / weekly copies already made for that day (and not started) are no longer needed. */
    private void removeCopiesOn(LocalDate day) {
        tasks.deleteCopiesBetween(TaskStatus.TODO, time.startOf(day), time.startOf(day.plusDays(1)));
    }
}
