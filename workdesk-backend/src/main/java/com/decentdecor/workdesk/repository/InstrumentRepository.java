package com.decentdecor.workdesk.repository;

import com.decentdecor.workdesk.entity.Instrument;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Table: instrument. */
public interface InstrumentRepository extends JpaRepository<Instrument, Long> {

    /** In the list (not removed), oldest first: their position is the Sr No. */
    List<Instrument> findByRemovedAtIsNullOrderByIdAsc();

    /**
     * The listed instrument that already has this material code (each unit has its own code).
     * selfId: the instrument being edited (-1 when adding).
     */
    @Query("select i from Instrument i where i.removedAt is null and upper(i.materialCode) = upper(:code)"
            + " and i.id <> :selfId order by i.id")
    List<Instrument> withCode(@Param("code") String code, @Param("selfId") Long selfId);

    /** Removed ones, oldest first. */
    List<Instrument> findByRemovedAtIsNotNullOrderByIdAsc();

    /** Sr No of an instrument in the list: how many listed ones were added up to it. */
    long countByRemovedAtIsNullAndIdLessThanEqual(Long id);

    /** Sr No among the removed ones. */
    long countByRemovedAtIsNotNullAndIdLessThanEqual(Long id);

    /** Locks the row while someone submits or shifts it, so two people cannot do it at once. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Instrument i where i.id = :id")
    Optional<Instrument> findByIdForUpdate(@Param("id") Long id);
}
