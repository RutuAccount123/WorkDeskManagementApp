package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Holiday;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Table: holiday. */
public interface HolidayRepository extends JpaRepository<Holiday, Long> {

    boolean existsByHolidayDate(LocalDate date);

    Optional<Holiday> findByHolidayDate(LocalDate date);

    List<Holiday> findByHolidayDateBetweenOrderByHolidayDateAsc(LocalDate from, LocalDate to);

    List<Holiday> findAllByOrderByHolidayDateAsc();
}
