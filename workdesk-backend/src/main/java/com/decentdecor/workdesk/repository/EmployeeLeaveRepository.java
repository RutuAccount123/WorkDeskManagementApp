package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.EmployeeLeave;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Table: employee_leave. */
public interface EmployeeLeaveRepository extends JpaRepository<EmployeeLeave, Long> {

    /** Leaves that touch [from, to] (both included), oldest first. */
    @EntityGraph(attributePaths = {"employee"})
    @Query("select l from EmployeeLeave l where l.endDate >= :from and l.startDate <= :to order by l.startDate, l.id")
    List<EmployeeLeave> findTouching(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @EntityGraph(attributePaths = {"employee"})
    @Query("select l from EmployeeLeave l where l.employee.id = :employeeId and l.endDate >= :from and l.startDate <= :to"
            + " order by l.startDate, l.id")
    List<EmployeeLeave> findTouchingFor(@Param("employeeId") Long employeeId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Is this person on leave on this day? */
    @Query("select count(l) > 0 from EmployeeLeave l where l.employee.id = :employeeId and l.startDate <= :day and l.endDate >= :day")
    boolean onLeave(@Param("employeeId") Long employeeId, @Param("day") LocalDate day);
}
