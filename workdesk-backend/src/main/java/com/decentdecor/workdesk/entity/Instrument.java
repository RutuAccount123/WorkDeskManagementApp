package com.decentdecor.workdesk.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Table: instrument. A site instrument of the company (moisture meter, laser meter, ...).
 * Who has it now comes from its uses: the one not ended yet. None = free in the office store.
 */
@Entity
@Table(name = "instrument")
public class Instrument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    /** The company / brand, e.g. Bosch. Empty when not known. */
    @Column(name = "make", nullable = false, length = 120)
    private String make = "";

    @Column(name = "info", nullable = false, length = 1000)
    private String info = "";

    /** Units with the same material code are one material (e.g. 4 hammer drills share "INS-010"). */
    @Column(name = "material_code", nullable = false, length = 40)
    private String materialCode = "";

    public String getMaterialCode() {
        return materialCode;
    }

    public void setMaterialCode(String materialCode) {
        this.materialCode = materialCode == null ? "" : materialCode;
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id")
    private Employee createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** Every time someone had it, oldest first. */
    @OneToMany(mappedBy = "instrument", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("startedAt ASC, id ASC")
    private List<InstrumentUse> uses = new ArrayList<>();

    /** Every time it went for repair, oldest first. */
    @OneToMany(mappedBy = "instrument", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sentAt ASC, id ASC")
    private List<InstrumentRepair> repairs = new ArrayList<>();

    /** Removed from the list (no longer used); its history stays. */
    @Column(name = "removed_at")
    private Instant removedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "removed_by_id")
    private Employee removedBy;

    @Column(name = "removed_reason", nullable = false, length = 500)
    private String removedReason = "";

    /** Who has it now, or null when it is free in the office store (or under repair). */
    public InstrumentUse current() {
        return uses.stream().filter(InstrumentUse::isCurrent).findFirst().orElse(null);
    }

    /** Its open repair, or null when it is not under repair. */
    public InstrumentRepair currentRepair() {
        return repairs.stream().filter(InstrumentRepair::isOpen).findFirst().orElse(null);
    }

    public boolean isRemoved() {
        return removedAt != null;
    }

    public void remove(Instant at, Employee by, String reason) {
        this.removedAt = at;
        this.removedBy = by;
        this.removedReason = reason == null ? "" : reason;
    }

    public List<InstrumentRepair> getRepairs() {
        return repairs;
    }

    public Instant getRemovedAt() {
        return removedAt;
    }

    public Employee getRemovedBy() {
        return removedBy;
    }

    public String getRemovedReason() {
        return removedReason;
    }

    // ------------------------------------------------------------ getters and setters

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getMake() {
        return make;
    }

    public void setMake(String make) {
        this.make = make == null ? "" : make;
    }

    public String getInfo() {
        return info;
    }

    public void setInfo(String info) {
        this.info = info;
    }

    public Employee getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Employee createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<InstrumentUse> getUses() {
        return uses;
    }
}
