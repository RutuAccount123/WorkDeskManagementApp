package com.decentdecor.workdesk.mapper;

import com.decentdecor.workdesk.dto.common.PersonRef;
import com.decentdecor.workdesk.dto.employee.EmployeeResponse;
import com.decentdecor.workdesk.dto.employee.PersonResponse;
import com.decentdecor.workdesk.entity.Employee;
import org.springframework.stereotype.Component;

/** Employee entity → response DTOs. The password hash is never copied. */
@Component
public class EmployeeMapper {

    public EmployeeResponse toResponse(Employee e) {
        return new EmployeeResponse(e.getId(), e.getEmployeeCode(), e.getFullName(), e.getEmail(), e.getRole().name(),
                e.getDepartment(), e.getDesignation(), e.getPhone(), e.isActive(), e.getCreatedAt());
    }

    public PersonResponse toPerson(Employee e) {
        return new PersonResponse(e.getId(), e.getFullName(), e.getDepartment(), e.getDesignation(), e.getRole().name(), e.isActive());
    }

    /** Short reference, or null. */
    public PersonRef toRef(Employee e) {
        return e == null ? null : new PersonRef(e.getId(), e.getFullName(), e.getDepartment());
    }
}
