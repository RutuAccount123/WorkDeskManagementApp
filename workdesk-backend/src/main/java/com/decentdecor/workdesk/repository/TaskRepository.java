package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Table: task.
 * The task list filters (scope, status, search…) are built in TaskSpecifications.
 */
public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    /** Loads the people and links together with the tasks, so the list needs only a few queries. */
    @Override
    @EntityGraph(attributePaths = {"assignee", "createdBy", "reviewer", "recurringTemplate", "workflowRun", "workflowRun.workflow"})
    List<Task> findAll(Specification<Task> spec);

    /** Locks the row while it is being changed, so two people can't change the same task at the same moment. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Task t where t.id = :id")
    Optional<Task> findByIdForUpdate(@Param("id") Long id);

    List<Task> findByAssigneeId(Long assigneeId);

    // ------------------------------------------------------------ FMS steps

    List<Task> findByWorkflowRunIdOrderByWorkflowStepAsc(Long workflowRunId);

    List<Task> findByWorkflowRunIdIn(Collection<Long> workflowRunIds);

    Optional<Task> findByWorkflowRunIdAndWorkflowStep(Long workflowRunId, Integer workflowStep);

    boolean existsByWorkflowRunIdAndWorkflowStep(Long workflowRunId, Integer workflowStep);

    /** Is this person on any task linked to the FMS? (used for "can see this FMS") */
    @Query("""
            select case when count(t) > 0 then true else false end
            from Task t left join t.reviewer r
            where t.linkedWorkflow.id = :workflowId
              and (t.assignee.id = :employeeId or t.createdBy.id = :employeeId
                   or (r.id = :employeeId and t.workflowRun is null))
            """)
    boolean isInvolvedInLinkedTask(@Param("workflowId") Long workflowId, @Param("employeeId") Long employeeId);

    // ------------------------------------------------------------ daily & weekly copies

    @Query("""
            select case when count(t) > 0 then true else false end from Task t
            where t.recurringTemplate.id = :templateId and t.dueAt >= :from and t.dueAt < :to
            """)
    boolean existsCopyBetween(@Param("templateId") Long templateId, @Param("from") Instant from, @Param("to") Instant to);

    /** Future copies nobody has started (removed when the repeating task is paused, changed or deleted). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from Task t
            where t.recurringTemplate.id = :templateId and t.status = :status and t.dueAt >= :from
            """)
    int deleteCopiesFrom(@Param("templateId") Long templateId, @Param("status") TaskStatus status, @Param("from") Instant from);

    /** Untouched copies of any repeating task on one day (removed when that day becomes a holiday). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from Task t
            where t.recurringTemplate is not null and t.status = :status and t.dueAt >= :from and t.dueAt < :to
            """)
    int deleteCopiesBetween(@Param("status") TaskStatus status, @Param("from") Instant from, @Param("to") Instant to);

    // ------------------------------------------------------------ reminders

    /** Open work that needs a "due soon" or "overdue" reminder it hasn't had yet. */
    @EntityGraph(attributePaths = {"assignee", "createdBy"})
    @Query("""
            select t from Task t
            where t.status in :open and t.dueAt is not null
              and ((t.dueAt < :now and t.overdueReminded = false)
                   or (t.dueAt >= :now and t.dueAt <= :soon and t.dueSoonReminded = false))
            """)
    List<Task> findNeedingReminder(@Param("open") Collection<TaskStatus> open, @Param("now") Instant now, @Param("soon") Instant soon);
}
