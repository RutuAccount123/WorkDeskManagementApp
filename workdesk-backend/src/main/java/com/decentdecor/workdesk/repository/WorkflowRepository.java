package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Workflow;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** Table: workflow (FMS). */
public interface WorkflowRepository extends JpaRepository<Workflow, Long> {

    @EntityGraph(attributePaths = {"createdBy", "sourceTask"})
    List<Workflow> findAllByOrderByNameAsc();

    List<Workflow> findByActiveTrue();

    Optional<Workflow> findByPublicFormToken(String publicFormToken);
}
