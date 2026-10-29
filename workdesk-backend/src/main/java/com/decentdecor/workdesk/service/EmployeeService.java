package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.employee.EmployeeRequest;
import com.decentdecor.workdesk.dto.employee.EmployeeResponse;
import com.decentdecor.workdesk.dto.employee.PersonResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ConflictException;
import com.decentdecor.workdesk.mapper.EmployeeMapper;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.security.PasswordPolicy;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.util.Enums;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * People and employee records.
 * Everyone can read the people list (to assign work). Only admins add, edit, deactivate
 * or reset passwords (also blocked in SecurityConfig for non-admins).
 */
@Service
public class EmployeeService {
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Comparator<Employee> BY_NAME = Comparator.comparing((Employee e) -> e.getFullName().toLowerCase(Locale.ROOT))
            .thenComparing(Employee::getId);

    private final EmployeeRepository employees;
    private final PasswordEncoder encoder;
    private final People people;
    private final EmployeeMapper mapper;
    private final OfficeTime time;

    public EmployeeService(EmployeeRepository employees, PasswordEncoder encoder, People people, EmployeeMapper mapper, OfficeTime time) {
        this.employees = employees;
        this.encoder = encoder;
        this.people = people;
        this.mapper = mapper;
        this.time = time;
    }

    /** GET /api/people — active people, sorted by name. */
    @Transactional(readOnly = true)
    public List<PersonResponse> people(CurrentUser user) {
        people.me(user);
        return employees.findByActiveTrue().stream().sorted(BY_NAME).map(mapper::toPerson).toList();
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> list(CurrentUser user) {
        people.requireAdmin(user);
        return employees.findAll().stream().sorted(BY_NAME).map(mapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public EmployeeResponse get(CurrentUser user, Long id) {
        people.requireAdmin(user);
        return mapper.toResponse(people.get(id));
    }

    /** Adds a person with a first password (only the BCrypt hash is stored). */
    @Transactional
    public EmployeeResponse create(CurrentUser user, EmployeeRequest req) {
        people.requireAdmin(user);
        String problem = PasswordPolicy.problem(req.password(), "password");
        if (problem != null) throw new BadRequestException(problem);
        String email = checkEmail(req.email(), null);
        Employee e = new Employee();
        copy(req, e, email);
        e.setPasswordHash(encoder.encode(req.password()));
        e.setActive(true);
        e.setCreatedAt(time.now());
        return mapper.toResponse(employees.save(e));
    }

    @Transactional
    public EmployeeResponse update(CurrentUser user, Long id, EmployeeRequest req) {
        Employee me = people.requireAdmin(user);
        Employee e = people.get(id);
        String email = checkEmail(req.email(), id);
        Role newRole = role(req.role());
        if (e.getId().equals(me.getId()) && newRole != Role.ADMIN) throw new BadRequestException("You cannot remove your own admin role");
        if (e.getRole() != newRole) e.signOutEverywhere();   // a role change takes effect at once
        copy(req, e, email);
        return mapper.toResponse(e);
    }

    /** Deactivating also signs the person out everywhere. */
    @Transactional
    public EmployeeResponse setActive(CurrentUser user, Long id, boolean active) {
        Employee me = people.requireAdmin(user);
        if (id.equals(me.getId()) && !active) throw new BadRequestException("You cannot deactivate your own account");
        Employee e = people.get(id);
        if (e.isActive() && !active) e.signOutEverywhere();
        e.setActive(active);
        return mapper.toResponse(e);
    }

    @Transactional
    public void resetPassword(CurrentUser user, Long id, String newPassword) {
        people.requireAdmin(user);
        String problem = PasswordPolicy.problem(newPassword, "newPassword");
        if (problem != null) throw new BadRequestException(problem);
        Employee e = people.get(id);
        e.setPasswordHash(encoder.encode(newPassword));
        e.signOutEverywhere();
    }

    // ------------------------------------------------------------ inside

    private String checkEmail(String value, Long id) {
        String email = Texts.trimToEmpty(value).toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(email).matches()) throw new BadRequestException("email: must be a valid email address");
        boolean taken = id == null ? employees.existsByEmail(email) : employees.existsByEmailAndIdNot(email, id);
        if (taken) throw new ConflictException("An employee with this email already exists");
        return email;
    }

    private static Role role(String value) {
        return Enums.parse(Role.class, value, null, "role: choose Admin or Employee");
    }

    private static void copy(EmployeeRequest req, Employee e, String email) {
        e.setEmployeeCode(Texts.trimToNull(req.employeeCode()));
        e.setFullName(req.fullName().trim());
        e.setEmail(email);
        e.setRole(role(req.role()));
        e.setDepartment(Texts.trimToNull(req.department()));
        e.setDesignation(Texts.trimToNull(req.designation()));
        e.setPhone(Texts.trimToNull(req.phone()));
    }
}
