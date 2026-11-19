package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.leave.LeaveRequest;
import com.decentdecor.workdesk.dto.leave.LeaveResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.EmployeeLeave;
import com.decentdecor.workdesk.entity.enums.NotificationType;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.EmployeeMapper;
import com.decentdecor.workdesk.repository.EmployeeLeaveRepository;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Personal leave.
 *  - employees add their own leave (today or later); admins add it for anyone they can access
 *  - only admins edit or remove it (department admins: people in their departments); an employee who needs a change
 *    raises a ticket about the leave to an admin
 *  - everyone can see their own; admins see the people they can access
 *  - while on leave: no repeating-task copies are made for the person (copies already made for those days and not
 *    started are removed), and tasks due on those days are not overdue until the person decides what to do
 *  - removing a leave makes the repeating copies again
 */
@Service
public class LeaveService {
    private static final long MAX_DAYS = 366;
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final EmployeeLeaveRepository leaves;
    private final TaskRepository tasks;
    private final RecurringGenerator generator;
    private final NotificationService notifications;
    private final People people;
    private final EmployeeMapper employees;
    private final OfficeTime time;
    private final EmployeeRepository employeesRepo;

    public LeaveService(EmployeeLeaveRepository leaves, TaskRepository tasks, RecurringGenerator generator,
                        NotificationService notifications, People people, EmployeeMapper employees, OfficeTime time,
                        EmployeeRepository employeesRepo) {
        this.leaves = leaves;
        this.tasks = tasks;
        this.generator = generator;
        this.notifications = notifications;
        this.people = people;
        this.employees = employees;
        this.time = time;
        this.employeesRepo = employeesRepo;
    }

    /** GET /api/leaves?employeeId=&from=&to= — employees always get their own. */
    @Transactional(readOnly = true)
    public List<LeaveResponse> list(CurrentUser user, Long employeeId, LocalDate from, LocalDate to) {
        Employee me = people.me(user);
        LocalDate a = from == null ? LocalDate.of(1900, 1, 1) : from;
        LocalDate b = to == null ? LocalDate.of(2999, 12, 31) : to;
        List<EmployeeLeave> found;
        if (!me.isAdmin()) {
            found = leaves.findTouchingFor(me.getId(), a, b);
        } else if (employeeId != null) {
            found = leaves.findTouchingFor(people.visibleToAdmin(me, employeeId).getId(), a, b);
        } else {
            found = leaves.findTouching(a, b).stream()
                    .filter(l -> people.canViewDepartment(me, l.getEmployee().getDepartment())).toList();
        }
        return found.stream().map(this::toResponse).toList();
    }

    /** POST /api/leaves — employees: their own, from today on. Admins: anyone they can access, any dates. */
    @Transactional
    public LeaveResponse create(CurrentUser user, LeaveRequest req) {
        Employee me = people.me(user);
        Employee who;
        if (me.isAdmin()) {
            who = people.visibleToAdmin(me, req.employeeId());
        } else {
            if (!me.getId().equals(req.employeeId())) throw new ForbiddenException("You can add leave only for yourself");
            who = me;
        }
        LocalDate start = OfficeTime.parseDate(req.startDate(), "start date");
        LocalDate end = OfficeTime.parseDate(req.endDate(), "end date");
        if (!me.isAdmin() && start.isBefore(time.today())) {
            throw new BadRequestException("Leave starts today or later. For earlier days, ask an admin");
        }
        check(who, start, end, null);

        EmployeeLeave l = new EmployeeLeave();
        l.setEmployee(who);
        l.setCreatedBy(me);
        l.setCreatedAt(time.now());
        apply(l, start, end, req.reason());
        l = leaves.saveAndFlush(l);

        // repeating copies already made for those days and not started are not needed
        tasks.deleteCopiesForAssigneeBetween(who.getId(), TaskStatus.TODO, l.getStartsAt(), l.getEndsAt());
        if (!who.getId().equals(me.getId())) {
            notifications.send(who, null, NotificationType.LEAVE_ADDED, me.getFullName() + " added your leave: " + range(l)
                    + ". Repeating tasks are not created on these days; tasks due then wait for you to decide.");
        } else if (!me.isAdmin()) {
            String msg = me.getFullName() + " added leave: " + range(l) + (l.getReason().isEmpty() ? "" : " (" + l.getReason() + ")");
            employeesRepo.findByRoleAndActiveTrue(Role.ADMIN).stream()
                    .filter(a -> people.canViewDepartment(a, who.getDepartment()))
                    .forEach(a -> notifications.send(a, null, NotificationType.LEAVE_ADDED, msg));
        }
        return toResponse(l);
    }

