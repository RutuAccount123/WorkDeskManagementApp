package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.recurring.RecurringRequest;
import com.decentdecor.workdesk.dto.recurring.RecurringResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.RecurringTemplate;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.RepeatFrequency;
import com.decentdecor.workdesk.entity.enums.WeekDay;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.RecurringMapper;
import com.decentdecor.workdesk.repository.RecurringTemplateRepository;
import com.decentdecor.workdesk.repository.WorkflowRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.service.support.WorkflowAccess;
import com.decentdecor.workdesk.service.support.WorkingDays;
import com.decentdecor.workdesk.util.Enums;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily & weekly tasks.
 * Admins manage everyone's. Employees see theirs, and change only the ones they set up themselves.
 */
@Service
public class RecurringTaskService {
    private final RecurringTemplateRepository templates;
    private final WorkflowRepository workflows;
    private final RecurringGenerator generator;
    private final WorkingDays workingDays;
    private final People people;
    private final WorkflowAccess workflowAccess;
    private final RecurringMapper mapper;
    private final OfficeTime time;

    public RecurringTaskService(RecurringTemplateRepository templates, WorkflowRepository workflows, RecurringGenerator generator,
                                WorkingDays workingDays, People people, WorkflowAccess workflowAccess, RecurringMapper mapper, OfficeTime time) {
        this.templates = templates;
        this.workflows = workflows;
        this.generator = generator;
        this.workingDays = workingDays;
        this.people = people;
        this.workflowAccess = workflowAccess;
        this.mapper = mapper;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public List<RecurringResponse> list(CurrentUser user) {
        Employee me = people.me(user);
        List<RecurringTemplate> list = me.isAdmin() ? templates.findAllByOrderByTitleAsc()
                : templates.findByAssigneeIdOrderByTitleAsc(me.getId());
        return list.stream().map(mapper::toResponse).toList();
    }

    /** Creates it and makes the copies for the next 7 days straight away. */
    @Transactional
    public RecurringResponse create(CurrentUser user, RecurringRequest req) {
        Employee me = people.me(user);
        RecurringTemplate tpl = new RecurringTemplate();
        tpl.setCreatedBy(me);
        tpl.setActive(true);
        tpl.setCreatedAt(time.now());
        apply(tpl, req, me);
        tpl = templates.save(tpl);
        generator.fill(tpl);
        return mapper.toResponse(tpl);
    }

    /** Edit: future untouched copies are removed and made again with the new details. */
    @Transactional
    public RecurringResponse update(CurrentUser user, Long id, RecurringRequest req) {
        Employee me = people.me(user);
        RecurringTemplate tpl = find(id, me, true);
        apply(tpl, req, me);
        templates.saveAndFlush(tpl);
        generator.removeFutureCopies(id);
        tpl = templates.findById(id).orElseThrow();   // reload: removing copies clears loaded data
        generator.fill(tpl);
        return mapper.toResponse(tpl);
    }

    @Transactional
    public RecurringResponse setActive(CurrentUser user, Long id, boolean active) {
        Employee me = people.me(user);
        RecurringTemplate tpl = find(id, me, true);
        tpl.setActive(active);
        templates.saveAndFlush(tpl);
        if (active) {
            generator.fill(tpl);
        } else {
            generator.removeFutureCopies(id);
            tpl = templates.findById(id).orElseThrow();
        }
        return mapper.toResponse(tpl);
    }

    /** Past copies stay in everyone's record. */
    @Transactional
    public void delete(CurrentUser user, Long id) {
        Employee me = people.me(user);
        find(id, me, true);
        generator.removeFutureCopies(id);
        templates.deleteById(id);
    }

    /** "Create today's task" now. */
    @Transactional
    public void generateNow(CurrentUser user, Long id) {
        Employee me = people.me(user);
        RecurringTemplate tpl = find(id, me, true);
        if (generator.hasCopyOn(tpl, time.today())) throw new BadRequestException("Today’s task for this template has already been created");
        if (!workingDays.isWorkingDay(time.today())) {
            throw new BadRequestException("Today is a weekly off or an office holiday, so no task is created");
        }
        generator.makeCopy(tpl, time.today());
    }

    // ------------------------------------------------------------ inside

    /** Admins: any. Employees: only their own (and change only what they set up). */
    private RecurringTemplate find(Long id, Employee me, boolean forChange) {
        RecurringTemplate tpl = templates.findById(id).orElseThrow(() -> NotFoundException.of("Repeating task"));
        if (!me.isAdmin() && !tpl.getAssignee().getId().equals(me.getId())) throw NotFoundException.of("Repeating task");
        if (forChange && !me.isAdmin() && !tpl.getCreatedBy().getId().equals(me.getId())) {
            throw new ForbiddenException("Only your admin can change this repeating task");
        }
        return tpl;
    }

    /** Checks the request and copies it onto the template. */
    private void apply(RecurringTemplate tpl, RecurringRequest req, Employee me) {
        RepeatFrequency frequency = Enums.parse(RepeatFrequency.class, req.frequency(), null, "Choose how often this task repeats");
        WeekDay day = null;
        if (frequency == RepeatFrequency.WEEKLY) {
            if (Texts.isBlank(req.dayOfWeek())) throw new BadRequestException("Choose a day of the week for weekly tasks");
            if ("SUNDAY".equals(req.dayOfWeek())) throw new BadRequestException("Sunday is the weekly off. Choose Monday to Saturday.");
            day = Enums.parse(WeekDay.class, req.dayOfWeek(), null, "Choose a day of the week for weekly tasks");
        }
        tpl.setTitle(req.title().trim());
        tpl.setDescription(Texts.trimToEmpty(req.description()));
        // employees always set up repeating work for themselves
        tpl.setAssignee(me.isAdmin() ? people.activeAssignee(req.assigneeId()) : me);
        tpl.setPriority(Enums.parse(Priority.class, req.priority(), Priority.MEDIUM, "Choose a valid priority"));
        tpl.setFrequency(frequency);
        tpl.setDayOfWeek(day);
        tpl.setDueTime(OfficeTime.parseTime(Texts.isBlank(req.dueTime()) ? "18:00" : req.dueTime(), "Choose a due time"));
        tpl.setEstimatedHours(req.estimatedHours());
        if (req.estimatedHours() != null
                && (req.estimatedHours().compareTo(new java.math.BigDecimal("0.25")) < 0
                || req.estimatedHours().compareTo(new java.math.BigDecimal("24")) > 0)) {
            throw new BadRequestException("Estimated hours must be between 0.25 and 24");
        }
        if (req.workflowId() != null) tpl.setWorkflow(linkableWorkflow(req.workflowId(), me));
    }

    private Workflow linkableWorkflow(Long workflowId, Employee me) {
        Workflow w = workflows.findById(workflowId).orElse(null);
        if (w == null || !workflowAccess.canSee(w, me)) throw new BadRequestException("Choose an FMS you can access");
        return w;
    }
}
