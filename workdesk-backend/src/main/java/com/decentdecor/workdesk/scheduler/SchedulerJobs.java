package com.decentdecor.workdesk.scheduler;

import com.decentdecor.workdesk.service.SchedulerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Timer for the background jobs: once at start-up and then every 5 minutes (wd.scheduler.cron).
 * The work itself is in service/SchedulerService.
 */
@Component
public class SchedulerJobs {
    private static final Logger log = LoggerFactory.getLogger(SchedulerJobs.class);
    private final SchedulerService scheduler;

    public SchedulerJobs(SchedulerService scheduler) {
        this.scheduler = scheduler;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void atStartup() {
        run();
    }

    @Scheduled(cron = "${wd.scheduler.cron:0 */5 * * * *}", zone = "${wd.timezone:Asia/Kolkata}")
    public void run() {
        try {
            SchedulerService.Result r = scheduler.runAll();
            log.info("Scheduler: {} daily/weekly copies, {} FMS runs started, {} reminders", r.recurringCopies(), r.workflowRuns(), r.reminders());
        } catch (RuntimeException e) {
            log.error("Scheduler run failed", e);
        }
    }
}
