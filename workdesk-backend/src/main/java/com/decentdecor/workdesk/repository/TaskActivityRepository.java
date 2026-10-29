package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.TaskActivity;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** Table: task_activity (task history). */
public interface TaskActivityRepository extends JpaRepository<TaskActivity, Long> {

    @EntityGraph(attributePaths = {"actor"})
    List<TaskActivity> findByTaskIdOrderByCreatedAtAscIdAsc(Long taskId);
}
