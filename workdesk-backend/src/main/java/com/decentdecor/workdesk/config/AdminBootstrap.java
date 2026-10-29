package com.decentdecor.workdesk.config;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.security.PasswordPolicy;
import java.time.Instant;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * First start: when the database has no admin, create one from WD_ADMIN_EMAIL / WD_ADMIN_PASSWORD
 * (wd.admin.*). After that these settings are ignored, so change the password in the app.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final EmployeeRepository employees;
    private final PasswordEncoder encoder;
    private final AppProperties props;

    public AdminBootstrap(EmployeeRepository employees, PasswordEncoder encoder, AppProperties props) {
        this.employees = employees;
        this.encoder = encoder;
        this.props = props;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (employees.countByRole(Role.ADMIN) > 0) return;
        AppProperties.Admin admin = props.admin();
        String password = admin == null ? null : admin.password();
        String problem = PasswordPolicy.problem(password, "WD_ADMIN_PASSWORD");
        if (problem != null) {
            throw new IllegalStateException("No admin account yet. Set WD_ADMIN_PASSWORD for the first start (" + problem + ").");
        }
        String email = admin.email().trim().toLowerCase(Locale.ROOT);
        Employee e = employees.findByEmail(email).orElseGet(Employee::new);
        if (e.getId() == null) {
            e.setEmployeeCode("ADM-001");
            e.setFullName("System Admin");
            e.setEmail(email);
            e.setDepartment("Management");
            e.setDesignation("Administrator");
            e.setCreatedAt(Instant.now());
        }
        e.setPasswordHash(encoder.encode(password));
        e.setRole(Role.ADMIN);
        e.setActive(true);
        employees.save(e);
        log.info("Created the first admin account: {}. Sign in and change the password.", email);
    }
}
