package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.TaskTicket;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Table: task_ticket. */
public interface TaskTicketRepository extends JpaRepository<TaskTicket, Long> {

    @EntityGraph(attributePaths = {"task", "raisedBy", "assignedTo", "resolvedBy"})
    List<TaskTicket> findByTaskIdOrderByCreatedAtDescIdDesc(Long taskId);

    @EntityGraph(attributePaths = {"task", "raisedBy", "assignedTo", "resolvedBy"})
    List<TaskTicket> findByAssignedToIdOrderByCreatedAtDescIdDesc(Long employeeId);

    @EntityGraph(attributePaths = {"task", "raisedBy", "assignedTo", "resolvedBy"})
    List<TaskTicket> findByRaisedByIdOrderByCreatedAtDescIdDesc(Long employeeId);

    @EntityGraph(attributePaths = {"task", "raisedBy", "assignedTo", "resolvedBy"})
    List<TaskTicket> findAllByOrderByCreatedAtDescIdDesc();

    /** A person a ticket was raised to (or who raised it) may open that task. */
    @Query("select count(t) > 0 from TaskTicket t where t.task.id = :taskId"
            + " and (t.assignedTo.id = :employeeId or t.raisedBy.id = :employeeId)")
    boolean involves(@Param("taskId") Long taskId, @Param("employeeId") Long employeeId);
}
