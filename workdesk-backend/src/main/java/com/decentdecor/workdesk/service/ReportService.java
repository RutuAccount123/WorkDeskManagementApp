package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.report.DailyRow;
import com.decentdecor.workdesk.dto.report.DashboardResponse;
import com.decentdecor.workdesk.dto.report.EmployeeSummaryRow;
import com.decentdecor.workdesk.dto.report.MonthPerformance;
import com.decentdecor.workdesk.dto.report.MonthSummary;
import com.decentdecor.workdesk.dto.report.Performance;
import com.decentdecor.workdesk.dto.report.PerformanceResponse;
import com.decentdecor.workdesk.dto.report.TeamMemberResponse;
import com.decentdecor.workdesk.dto.report.TodayTask;
import com.decentdecor.workdesk.dto.report.TrendPoint;
import com.decentdecor.workdesk.dto.report.YearlyResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.enums.Priority;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.mapper.EmployeeMapper;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.service.support.PerformanceCalculator;
import com.decentdecor.workdesk.service.support.TaskGroups;
import com.decentdecor.workdesk.service.support.TodayWork;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reports and performance. Employees only ever see their own numbers.
 * Numbers are worked out in Java from the tasks (fine for a company of a few hundred people;
 * for much more data, move the counting into repository queries). FMS stages count as one run-level
 * work item in dashboards and reports.
 */
@Service
public class ReportService {
    private static final long MAX_RANGE_DAYS = 731;
    private static final Comparator<Employee> BY_NAME = Comparator.comparing((Employee e) -> e.getFullName().toLowerCase(Locale.ROOT))
            .thenComparing(Employee::getId);

    private final TaskRepository tasks;
    private final EmployeeRepository employees;
    private final People people;
    private final EmployeeMapper employeeMapper;
    private final OfficeTime time;

    public ReportService(TaskRepository tasks, EmployeeRepository employees, People people, EmployeeMapper employeeMapper, OfficeTime time) {
        this.tasks = tasks;
        this.employees = employees;
        this.people = people;
        this.employeeMapper = employeeMapper;
        this.time = time;
    }

    // ================================================================ dashboard

    /** Headline numbers. Admin: everyone; employee: their own work. */
    @Transactional(readOnly = true)
    public DashboardResponse dashboard(CurrentUser user) {
        Employee me = people.me(user);
        List<Task> visible = TaskGroups.onePerWorkflowRun(me.isAdmin()
                ? tasks.findAll() : tasks.findByAssigneeId(me.getId()));
        Instant now = time.now();
        LocalDate today = time.today();
        Instant dayStart = time.startOf(today);
        Instant dayEnd = time.startOf(today.plusDays(1));
        Instant monday = time.startOf(time.mondayOf(today));

        List<Task> open = visible.stream().filter(t -> t.getStatus().isOpen()).toList();
        List<Task> done = visible.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).toList();
        Map<String, Long> byPriority = new LinkedHashMap<>();
        for (Priority p : Priority.values()) byPriority.put(p.name(), open.stream().filter(t -> t.getPriority() == p).count());

