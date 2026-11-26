package com.decentdecor.workdesk.config;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Instrument;
import com.decentdecor.workdesk.entity.InstrumentUse;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.repository.InstrumentRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Instruments tab starts with the company's usual site instruments (waterproofing, painting, POP, interior work).
 * Some start "In use at site" with a person, location and project (so they can be submitted to the office store);
 * the rest start free in the office store. Runs after the first admin exists (AdminBootstrap), and only while the
 * list is empty. After that people add, give, shift and submit them in the app.
 */
@Component
@Order(2)
public class InstrumentDefaults implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(InstrumentDefaults.class);

    /** name, make (company / brand), info, site location (null = office store), project */
    static final List<String[]> DEFAULTS = List.of(
            new String[] {"Moisture meter", "Protimeter", "Pin + pinless, checks wall / slab dampness before waterproofing",
                    "Kharadi", "AIGP Washroom – Block 2"},
            new String[] {"Laser distance meter", "Bosch", "Range 60 m, for site measurement",
                    "Pirangut", "Coca-Cola Pirangut"},
            new String[] {"Cross line laser level", "Bosch", "For POP false ceiling, tile and wall lines",
                    "Baner", "Office POP false ceiling"},
            new String[] {"Auto level machine", "Sokkia", "With tripod and staff, for POP / floor levels",
                    "Hinjewadi", "Infosys Phase-II SDB 7"},
            new String[] {"Airless paint sprayer", "Graco", "For interior / exterior painting, with 2 spare tips", null, null},
            new String[] {"Paint and putty mixer", "Bosch", "Drill stirrer for paint, putty and waterproofing compounds", null, null},
            new String[] {"PU injection pump", "Sika", "For crack injection waterproofing",
                    "Wakad", "Villa 12 terrace waterproofing"},
            new String[] {"Gas torch for membrane", "Sievert", "For torch-applied APP waterproofing membrane", null, null},
            new String[] {"Coating thickness gauge (DFT)", "Elcometer", "Checks paint / coating thickness", null, null},
            new String[] {"Hammer drill machine", "Bosch", "800 W, with drill bit set", null, null},
            new String[] {"Angle grinder", "Makita", "100 mm, for surface preparation and cutting",
                    "Wakad", "Villa 12 terrace waterproofing"},
            new String[] {"Wet and dry vacuum cleaner", "Karcher", "Cleans the surface before coating", null, null},
            new String[] {"Aluminium ladder (8 ft)", "Youngman", "Folding, for painting and POP work", null, null});

    private final InstrumentRepository instruments;
    private final EmployeeRepository employees;

    public InstrumentDefaults(InstrumentRepository instruments, EmployeeRepository employees) {
        this.instruments = instruments;
        this.employees = employees;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (instruments.count() > 0) return;
        Employee admin = employees.findByRoleAndActiveTrue(Role.ADMIN).stream()
                .min(Comparator.comparing(Employee::getId)).orElse(null);
        if (admin == null) return;   // no admin yet: added on a later start
        // site instruments go to the staff in turn; with no staff yet, the admin holds them until they are shifted
        List<Employee> staff = employees.findByActiveTrue().stream()
                .filter(e -> e.getRole() != Role.ADMIN)
                .sorted(Comparator.comparing(Employee::getId)).toList();
        Instant now = Instant.now();
        int next = 0;
        for (String[] d : DEFAULTS) {
            Instrument i = new Instrument();
            i.setName(d[0]);
            i.setMake(d[1]);
            i.setInfo(d[2]);
            i.setCreatedBy(admin);
            i.setCreatedAt(now);
            i.setUpdatedAt(now);
            if (d[3] != null) {
                InstrumentUse use = new InstrumentUse();
                use.setInstrument(i);
                use.setHolder(staff.isEmpty() ? admin : staff.get(next++ % staff.size()));
                use.setLocation(d[3]);
                use.setProject(d[4]);
                use.setGivenBy(admin);
                use.setStartedAt(now);
                i.getUses().add(use);
            }
            instruments.save(i);
        }
        log.info("Added {} default instruments to the Instruments tab.", DEFAULTS.size());
    }
}
