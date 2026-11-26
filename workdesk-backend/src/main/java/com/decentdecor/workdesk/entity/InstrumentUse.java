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
import java.time.Instant;

/**
 * Table: instrument_use. One time a person had an instrument: where, given by whom, from when to when.
 * endAction: SUBMITTED (returned to the office store) or SHIFTED (given to another person); null while they still have it.
 */
@Entity
@Table(name = "instrument_use")
public class InstrumentUse {
    public static final String SUBMITTED = "SUBMITTED";
    public static final String SHIFTED = "SHIFTED";
    /** The holder sent it for repair. */
    public static final String REPAIR = "REPAIR";
    /** The instrument was removed from the list while the holder had it. */
    public static final String REMOVED = "REMOVED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instrument_id")
    private Instrument instrument;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "holder_id")
    private Employee holder;

    @Column(name = "location", nullable = false, length = 160)
    private String location = "";

    @Column(name = "project", nullable = false, length = 160)
    private String project = "";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "given_by_id")
    private Employee givenBy;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "note", nullable = false, length = 500)
    private String note = "";

    @Column(name = "ended_at")
    private Instant endedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ended_by_id")
    private Employee endedBy;

    @Column(name = "end_action", length = 10)
    private String endAction;

    @Column(name = "end_note", nullable = false, length = 500)
    private String endNote = "";

    public boolean isCurrent() {
        return endedAt == null;
    }

    /** Ends this use: SUBMITTED or SHIFTED. */
    public void end(Instant at, Employee by, String action, String note) {
        this.endedAt = at;
        this.endedBy = by;
        this.endAction = action;
        this.endNote = note == null ? "" : note;
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

    public Employee getHolder() {
        return holder;
    }

    public void setHolder(Employee holder) {
        this.holder = holder;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public Employee getGivenBy() {
        return givenBy;
    }

    public void setGivenBy(Employee givenBy) {
        this.givenBy = givenBy;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public Employee getEndedBy() {
        return endedBy;
    }

    public String getEndAction() {
        return endAction;
    }

    public String getEndNote() {
        return endNote;
    }
}