        return new DashboardResponse(
                open.size(),
                count(open, t -> t.getStatus() == TaskStatus.TODO || t.getStatus() == TaskStatus.REOPENED),
                count(open, t -> t.getStatus() == TaskStatus.IN_PROGRESS),
                count(open, t -> t.getStatus() == TaskStatus.SUBMITTED),
                count(open, t -> t.isOverdue(now)),
                count(open, t -> between(t.getDueAt(), dayStart, dayEnd)),
                count(done, t -> between(t.getCompletedAt(), dayStart, dayEnd)),
                count(done, t -> between(t.getCompletedAt(), monday, dayEnd)),
                byPriority);
    }

    // ================================================================ team cards (admin)

    @Transactional(readOnly = true)
    public List<TeamMemberResponse> team(CurrentUser user, String periodValue) {
        people.requireAdmin(user);
        Instant now = time.now();
        LocalDate today = time.today();
        Instant dayStart = time.startOf(today);
        Instant dayEnd = time.startOf(today.plusDays(1));
        String period = Texts.isBlank(periodValue) ? "today" : periodValue.trim().toLowerCase(Locale.ROOT);
        LocalDate rangeStart;
        LocalDate rangeEnd;
        switch (period) {
            case "today" -> {
                rangeStart = today;
                rangeEnd = today.plusDays(1);
            }
            case "week" -> {
                rangeStart = time.mondayOf(today);
                rangeEnd = rangeStart.plusWeeks(1);
            }
            case "month" -> {
                rangeStart = YearMonth.from(today).atDay(1);
                rangeEnd = YearMonth.from(today).plusMonths(1).atDay(1);
            }
            default -> throw new BadRequestException("Period must be today, week, or month");
        }
        Instant rangeStartInstant = time.startOf(rangeStart);
        Instant rangeEndInstant = time.startOf(rangeEnd);
        YearMonth month = YearMonth.from(today);
        Map<Long, List<Task>> byPerson = TaskGroups.onePerWorkflowRun(tasks.findAll()).stream()
                .collect(Collectors.groupingBy(t -> t.getAssignee().getId()));

        List<TeamMemberResponse> out = new ArrayList<>();
        for (Employee e : employees.findByRole(Role.EMPLOYEE).stream().sorted(BY_NAME).toList()) {
            List<Task> mine = byPerson.getOrDefault(e.getId(), List.of());
            List<Task> todayList = TodayWork.on(mine, dayStart, dayEnd);
            List<Task> rangeList = TodayWork.on(mine, rangeStartInstant, rangeEndInstant);
            Performance p = performance(mine, e.getId(), month, now);
            out.add(new TeamMemberResponse(
                    employeeMapper.toResponse(e),
                    TodayWork.count(todayList),
                    todayList.stream().map(t -> new TodayTask(t.getId(),
                            t.getWorkflowRun() == null ? t.getTitle() : t.getWorkflowRun().getName(),
                            t.getStatus().name(), t.getDueAt(), t.isOverdue(now))).toList(),
                    TodayWork.count(rangeList),
                    rangeList.stream().map(t -> new TodayTask(t.getId(),
                            t.getWorkflowRun() == null ? t.getTitle() : t.getWorkflowRun().getName(),
                            t.getStatus().name(), t.getDueAt(), t.isOverdue(now))).toList(),
                    count(rangeList, t -> t.isOverdue(now)),
                    count(mine, t -> t.isOverdue(now)),
                    count(mine, t -> t.getStatus() == TaskStatus.SUBMITTED),
                    new MonthSummary(p.score(), p.rating(), p.total(), p.completed(), p.onTimeRate())));
        }
        return out;
    }

    // ================================================================ performance

    /** One month (default this month) plus the 6-month trend. Employees always get their own. */
    @Transactional(readOnly = true)
    public PerformanceResponse performance(CurrentUser user, Long employeeId, String monthValue) {
        Employee target = target(people.me(user), employeeId);
        YearMonth month = Texts.isBlank(monthValue) ? YearMonth.from(time.today()) : OfficeTime.parseMonth(monthValue);
        Instant now = time.now();
        List<Task> mine = TaskGroups.onePerWorkflowRun(tasks.findByAssigneeId(target.getId()));
        List<TrendPoint> trend = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            YearMonth m = month.minusMonths(i);
            Performance p = performance(mine, target.getId(), m, now);
            trend.add(new TrendPoint(m.toString(), p.score(), p.total(), p.completed(), p.onTimeRate()));
        }
        return new PerformanceResponse(target.getId(), month.toString(), performance(mine, target.getId(), month, now), trend);
    }

    /** The whole year plus each month. */
    @Transactional(readOnly = true)
    public YearlyResponse yearly(CurrentUser user, Long employeeId, Integer yearValue) {
        Employee target = target(people.me(user), employeeId);
        int year = yearValue == null ? time.today().getYear() : yearValue;
        if (year < 2000 || year > 2100) throw new BadRequestException("Choose a year between 2000 and 2100");
        Instant now = time.now();
        List<Task> mine = TaskGroups.onePerWorkflowRun(tasks.findByAssigneeId(target.getId()));
        List<MonthPerformance> months = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            YearMonth ym = YearMonth.of(year, m);
            months.add(new MonthPerformance(ym.toString(), performance(mine, target.getId(), ym, now)));
        }
        Performance whole = PerformanceCalculator.of(mine, target.getId(), time.startOf(LocalDate.of(year, 1, 1)),
                time.startOf(LocalDate.of(year + 1, 1, 1)), now);
        return new YearlyResponse(target.getId(), year, whole, months);
    }

    // ================================================================ date-range reports

    /** One row per person for a date range (admin). Also used for the Excel download. */
    @Transactional(readOnly = true)
    public List<EmployeeSummaryRow> employeeSummary(CurrentUser user, LocalDate from, LocalDate to) {
        people.requireAdmin(user);
        checkRange(from, to);
        Instant a = time.startOf(from);
        Instant b = time.startOf(to.plusDays(1));
        Instant now = time.now();
        Map<Long, List<Task>> byPerson = tasks.findAll().stream().collect(Collectors.groupingBy(t -> t.getAssignee().getId()));

        List<EmployeeSummaryRow> rows = new ArrayList<>();
        for (Employee e : employees.findAll().stream().sorted(BY_NAME).toList()) {
            List<Task> mine = TaskGroups.onePerWorkflowRun(byPerson.getOrDefault(e.getId(), List.of()));
            List<Task> open = mine.stream().filter(t -> t.getStatus().isOpen()).toList();
            boolean touched = mine.stream().anyMatch(t -> between(t.getCreatedAt(), a, b) || between(t.getCompletedAt(), a, b)
                    || between(t.getDueAt(), a, b)) || !open.isEmpty();
            // skip admins and inactive people with nothing in the period
            if (!touched && (e.getRole() == Role.ADMIN || !e.isActive())) continue;

            List<Task> completed = mine.stream()
                    .filter(t -> t.getStatus() == TaskStatus.COMPLETED && between(t.getCompletedAt(), a, b)).toList();
            long onTime = completed.stream().filter(PerformanceCalculator::onTime).count();
            OptionalDouble avg = completed.stream()
                    .mapToDouble(t -> Duration.between(t.getCreatedAt(), t.getCompletedAt()).toMinutes() / 60.0).average();
            rows.add(new EmployeeSummaryRow(
                    e.getId(), e.getFullName(), e.getDepartment(),
                    count(mine, t -> between(t.getCreatedAt(), a, b)),
                    completed.size(), onTime, completed.size() - onTime,
                    open.size(), count(open, t -> t.isOverdue(now)),
                    completed.isEmpty() ? null : Texts.round1(100.0 * onTime / completed.size()),
                    avg.isPresent() ? Texts.round1(avg.getAsDouble()) : null));
        }
        return rows;
    }

    /** One row per day. Admins can pick a person (or everyone); employees get their own. */
    @Transactional(readOnly = true)
    public List<DailyRow> daily(CurrentUser user, LocalDate from, LocalDate to, Long employeeId) {
        Employee me = people.me(user);
        checkRange(from, to);
        Long who = me.isAdmin() ? employeeId : me.getId();
        List<Task> list = TaskGroups.onePerWorkflowRun(who == null ? tasks.findAll() : tasks.findByAssigneeId(who));
        List<DailyRow> rows = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            LocalDate day = d;
            List<Task> doneToday = list.stream()
                    .filter(t -> t.getStatus() == TaskStatus.COMPLETED && time.dayOf(t.getCompletedAt()).equals(day)).toList();
            rows.add(new DailyRow(day,
                    count(list, t -> time.dayOf(t.getCreatedAt()).equals(day)),
                    count(list, t -> t.getDueAt() != null && time.dayOf(t.getDueAt()).equals(day)),
                    doneToday.size(),
                    count(doneToday, PerformanceCalculator::onTime)));
        }
        return rows;
    }

    // ================================================================ inside

    /** Admins may look at anyone (default themselves); employees always see themselves. */
    private Employee target(Employee me, Long employeeId) {
        return me.isAdmin() && employeeId != null ? people.get(employeeId) : me;
    }

    private Performance performance(List<Task> tasksOfPerson, Long employeeId, YearMonth month, Instant now) {
        return PerformanceCalculator.of(TaskGroups.onePerWorkflowRun(tasksOfPerson), employeeId, time.startOf(month.atDay(1)),
                time.startOf(month.plusMonths(1).atDay(1)), now);
    }

    private static void checkRange(LocalDate from, LocalDate to) {
        if (from == null || to == null) throw new BadRequestException("Invalid request: check the values you sent");
        if (to.isBefore(from)) throw new BadRequestException("'to' date must be on or after 'from' date");
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) throw new BadRequestException("Choose a range of two years or less");
    }

    private static boolean between(Instant value, Instant from, Instant to) {
        return value != null && !value.isBefore(from) && value.isBefore(to);
    }

    private static long count(List<Task> list, Predicate<Task> test) {
        return list.stream().filter(test).count();
    }
}
