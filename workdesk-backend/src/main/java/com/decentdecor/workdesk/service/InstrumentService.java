package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.instrument.GiveInstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.InstrumentRepairResponse;
import com.decentdecor.workdesk.dto.instrument.InstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.InstrumentResponse;
import com.decentdecor.workdesk.dto.instrument.InstrumentUseResponse;
import com.decentdecor.workdesk.dto.instrument.RemoveInstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.RepairDoneRequest;
import com.decentdecor.workdesk.dto.instrument.RepairInstrumentRequest;
import com.decentdecor.workdesk.dto.instrument.SubmitInstrumentRequest;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Instrument;
import com.decentdecor.workdesk.entity.InstrumentRepair;
import com.decentdecor.workdesk.entity.InstrumentUse;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.mapper.EmployeeMapper;
import com.decentdecor.workdesk.repository.InstrumentRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Instruments tab: the company's site instruments, who has each one now, and its history.
 * It stands on its own (it only uses the employee list). Everyone signed in can see it, add instruments,
 * give a free one to a person, shift one to another person, submit one back to the office store,
 * send one for repair (and mark it back), and remove one that is no longer used.
 */
@Service
public class InstrumentService {
    /** Where a free instrument is. */
    public static final String OFFICE_STORE = "Office store";
    public static final String FREE = "FREE";
    public static final String IN_USE = "IN_USE";
    public static final String REPAIR = "REPAIR";
    public static final String REMOVED = "REMOVED";

    private final InstrumentRepository instruments;
    private final People people;
    private final EmployeeMapper employees;
    private final OfficeTime time;

    public InstrumentService(InstrumentRepository instruments, People people, EmployeeMapper employees, OfficeTime time) {
        this.instruments = instruments;
        this.people = people;
        this.employees = employees;
        this.time = time;
    }

    /** GET /api/instruments — the list, in the order they were added (Sr No). removed=true: the removed ones instead. */
    @Transactional(readOnly = true)
    public List<InstrumentResponse> list(CurrentUser user, boolean removed) {
        people.me(user);
        List<Instrument> all = removed ? instruments.findByRemovedAtIsNotNullOrderByIdAsc()
                : instruments.findByRemovedAtIsNullOrderByIdAsc();
        List<InstrumentResponse> out = new ArrayList<>(all.size());
        for (int i = 0; i < all.size(); i++) out.add(toResponse(all.get(i), i + 1));
        return out;
    }

    /** GET /api/instruments/{id}/history — who had it, oldest first. */
    @Transactional(readOnly = true)
    public List<InstrumentUseResponse> history(CurrentUser user, Long id) {
        people.me(user);
        return find(id).getUses().stream().map(this::toUse).toList();
    }

    /** GET /api/instruments/{id}/repairs — every time it went for repair, oldest first. */
    @Transactional(readOnly = true)
    public List<InstrumentRepairResponse> repairs(CurrentUser user, Long id) {
        people.me(user);
        return find(id).getRepairs().stream().map(this::toRepair).toList();
    }

    /**
     * POST /api/instruments — adds it (quantity: that many units of the same material, all in the office store).
     * Each unit has its own material code: with several units the code you write is the first one and the next ones
     * count up (HD-01, HD-02, HD-03), skipping codes already in use. One unit with a person: given to them straight away.
     * Returns the first unit added.
     */
    @Transactional
    public InstrumentResponse create(CurrentUser user, InstrumentRequest req) {
        Employee me = people.me(user);
        Instant now = time.now();
        int quantity = req.quantity() == null ? 1 : req.quantity();
        if (quantity > 1 && req.holderId() != null) {
            throw new BadRequestException("Add several units to the office store, then give them to people one by one");
        }
        Employee holder = null;
        String location = null;
        if (req.holderId() != null) {
            location = Texts.trimToNull(req.location());
            if (location == null) throw new BadRequestException("Write the site location for the person who gets it");
            holder = people.activeAssignee(req.holderId());
        }
        String code = codeOf(req);
        if (code != null) codeIsFree(code, null);   // the first code must be free; the next ones skip used codes
        Instrument first = null;
        for (int n = 0; n < quantity; n++) {
            Instrument inst = new Instrument();
            inst.setCreatedBy(me);
            inst.setCreatedAt(now);
            details(inst, req, now);
            if (code != null) {
                if (n > 0) code = nextFreeCode(code);
                inst.setMaterialCode(code);
            }
            inst = instruments.save(inst);
            instruments.flush();   // so the next unit's code sees this one as used
            if (holder != null) start(inst, holder, location, req.project(), req.note(), me, now);
            if (first == null) first = inst;
        }
        instruments.flush();
        return toResponse(first);
    }

    /** PUT /api/instruments/{id} — name, make, material code and info only; who has it changes with give / shift / submit. */
    @Transactional
    public InstrumentResponse update(CurrentUser user, Long id, InstrumentRequest req) {
        people.me(user);
        Instrument inst = find(id);
        notRemoved(inst);
        String code = codeOf(req);
        if (code != null) codeIsFree(code, id);
        details(inst, req, time.now());
        return toResponse(inst);
    }

