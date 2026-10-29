package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.exception.UnauthorizedException;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import org.springframework.stereotype.Component;

/** Looking up people with the usual checks (signed in, active, may be given work, may review). */
@Component
public class People {
    private final EmployeeRepository employees;

    public People(EmployeeRepository employees) {
        this.employees = employees;
    }

    /** The signed-in person as an entity (must still be active). */
    public Employee me(CurrentUser user) {
        return employees.findById(user.id()).filter(Employee::isActive)
                .orElseThrow(() -> new UnauthorizedException("Not signed in"));
    }

    public Employee requireAdmin(CurrentUser user) {
        Employee me = me(user);
        if (!me.isAdmin()) throw new ForbiddenException();
        return me;
    }

    public Employee get(Long id) {
        if (id == null) throw NotFoundException.of("Employee");
        return employees.findById(id).orElseThrow(() -> NotFoundException.of("Employee"));
    }

    /** Someone who can be given work: must exist and be active. */
    public Employee activeAssignee(Long id) {
        if (id == null) throw new BadRequestException("Choose a person");
        Employee e = get(id);
        if (!e.isActive()) throw new BadRequestException(e.getFullName() + " is inactive and cannot be assigned work");
        return e;
    }

    /**
     * The chosen reviewer. Empty → fallback (may be null = no review).
     * The person doing the task can never review it.
     */
    public Employee pickReviewer(Long reviewerId, Employee assignee, Employee fallback) {
        if (reviewerId == null) return fallback;
        Employee r = employees.findById(reviewerId).orElse(null);
        if (r == null || !r.isActive()) throw new BadRequestException("Choose an active person as reviewer");
        if (r.getId().equals(assignee.getId())) throw new BadRequestException("The person doing the task cannot also review it");
        return r;
    }
}
