package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.TaskAttachment;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Table: task_attachment. */
public interface TaskAttachmentRepository extends JpaRepository<TaskAttachment, Long> {

    /** A task's files without their bytes (for the list on the task page). */
    record Info(Long id, String fileName, String contentType, Integer sizeBytes, String uploadedByName, Instant createdAt) { }

    @Query("select new com.decentdecor.workdesk.repository.TaskAttachmentRepository$Info("
            + "a.id, a.fileName, a.contentType, a.sizeBytes, u.fullName, a.createdAt)"
            + " from TaskAttachment a join a.uploadedBy u where a.task.id = :taskId order by a.createdAt, a.id")
    List<Info> listForTask(@Param("taskId") Long taskId);

    Optional<TaskAttachment> findByIdAndTaskId(Long id, Long taskId);

    long countByTaskId(Long taskId);
}
