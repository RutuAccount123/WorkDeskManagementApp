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

    /** The task a ticket became for the person it was raised to. */
    Optional<Task> findFirstByFromTicketId(Long ticketId);

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
            where t.recurringTemplate.id = :templateId
              and ((t.scheduledAt >= :from and t.scheduledAt < :to)
                   or (t.scheduledAt is null and t.dueAt >= :from and t.dueAt < :to))
            """)
    boolean existsCopyBetween(@Param("templateId") Long templateId, @Param("from") Instant from, @Param("to") Instant to);

    /** Ids of a repeating task's copies starting in [from, to), oldest first. */
    @Query("""
            select t.id from Task t
            where t.recurringTemplate.id = :templateId
              and ((t.scheduledAt >= :from and t.scheduledAt < :to)
                   or (t.scheduledAt is null and t.dueAt >= :from and t.dueAt < :to))
            order by t.id
            """)
    List<Long> findCopyIdsBetween(@Param("templateId") Long templateId, @Param("from") Instant from, @Param("to") Instant to);

    /**
     * Future copies nobody has started (removed when the repeating task is paused, changed or deleted).
     * Copies with a ticket on them stay, so the ticket and its answer do not disappear.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from Task t
            where t.recurringTemplate.id = :templateId and t.status = :status and t.dueAt >= :from
              and not exists (select 1 from TaskTicket k where k.task = t)
            """)
    int deleteCopiesFrom(@Param("templateId") Long templateId, @Param("status") TaskStatus status, @Param("from") Instant from);

    /** Untouched copies of any repeating task on one day (removed when that day becomes a holiday). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from Task t
            where t.recurringTemplate is not null and t.status = :status and t.dueAt >= :from and t.dueAt < :to
              and not exists (select 1 from TaskTicket k where k.task = t)
            """)
    int deleteCopiesBetween(@Param("status") TaskStatus status, @Param("from") Instant from, @Param("to") Instant to);

    /** Untouched repeating copies of one person due in [from, to) (removed when they go on leave). Copies with a ticket stay. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            delete from Task t
            where t.recurringTemplate is not null and t.assignee.id = :assigneeId and t.status = :status
              and t.dueAt >= :from and t.dueAt < :to
              and not exists (select 1 from TaskTicket k where k.task = t)
            """)
    int deleteCopiesForAssigneeBetween(@Param("assigneeId") Long assigneeId, @Param("status") TaskStatus status,
                                       @Param("from") Instant from, @Param("to") Instant to);

    // ------------------------------------------------------------ reminders

    /** Open work that needs a "due soon" or "overdue" reminder it hasn't had yet. */
    @EntityGraph(attributePaths = {"assignee", "createdBy"})
    @Query("""
            select t from Task t
            where t.status in :open and t.dueAt is not null
              and ((t.dueAt < :now and t.overdueReminded = false)
                   or (t.dueSoonReminded = false and t.dueAt >= :now
                       and ((t.scheduledAt is not null and t.scheduledAt <= :now)
                            or (t.scheduledAt is null and t.dueAt <= :soon))))
            """)
    List<Task> findNeedingReminder(@Param("open") Collection<TaskStatus> open, @Param("now") Instant now, @Param("soon") Instant soon);

    /** Open work due today or tomorrow (not past due) that has not had its reminder today. */
    @EntityGraph(attributePaths = {"assignee", "createdBy"})
    @Query("""
            select t from Task t
            where t.status in :open and t.dueAt is not null and t.dueAt >= :now and t.dueAt < :until
              and (t.dayRemindedOn is null or t.dayRemindedOn < :today)
            """)
    List<Task> findNeedingDayReminder(@Param("open") Collection<TaskStatus> open, @Param("now") Instant now,
                                      @Param("until") Instant until, @Param("today") java.time.LocalDate today);
}