    /** POST /api/instruments/{id}/give — a free one to a person, or shift it from its holder to another person. */
    @Transactional
    public InstrumentResponse give(CurrentUser user, Long id, GiveInstrumentRequest req) {
        Employee me = people.me(user);
        Instrument inst = lock(id);
        notRemoved(inst);
        notUnderRepair(inst);
        Employee to = people.activeAssignee(req.holderId());
        String location = req.location().trim();
        String project = Texts.trimToEmpty(req.project());
        Instant now = time.now();
        InstrumentUse current = inst.current();
        if (current != null) {
            if (current.getHolder().getId().equals(to.getId()) && current.getLocation().equalsIgnoreCase(location)
                    && current.getProject().equalsIgnoreCase(project)) {
                throw new BadRequestException(to.getFullName() + " already has this instrument at " + location);
            }
            current.end(now, me, InstrumentUse.SHIFTED, Texts.trimToEmpty(req.note()));
            instruments.flush();   // the old use ends before the new one starts (only one current use at a time)
        }
        start(inst, to, location, project, req.note(), me, now);
        inst.setUpdatedAt(now);
        instruments.flush();
        return toResponse(inst);
    }

    /** POST /api/instruments/{id}/submit — back to the office store: it is free again. */
    @Transactional
    public InstrumentResponse submit(CurrentUser user, Long id, SubmitInstrumentRequest req) {
        Employee me = people.me(user);
        Instrument inst = lock(id);
        notRemoved(inst);
        notUnderRepair(inst);
        InstrumentUse current = inst.current();
        if (current == null) throw new BadRequestException("This instrument is already in the office store");
        Instant now = time.now();
        current.end(now, me, InstrumentUse.SUBMITTED, Texts.trimToEmpty(req == null ? null : req.note()));
        inst.setUpdatedAt(now);
        instruments.flush();
        return toResponse(inst);
    }

    /**
     * POST /api/instruments/{id}/repair — sends it for repair, from the office store or from a site.
     * If a person has it, their use ends (REPAIR). It is "Under repair" until it is marked back.
     */
    @Transactional
    public InstrumentResponse repair(CurrentUser user, Long id, RepairInstrumentRequest req) {
        Employee me = people.me(user);
        Instrument inst = lock(id);
        notRemoved(inst);
        if (inst.currentRepair() != null) throw new BadRequestException("This instrument is already under repair");
        Instant now = time.now();
        InstrumentUse current = inst.current();
        if (current != null) current.end(now, me, InstrumentUse.REPAIR, req.problem().trim());
        InstrumentRepair r = new InstrumentRepair();
        r.setInstrument(inst);
        r.setProblem(req.problem().trim());
        r.setRepairShop(req.repairShop().trim());
        r.setExpectedBack(req.expectedBack());
        r.setEstimatedCost(req.estimatedCost());
        r.setNote(Texts.trimToEmpty(req.note()));
        r.setSentBy(me);
        r.setSentAt(now);
        inst.getRepairs().add(r);
        inst.setUpdatedAt(now);
        instruments.flush();
        return toResponse(inst);
    }

    /** POST /api/instruments/{id}/repair/done — back from repair: free in the office store again. */
    @Transactional
    public InstrumentResponse repairDone(CurrentUser user, Long id, RepairDoneRequest req) {
        Employee me = people.me(user);
        Instrument inst = lock(id);
        notRemoved(inst);
        InstrumentRepair open = inst.currentRepair();
        if (open == null) throw new BadRequestException("This instrument is not under repair");
        Instant now = time.now();
        open.close(now, me, req == null ? null : req.repairCost(), Texts.trimToEmpty(req == null ? null : req.note()));
        inst.setUpdatedAt(now);
        instruments.flush();
        return toResponse(inst);
    }

    /**
     * POST /api/instruments/{id}/remove — takes it off the list (damaged, lost, sold...). Who removed it, when and why
     * are kept, and so is its history. A person's use or an open repair ends with it.
     */
    @Transactional
    public InstrumentResponse remove(CurrentUser user, Long id, RemoveInstrumentRequest req) {
        Employee me = people.me(user);
        Instrument inst = lock(id);
        notRemoved(inst);
        Instant now = time.now();
        String reason = req.reason().trim();
        InstrumentUse current = inst.current();
        if (current != null) current.end(now, me, InstrumentUse.REMOVED, reason);
        InstrumentRepair open = inst.currentRepair();
        if (open != null) open.close(now, me, null, "Removed: " + reason);
        inst.remove(now, me, reason);
        inst.setUpdatedAt(now);
        instruments.flush();
        return toResponse(inst);
    }

    // ------------------------------------------------------------ inside

    private Instrument find(Long id) {
        return instruments.findById(id).orElseThrow(() -> NotFoundException.of("Instrument"));
    }

    private Instrument lock(Long id) {
        return instruments.findByIdForUpdate(id).orElseThrow(() -> NotFoundException.of("Instrument"));
    }

    private static void notRemoved(Instrument inst) {
        if (inst.isRemoved()) throw new BadRequestException("This instrument was removed from the list");
    }