    /** PUT /api/leaves/{id} — admins only. Days no longer on leave get their repeating copies again. */
    @Transactional
    public LeaveResponse update(CurrentUser user, Long id, LeaveRequest req) {
        Employee me = people.requireAdminRole(user);
        EmployeeLeave l = leaves.findById(id).orElseThrow(() -> NotFoundException.of("Leave"));
        Employee who = l.getEmployee();
        if (!people.canViewDepartment(me, who.getDepartment())) throw NotFoundException.of("Leave");
        LocalDate start = OfficeTime.parseDate(req.startDate(), "start date");
        LocalDate end = OfficeTime.parseDate(req.endDate(), "end date");
        check(who, start, end, l.getId());
        String before = range(l);
        apply(l, start, end, req.reason());
        leaves.saveAndFlush(l);
        tasks.deleteCopiesForAssigneeBetween(who.getId(), TaskStatus.TODO, l.getStartsAt(), l.getEndsAt());
        generator.fillAll();   // days that are no longer on leave get their copies
        if (!who.getId().equals(me.getId())) {
            notifications.send(who, null, NotificationType.LEAVE_ADDED,
                    me.getFullName() + " changed your leave " + before + " to " + range(l) + ".");
        }
        return toResponse(leaves.findById(id).orElseThrow());
    }

    private void check(Employee who, LocalDate start, LocalDate end, Long ignoreId) {
        if (end.isBefore(start)) throw new BadRequestException("The last day of leave must be on or after the first day");
        if (ChronoUnit.DAYS.between(start, end) + 1 > MAX_DAYS) throw new BadRequestException("A leave can be at most 366 days");
        if (leaves.findTouchingFor(who.getId(), start, end).stream().anyMatch(x -> !x.getId().equals(ignoreId))) {
            throw new BadRequestException(who.getFullName() + " already has leave on some of these days");
        }
    }

    private void apply(EmployeeLeave l, LocalDate start, LocalDate end, String reason) {
        l.setStartDate(start);
        l.setEndDate(end);
        l.setStartsAt(time.startOf(start));
        l.setEndsAt(time.startOf(end.plusDays(1)));
        l.setReason(Texts.trimToEmpty(reason));
    }

    @Transactional
    public void delete(CurrentUser user, Long id) {
        Employee me = people.requireAdminRole(user);
        EmployeeLeave l = leaves.findById(id).orElseThrow(() -> NotFoundException.of("Leave"));
        if (!people.canViewDepartment(me, l.getEmployee().getDepartment())) throw NotFoundException.of("Leave");
        if (!l.getEmployee().getId().equals(me.getId())) {
            notifications.send(l.getEmployee(), null, NotificationType.LEAVE_ADDED,
                    me.getFullName() + " removed your leave " + range(l) + ".");
        }
        leaves.delete(l);
        leaves.flush();
        generator.fillAll();   // those days are working days again: make the repeating copies
    }

    static String range(EmployeeLeave l) {
        return l.getStartDate().equals(l.getEndDate()) ? DAY.format(l.getStartDate())
                : DAY.format(l.getStartDate()) + " to " + DAY.format(l.getEndDate());
    }

    private LeaveResponse toResponse(EmployeeLeave l) {
        return new LeaveResponse(l.getId(), employees.toRef(l.getEmployee()), l.getStartDate(), l.getEndDate(), l.getReason(),
                employees.toRef(l.getCreatedBy()), l.getCreatedAt());
    }
}
