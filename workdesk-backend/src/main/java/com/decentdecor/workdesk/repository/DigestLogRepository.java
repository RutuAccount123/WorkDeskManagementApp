package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.DigestLog;
import org.springframework.data.jpa.repository.JpaRepository;

/** Table: digest_log. */
public interface DigestLogRepository extends JpaRepository<DigestLog, DigestLog.Key> {
}
