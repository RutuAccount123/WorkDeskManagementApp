package com.decentdecor.workdesk.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/** Table: instrument_repair. One time an instrument went for repair; returnedAt null = still under repair. */
@Entity
@Table(name = "instrument_repair")
public class InstrumentRepair {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instrument_id")
    private Instrument instrument;

    @Column(name = "problem", nullable = false, length = 500)
    private String problem;

    @Column(name = "repair_shop", nullable = false, length = 160)
    private String repairShop;

    @Column(name = "expected_back")
    private LocalDate expectedBack;

    @Column(name = "estimated_cost", precision = 12, scale = 2)
    private BigDecimal estimatedCost;

    @Column(name = "note", nullable = false, length = 500)
    private String note = "";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sent_by_id")
    private Employee sentBy;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    @Column(name = "returned_at")
    private Instant returnedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "returned_by_id")
    private Employee returnedBy;

    @Column(name = "repair_cost", precision = 12, scale = 2)
    private BigDecimal repairCost;

    @Column(name = "return_note", nullable = false, length = 500)
    private String returnNote = "";

    public boolean isOpen() {
        return returnedAt == null;
    }

    /** Back from repair (or closed because the instrument was removed). */
    public void close(Instant at, Employee by, BigDecimal cost, String note) {
        this.returnedAt = at;
        this.returnedBy = by;
        this.repairCost = cost;
        this.returnNote = note == null ? "" : note;
    }

    // ------------------------------------------------------------ getters and setters

    public Long getId() {
        return id;
    }

    public Instrument getInstrument() {
        return instrument;
    }

    public void setInstrument(Instrument instrument) {
        this.instrument = instrument;
    }

    public String getProblem() {
        return problem;
    }

    public void setProblem(String problem) {
        this.problem = problem;
    }

    public String getRepairShop() {
        return repairShop;
    }

    public void setRepairShop(String repairShop) {
        this.repairShop = repairShop;
    }

    public LocalDate getExpectedBack() {
        return expectedBack;
    }

    public void setExpectedBack(LocalDate expectedBack) {
        this.expectedBack = expectedBack;
    }

    public BigDecimal getEstimatedCost() {
        return estimatedCost;
    }

    public void setEstimatedCost(BigDecimal estimatedCost) {
        this.estimatedCost = estimatedCost;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note == null ? "" : note;
    }

    public Employee getSentBy() {
        return sentBy;
    }

    public void setSentBy(Employee sentBy) {
        this.sentBy = sentBy;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }

    public Instant getReturnedAt() {
        return returnedAt;
    }

    public Employee getReturnedBy() {
        return returnedBy;
    }

    public BigDecimal getRepairCost() {
        return repairCost;
    }

    public String getReturnNote() {
        return returnNote;
    }
}