    private static void notUnderRepair(Instrument inst) {
        if (inst.currentRepair() != null) {
            throw new BadRequestException("This instrument is under repair. Mark it back from repair first");
        }
    }

    /** The written material code, trimmed and in capitals; null when none. */
    private static String codeOf(InstrumentRequest req) {
        String code = Texts.trimToNull(req.materialCode());
        return code == null ? null : code.toUpperCase(java.util.Locale.ROOT);
    }

    /** Each unit has its own code: refuses one another listed unit already has, and says the next free one. */
    private void codeIsFree(String code, Long selfId) {
        List<Instrument> owners = instruments.withCode(code, selfId == null ? -1L : selfId);
        if (!owners.isEmpty()) {
            throw new BadRequestException("Material code " + code + " is already the code of a \"" + owners.get(0).getName()
                    + "\". Each unit needs its own code; the next free one is " + nextFreeCode(code));
        }
    }

    /** The next code after this one that no listed unit has: HD-09 → HD-10 (HD-10 taken → HD-11); "LADDER" → "LADDER-2". */
    private String nextFreeCode(String code) {
        String next = nextCode(code);
        while (!instruments.withCode(next, -1L).isEmpty()) next = nextCode(next);
        return next;
    }

    /** Counts up the number at the end, keeping its zeros: INS-009 → INS-010; no number at the end → "-2". */
    static String nextCode(String code) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(.*?)(\\d+)$").matcher(code);
        if (!m.matches()) return code + "-2";
        String digits = m.group(2);
        String bumped = new java.math.BigInteger(digits).add(java.math.BigInteger.ONE).toString();
        if (bumped.length() < digits.length()) bumped = "0".repeat(digits.length() - bumped.length()) + bumped;
        return m.group(1) + bumped;
    }

    private void details(Instrument inst, InstrumentRequest req, Instant now) {
        inst.setName(req.name().trim());
        inst.setMake(Texts.trimToEmpty(req.make()));
        inst.setMaterialCode(Texts.trimToEmpty(req.materialCode()).toUpperCase(java.util.Locale.ROOT));
        inst.setInfo(Texts.trimToEmpty(req.info()));
        inst.setUpdatedAt(now);
    }

    private void start(Instrument inst, Employee holder, String location, String project, String note, Employee by, Instant at) {
        InstrumentUse use = new InstrumentUse();
        use.setInstrument(inst);
        use.setHolder(holder);
        use.setLocation(location.trim());
        use.setProject(Texts.trimToEmpty(project));
        use.setNote(Texts.trimToEmpty(note));
        use.setGivenBy(by);
        use.setStartedAt(at);
        inst.getUses().add(use);
    }

    private InstrumentResponse toResponse(Instrument inst) {
        long srNo = inst.isRemoved() ? instruments.countByRemovedAtIsNotNullAndIdLessThanEqual(inst.getId())
                : instruments.countByRemovedAtIsNullAndIdLessThanEqual(inst.getId());
        return toResponse(inst, srNo);
    }

    private InstrumentResponse toResponse(Instrument inst, long srNo) {
        InstrumentUse now = inst.current();
        InstrumentRepair repair = inst.currentRepair();
        String status = inst.isRemoved() ? REMOVED : repair != null ? REPAIR : now != null ? IN_USE : FREE;
        String location = inst.isRemoved() ? "Removed" : repair != null ? repair.getRepairShop()
                : now != null ? now.getLocation() : OFFICE_STORE;
        return new InstrumentResponse(inst.getId(), srNo, inst.getName(), inst.getMake(), inst.getMaterialCode(), inst.getInfo(),
                status,
                now == null ? null : employees.toRef(now.getHolder()),
                location,
                now == null ? "" : now.getProject(),
                now == null ? null : now.getStartedAt(),
                inst.getUses().size(),
                employees.toRef(inst.getCreatedBy()), inst.getCreatedAt(),
                repair == null ? null : toRepair(repair),
                inst.getRepairs().size(),
                inst.getRemovedAt(),
                inst.getRemovedBy() == null ? null : employees.toRef(inst.getRemovedBy()),
                inst.getRemovedReason());
    }

    private InstrumentUseResponse toUse(InstrumentUse u) {
        return new InstrumentUseResponse(u.getId(), employees.toRef(u.getHolder()), u.getLocation(), u.getProject(),
                employees.toRef(u.getGivenBy()), u.getStartedAt(), u.getNote(), u.getEndedAt(),
                Objects.isNull(u.getEndedBy()) ? null : employees.toRef(u.getEndedBy()), u.getEndAction(), u.getEndNote());
    }

    private InstrumentRepairResponse toRepair(InstrumentRepair r) {
        return new InstrumentRepairResponse(r.getId(), r.getProblem(), r.getRepairShop(), r.getExpectedBack(),
                r.getEstimatedCost(), r.getNote(), employees.toRef(r.getSentBy()), r.getSentAt(), r.getReturnedAt(),
                r.getReturnedBy() == null ? null : employees.toRef(r.getReturnedBy()), r.getRepairCost(), r.getReturnNote());
    }
}
