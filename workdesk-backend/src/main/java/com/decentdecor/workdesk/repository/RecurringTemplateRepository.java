package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.RecurringTemplate;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** Table: recurring_template (daily & weekly tasks). */
public interface RecurringTemplateRepository extends JpaRepository<RecurringTemplate, Long> {

    @EntityGraph(attributePaths = {"assignee", "createdBy"})
    List<RecurringTemplate> findAllByOrderByTitleAsc();

    @EntityGraph(attributePaths = {"assignee", "createdBy"})
    List<RecurringTemplate> findByAssigneeIdOrderByTitleAsc(Long assigneeId);

    @EntityGraph(attributePaths = {"assignee", "createdBy"})
    List<RecurringTemplate> findByActiveTrue();
}
