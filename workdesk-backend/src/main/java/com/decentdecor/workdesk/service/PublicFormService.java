package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.publicform.PublicFormResponse;
import com.decentdecor.workdesk.dto.publicform.PublicFormSubmitResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.exception.TooManyRequestsException;
import com.decentdecor.workdesk.repository.EmployeeRepository;
import com.decentdecor.workdesk.repository.TaskRepository;
import com.decentdecor.workdesk.repository.WorkflowRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shareable FMS form link (/f/{token}): anyone with the link, signed in or not, can fill the
 * FMS entry form. Each submission starts a new run of that FMS, exactly like "Start new".
 * The entry's "Filled by" is the name typed on the form (formFilledByName). When a member is
 * signed in they are also kept in formFilledBy, so their own "Fill the form" task can be closed.
 * A member's "Fill the form" task for this link is closed once they have filled it.
 */
@Service
public class PublicFormService {
    private static final SecureRandom RANDOM = new SecureRandom();
    /** Submissions allowed per address per link within the window (stops someone flooding an FMS). */
    private static final int MAX_SUBMISSIONS = 20;
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final int MAX_NAME = 120;
    private static final Set<TaskStatus> CAN_CLOSE = Set.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REOPENED);

    private final WorkflowRepository workflows;
    private final WorkflowEngine engine;
    private final EmployeeRepository employees;
    private final TaskRepository tasks;
    private final TaskService taskService;
    private final OfficeTime time;
    private final Map<String, Deque<Instant>> recent = new ConcurrentHashMap<>();

    public PublicFormService(WorkflowRepository workflows, WorkflowEngine engine, EmployeeRepository employees,
                             TaskRepository tasks, TaskService taskService, OfficeTime time) {
        this.workflows = workflows;
        this.engine = engine;
        this.employees = employees;
        this.tasks = tasks;
        this.taskService = taskService;
        this.time = time;
    }

    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final int CODE_LENGTH = 10;

    /**
     * A new short, hard-to-guess code: 10 letters/digits (62^10 ≈ 8 × 10^17 possibilities).
     * Letters and digits only, so the link can be "fms-name-CODE" and the code is what follows the last "-".
     */
    public static String newToken() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) code.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        return code.toString();
    }

    /** "site-enquiry-k3X9pQ2mZa" → "k3X9pQ2mZa". The FMS name in front is only there to read; it is not checked. */
    static String codeOf(String linkPart) {
        return linkPart.substring(linkPart.lastIndexOf('-') + 1);
    }

    /** What the person opening the link sees: the FMS name, its description, its form, and who they are if signed in. */
    @Transactional(readOnly = true)
    public PublicFormResponse get(String token, CurrentUser user) {
        Workflow w = open(token);
        Employee member = member(user);
        return new PublicFormResponse(w.getName(), w.getDescription(), w.getFormFields(),
                member == null ? null : member.getFullName());
    }

    /** Saves the filled form as a new entry (run) of the FMS; step 1 starts at once. */
    @Transactional
    public PublicFormSubmitResponse submit(String token, Map<String, Object> formData, String filledByName,
                                           CurrentUser user, String address) {
        Workflow w = open(token);
        Employee member = member(user);
        // "Filled by" is always the name typed on the form, signed in or not
        String name = Texts.trimToNull(filledByName);
        if (name == null) throw new BadRequestException("Please enter your name");
        if (name.length() > MAX_NAME) throw new BadRequestException("Name must be " + MAX_NAME + " characters or fewer");
        if (!engine.allStepPeopleActive(w.getSteps())) {
            throw new BadRequestException("This form is not accepting entries right now. Please contact the sender.");
        }
        allow(token, address);

        Map<String, Object> form = w.getFormFields().isEmpty() ? null : (formData == null ? Map.of() : formData);
        // the activity log needs a Work Desk person: the member, or else the FMS owner on the visitor's behalf
        WorkflowRun run = engine.startRun(w, time.today(), form, member != null ? member : w.getCreatedBy(), true, null);
        run.setFormFilledBy(member);
        run.setFormFilledByName(name);
        if (run.getFormFilledAt() == null) run.setFormFilledAt(time.now());
        if (member != null) closeFillTasks(member, user, w.getPublicFormToken());
        return new PublicFormSubmitResponse(run.getRunDate(), run.getNumber());
    }

    /** The signed-in, active Work Desk member opening the link, or null for a visitor. */
    private Employee member(CurrentUser user) {
        if (user == null) return null;
        return employees.findById(user.id()).filter(Employee::isActive).orElse(null);
    }

    /**
     * The member's part is done: their open "Fill the form" tasks that carry this link are marked done.
     * Only tasks they can close themselves (no reviewer, nothing left to tick) are touched.
     */
    private void closeFillTasks(Employee member, CurrentUser user, String code) {
        if (code == null) return;
        List<Task> mine = tasks.findByAssigneeId(member.getId()).stream()
                .filter(t -> !t.isWorkflowStep() && CAN_CLOSE.contains(t.getStatus()))
                .filter(t -> t.effectiveReviewer() == null && t.getChecklist().stream().allMatch(c -> c.done()))
                .filter(t -> carriesLink(t.getDescription(), code))
                .toList();
        for (Task t : mine) taskService.changeStatus(user, t.getId(), TaskStatus.COMPLETED.name(), "Filled the form");
    }

    /** The description holds this form's link: ".../f/CODE" or ".../f/fms-name-CODE". */
    static boolean carriesLink(String description, String code) {
        if (description == null) return false;
        return Pattern.compile("/f/(?:[A-Za-z0-9-]*-)?" + Pattern.quote(code) + "(?![A-Za-z0-9])").matcher(description).find();
    }

    /** The FMS behind a link, only while the link is on and the FMS is not paused. */
    private Workflow open(String token) {
        if (token == null || token.isBlank() || token.length() > 200) throw NotFoundException.of("Form");
        String code = codeOf(token.trim());
        if (code.isEmpty()) throw NotFoundException.of("Form");
        Workflow w = workflows.findByPublicFormToken(code).orElseThrow(() -> NotFoundException.of("Form"));
        if (!w.isActive()) throw new BadRequestException("This form is closed right now");
        return w;
    }

    private void allow(String token, String address) {
        Instant now = time.now();
        Deque<Instant> q = recent.computeIfAbsent(codeOf(token.trim()) + "|" + (address == null ? "?" : address), k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst().isBefore(now.minus(WINDOW))) q.removeFirst();
            if (q.size() >= MAX_SUBMISSIONS) throw new TooManyRequestsException("Too many entries sent. Please try again in a few minutes.");
            q.addLast(now);
        }
    }
}
