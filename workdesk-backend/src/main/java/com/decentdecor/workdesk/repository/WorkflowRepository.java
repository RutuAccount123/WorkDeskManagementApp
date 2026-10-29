package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Workflow;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** Table: workflow (FMS). */
public interface WorkflowRepository extends JpaRepository<Workflow, Long> {

    @EntityGraph(attributePaths = {"createdBy", "sourceTask"})
    List<Workflow> findAllByOrderByNameAsc();

    List<Workflow> findByActiveTrue();
}
