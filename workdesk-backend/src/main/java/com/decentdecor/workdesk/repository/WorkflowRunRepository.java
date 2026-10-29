package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.WorkflowRun;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Table: workflow_run (one row of the FMS tracker). */
public interface WorkflowRunRepository extends JpaRepository<WorkflowRun, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from WorkflowRun r where r.id = :id")
    Optional<WorkflowRun> findByIdForUpdate(@Param("id") Long id);

    long countByWorkflowIdAndRunDate(Long workflowId, LocalDate runDate);

    boolean existsByWorkflowIdAndRunDate(Long workflowId, LocalDate runDate);

    List<WorkflowRun> findByRunDate(LocalDate runDate);

    List<WorkflowRun> findBySourceTaskId(Long sourceTaskId);

    List<WorkflowRun> findByWorkflowIdAndRunDateBetween(Long workflowId, LocalDate from, LocalDate to);
}
