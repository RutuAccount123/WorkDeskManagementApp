package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.enums.Role;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Table: employee. Spring Data builds the SQL from the method names. */
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, Long id);

    List<Employee> findByActiveTrue();

    List<Employee> findByRole(Role role);

    List<Employee> findByRoleAndActiveTrue(Role role);

    long countByRole(Role role);
}
