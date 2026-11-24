package com.decentdecor.workdesk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.decentdecor.workdesk.service.SchedulerService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.ResultActions;

/**
 * The business rules end to end (HTTP → controller → service → JPA → PostgreSQL):
 * review flow, own work, task filters, daily & weekly copies, holidays, FMS runs, reports, notifications.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BusinessRulesIntegrationTest {

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        TestDatabase.register(r);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired SchedulerService scheduler;

    static final ZoneId OFFICE = ZoneId.of("Asia/Kolkata");
    String admin;

    @BeforeEach
    void signInAdmin() throws Exception {
        admin = login("admin@company.com", "Admin@123");
    }

    // ================================================================ helpers

    record Person(long id, String token, String name) {}

    String login(String email, String password) throws Exception {
        return read(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "password", password)))).andExpect(status().isOk()).andReturn()).get("token").asText();
    }

    Person person(String name) throws Exception {
        String email = name.toLowerCase().replace(' ', '.') + "." + UUID.randomUUID().toString().substring(0, 8) + "@company.com";
        JsonNode e = read(call(admin, post("/api/employees"), Map.of("fullName", name, "email", email, "password", "Start@1234",
                "role", "EMPLOYEE", "department", "Purchase")).andExpect(status().isCreated()).andReturn());
        return new Person(e.get("id").asLong(), login(email, "Start@1234"), name);
    }

    ResultActions call(String token, MockHttpServletRequestBuilder b, Object body) throws Exception {
        b.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
        if (body != null) b.content(json(body));
        return mvc.perform(b);
    }

    JsonNode ok(String token, MockHttpServletRequestBuilder b, Object body) throws Exception {
        MvcResult r = call(token, b, body).andReturn();
        assertThat(r.getResponse().getStatus()).as(r.getResponse().getContentAsString()).isBetween(200, 299);
        String text = r.getResponse().getContentAsString();
        return text.isEmpty() ? null : mapper.readTree(text);
    }

    JsonNode read(MvcResult r) throws Exception {
        return mapper.readTree(r.getResponse().getContentAsString());
    }

    String json(Object o) throws Exception {
        return mapper.writeValueAsString(o);
    }

    static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    /** The newest notification that isn't the daily summary. */
    JsonNode lastNote(String token) throws Exception {
        for (JsonNode n : ok(token, get("/api/notifications"), null)) {
            if (!"DAILY_DIGEST".equals(n.get("type").asText())) return n;
        }
        return null;
    }

    static String localDue(int daysFromNow) {
        return LocalDate.now(OFFICE).plusDays(daysFromNow) + "T18:00";
    }

    // ================================================================ tasks

    @Test
    void assignSubmitSendBackApproveWithNotifications() throws Exception {
        Person assigner = person("Assigner One");
        Person worker = person("Worker Two");
        Person reviewer = person("Reviewer Three");
        JsonNode t = ok(assigner.token(), post("/api/tasks"), map("title", "Collect GST bills", "assigneeId", worker.id(),
                "reviewerId", reviewer.id(), "priority", "HIGH", "dueAt", localDue(3)));
        long id = t.get("id").asLong();
        assertThat(t.at("/reviewer/fullName").asText()).isEqualTo("Reviewer Three");
        assertThat(t.get("dueAt").asText()).endsWith("12:30:00Z");   // 18:00 office time
        assertThat(lastNote(worker.token()).get("message").asText()).contains("Assigner One assigned you: Collect GST bills");
        assertThat(lastNote(reviewer.token()).get("type").asText()).isEqualTo("REVIEW_ASSIGNED");

        call(worker.token(), post("/api/tasks/" + id + "/status"), map("status", "COMPLETED")).andExpect(status().isForbidden());
        ok(worker.token(), post("/api/tasks/" + id + "/status"), map("status", "IN_PROGRESS"));
        ok(worker.token(), post("/api/tasks/" + id + "/status"), map("status", "SUBMITTED"));
        assertThat(ok(reviewer.token(), get("/api/tasks?scope=review"), null).findValuesAsText("title")).contains("Collect GST bills");

        call(reviewer.token(), post("/api/tasks/" + id + "/status"), map("status", "REOPENED")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please add a comment explaining what needs to be redone"));
        ok(reviewer.token(), post("/api/tasks/" + id + "/status"), map("status", "REOPENED", "comment", "Add October bills"));
        assertThat(lastNote(worker.token()).get("message").asText()).contains("sent back").contains("Add October bills");

        ok(worker.token(), post("/api/tasks/" + id + "/status"), map("status", "IN_PROGRESS"));
        ok(worker.token(), post("/api/tasks/" + id + "/status"), map("status", "SUBMITTED"));
        JsonNode done = ok(reviewer.token(), post("/api/tasks/" + id + "/status"), map("status", "COMPLETED"));
        assertThat(done.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(lastNote(assigner.token()).get("message").asText()).contains("approved \"Collect GST bills\" (Worker Two)");

        List<String> flow = new ArrayList<>();
        ok(assigner.token(), get("/api/tasks/" + id + "/activity"), null).forEach(a -> {
            if (!a.get("toStatus").isNull()) flow.add(a.get("toStatus").asText());
        });
        assertThat(flow).containsExactly("TODO", "IN_PROGRESS", "SUBMITTED", "REOPENED", "IN_PROGRESS", "SUBMITTED", "COMPLETED");
    }

    @Test
    void reviewerRulesAndOwnWork() throws Exception {
        Person a = person("Owner Four");
        Person b = person("Other Five");
        call(a.token(), post("/api/tasks"), map("title", "X", "assigneeId", b.id(), "reviewerId", b.id()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("The person doing the task cannot also review it"));
        assertThat(ok(a.token(), post("/api/tasks"), map("title", "X", "assigneeId", b.id())).at("/reviewer/id").asLong()).isEqualTo(a.id());

        JsonNode own = ok(a.token(), post("/api/tasks"), map("title", "Petty cash", "status", "COMPLETED"));
        assertThat(own.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(own.get("selfAdded").asBoolean()).isTrue();
        assertThat(own.get("reviewer").isNull()).isTrue();
        JsonNode back = ok(a.token(), post("/api/tasks/" + own.get("id").asLong() + "/status"), map("status", "IN_PROGRESS"));
        assertThat(back.get("completedAt").isNull()).isTrue();
        assertThat(ok(a.token(), post("/api/tasks"), map("title", "Salary", "status", "COMPLETED", "reviewerId", b.id()))
                .get("status").asText()).isEqualTo("TODO");
    }

    @Test
    void editDeleteAndComments() throws Exception {
        Person a = person("Editor Six");
        Person b = person("Doer Seven");
        Person c = person("Outsider Eight");
        long id = ok(a.token(), post("/api/tasks"), map("title", "Plywood rate", "assigneeId", b.id())).get("id").asLong();
        // only admins edit and delete: not the person doing it, and not the person who assigned it
        call(b.token(), put("/api/tasks/" + id), map("title", "Hack")).andExpect(status().isForbidden());
        call(a.token(), put("/api/tasks/" + id), map("title", "Changed by creator")).andExpect(status().isForbidden());
        call(admin, put("/api/tasks/" + id), map("title", " ")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("title: must not be blank"));
        JsonNode upd = ok(admin, put("/api/tasks/" + id), map("title", "Plywood rate v2", "priority", "URGENT", "assigneeId", b.id()));
        assertThat(upd.get("priority").asText()).isEqualTo("URGENT");

        ok(a.token(), post("/api/tasks/" + id + "/comments"), map("comment", "Need it by Friday"));
        assertThat(lastNote(b.token()).get("message").asText()).contains("commented on \"Plywood rate v2\": Need it by Friday");
        call(c.token(), get("/api/tasks/" + id), null).andExpect(status().isNotFound());
        call(c.token(), delete("/api/tasks/" + id), null).andExpect(status().isNotFound());
        call(a.token(), delete("/api/tasks/" + id), null).andExpect(status().isForbidden());
        call(admin, delete("/api/tasks/" + id), null).andExpect(status().isNoContent());
        call(admin, get("/api/tasks/" + id), null).andExpect(status().isNotFound());
    }

    @Test
    void aTicketIsAlsoATaskForThePersonItIsRaisedTo() throws Exception {
        Person boss = person("Ticket Task Boss");
        Person worker = person("Ticket Task Worker");
        Person expert = person("Ticket Task Expert");
        long id = ok(boss.token(), post("/api/tasks"), map("title", "Check vendor bills", "assigneeId", worker.id(),
                "priority", "HIGH", "dueAt", localDue(2))).get("id").asLong();

        // raising the ticket puts a task in the expert's own list, due with the task and as urgent
        long ticketId = ok(worker.token(), post("/api/tasks/" + id + "/tickets"),
                map("assignedToId", expert.id(), "note", "Please check the GST on these")).get("id").asLong();
        JsonNode mine = ok(expert.token(), get("/api/tasks?scope=assigned"), null);
        JsonNode ticketTask = null;
        for (JsonNode t : mine) if (t.path("fromTicket").path("ticketId").asLong() == ticketId) ticketTask = t;
        assertThat(ticketTask).isNotNull();
        assertThat(ticketTask.get("title").asText()).isEqualTo("Ticket: Check vendor bills");
        assertThat(ticketTask.get("priority").asText()).isEqualTo("HIGH");
        assertThat(ticketTask.get("status").asText()).isEqualTo("TODO");
        assertThat(ticketTask.at("/fromTicket/task/id").asLong()).isEqualTo(id);
        assertThat(ticketTask.at("/createdBy/id").asLong()).isEqualTo(worker.id());

        // resolving the ticket marks that task done, at the time it was resolved
        ok(expert.token(), post("/api/tickets/" + ticketId + "/resolve"), map("reply", "GST is correct"));
        JsonNode done = ok(expert.token(), get("/api/tasks/" + ticketTask.get("id").asLong()), null);
        assertThat(done.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(done.get("completedAt").isNull()).isFalse();
        assertThat(done.at("/fromTicket/status").asText()).isEqualTo("RESOLVED");

        // the other way round: marking the ticket task done resolves the ticket with the note
        long second = ok(worker.token(), post("/api/tasks/" + id + "/tickets"),
                map("assignedToId", expert.id(), "note", "One more bill")).get("id").asLong();
        long secondTask = -1;
        for (JsonNode t : ok(expert.token(), get("/api/tasks?scope=assigned"), null)) {
            if (t.path("fromTicket").path("ticketId").asLong() == second) secondTask = t.get("id").asLong();
        }
        ok(expert.token(), post("/api/tasks/" + secondTask + "/status"), map("status", "COMPLETED", "comment", "Checked it"));
        JsonNode tickets = ok(worker.token(), get("/api/tasks/" + id + "/tickets"), null);
        JsonNode resolved = null;
        for (JsonNode k : tickets) if (k.get("id").asLong() == second) resolved = k;
        assertThat(resolved.get("status").asText()).isEqualTo("RESOLVED");
        assertThat(resolved.get("reply").asText()).isEqualTo("Checked it");
    }

    @Test
    void ticketRaisedToSomeoneElseLetsThemOpenTheTaskAndResolveIt() throws Exception {
        Person boss = person("Ticket Boss");
        Person worker = person("Ticket Worker");
        Person expert = person("Ticket Expert");
        Person outsider = person("Ticket Outsider");
        JsonNode created = ok(boss.token(), post("/api/tasks"), map("title", "Fix vendor GST mismatch", "assigneeId", worker.id(),
                "priority", "HIGH", "dueAt", localDue(-1)));
        long id = created.get("id").asLong();
        assertThat(created.get("overdue").asBoolean()).isTrue();
        assertThat(created.get("pending").asBoolean()).isFalse();

        // the expert is not part of the task yet
        call(expert.token(), get("/api/tasks/" + id), null).andExpect(status().isNotFound());

        call(worker.token(), post("/api/tasks/" + id + "/tickets"), map("assignedToId", worker.id(), "note", "Help"))
                .andExpect(status().isBadRequest());
        call(worker.token(), post("/api/tasks/" + id + "/tickets"), map("assignedToId", expert.id(), "note", " "))
                .andExpect(status().isBadRequest());
        call(outsider.token(), post("/api/tasks/" + id + "/tickets"), map("assignedToId", expert.id(), "note", "Help"))
                .andExpect(status().isNotFound());

        JsonNode ticket = ok(worker.token(), post("/api/tasks/" + id + "/tickets"),
                map("assignedToId", expert.id(), "note", "Vendor PAN does not match the GSTIN, please check"));
        long ticketId = ticket.get("id").asLong();
        assertThat(ticket.get("status").asText()).isEqualTo("OPEN");
        assertThat(ticket.at("/assignedTo/fullName").asText()).isEqualTo("Ticket Expert");
        assertThat(lastNote(expert.token()).get("type").asText()).isEqualTo("TICKET_RAISED");
        assertThat(lastNote(expert.token()).get("message").asText())
                .contains("Ticket Worker raised a ticket to you on \"Fix vendor GST mismatch\"");

        // the task is now pending: not overdue, not in the overdue list, counted as pending on the dashboard
        JsonNode pendingTask = ok(expert.token(), get("/api/tasks/" + id), null);   // the expert can open it now
        assertThat(pendingTask.get("pending").asBoolean()).isTrue();
        assertThat(pendingTask.get("overdue").asBoolean()).isFalse();
        assertThat(ok(worker.token(), get("/api/tasks?overdue=true"), null).findValuesAsText("title"))
                .doesNotContain("Fix vendor GST mismatch");
        JsonNode dash = ok(worker.token(), get("/api/reports/dashboard"), null);
        assertThat(dash.get("pending").asLong()).isEqualTo(1);
        assertThat(dash.get("overdue").asLong()).isZero();
        assertThat(dash.get("todo").asLong()).isZero();
        assertThat(ok(expert.token(), get("/api/tickets"), null).findValuesAsText("note"))
                .contains("Vendor PAN does not match the GSTIN, please check");
        assertThat(ok(worker.token(), get("/api/tickets?scope=raised&status=OPEN"), null).size()).isEqualTo(1);
        call(worker.token(), get("/api/tickets?scope=all"), null).andExpect(status().isForbidden());
        call(outsider.token(), post("/api/tickets/" + ticketId + "/resolve"), map("reply", "Done")).andExpect(status().isNotFound());

        // an employee the ticket is raised to cannot edit or delete the task (only admins can)
        call(worker.token(), put("/api/tasks/" + id), map("title", "Changed by worker")).andExpect(status().isForbidden());
        call(expert.token(), put("/api/tasks/" + id), map("title", "Changed by expert")).andExpect(status().isForbidden());
        call(expert.token(), delete("/api/tasks/" + id), null).andExpect(status().isForbidden());
        // only the expert can choose "mark done"
        call(worker.token(), post("/api/tickets/" + ticketId + "/done"), map("reply", "Me")).andExpect(status().isForbidden());
        call(expert.token(), post("/api/tickets/" + ticketId + "/resolve"), map("reply", "")).andExpect(status().isBadRequest());

        JsonNode resolved = ok(expert.token(), post("/api/tickets/" + ticketId + "/resolve"), map("reply", "Corrected the GSTIN"));
        assertThat(resolved.get("status").asText()).isEqualTo("RESOLVED");
        assertThat(resolved.at("/resolvedBy/fullName").asText()).isEqualTo("Ticket Expert");
        assertThat(lastNote(worker.token()).get("type").asText()).isEqualTo("TICKET_RESOLVED");
        call(expert.token(), post("/api/tickets/" + ticketId + "/resolve"), map("reply", "Again")).andExpect(status().isBadRequest());

        assertThat(resolved.get("taskDone").asBoolean()).isFalse();
        call(expert.token(), post("/api/tickets/" + ticketId + "/done"), map("reply", "Late")).andExpect(status().isBadRequest());

        // resolved: back to its own status, and overdue again
        JsonNode back = ok(worker.token(), get("/api/tasks/" + id), null);
        assertThat(back.get("pending").asBoolean()).isFalse();
        assertThat(back.get("overdue").asBoolean()).isTrue();
        assertThat(back.get("status").asText()).isEqualTo("TODO");
        assertThat(ok(worker.token(), get("/api/tasks?overdue=true"), null).findValuesAsText("title"))
                .contains("Fix vendor GST mismatch");

        assertThat(ok(boss.token(), get("/api/tasks/" + id + "/tickets"), null).size()).isEqualTo(1);
        assertThat(ok(boss.token(), get("/api/tasks/" + id + "/activity"), null).findValuesAsText("action"))
                .contains("TICKET_RAISED", "TICKET_RESOLVED");
        assertThat(ok(admin, get("/api/tickets?scope=all"), null).findValuesAsText("note"))
                .contains("Vendor PAN does not match the GSTIN, please check");
    }

    @Test
    void ticketPersonCanFinishTheTaskThemselves() throws Exception {
        Person boss = person("Done Boss");
        Person worker = person("Done Worker");
        Person expert = person("Done Expert");
        long id = ok(boss.token(), post("/api/tasks"), map("title", "Release vendor payment", "assigneeId", worker.id()))
                .get("id").asLong();
        long ticketId = ok(worker.token(), post("/api/tasks/" + id + "/tickets"),
                map("assignedToId", expert.id(), "note", "I cannot approve payments, please do it")).get("id").asLong();
        call(expert.token(), post("/api/tickets/" + ticketId + "/done"), map("reply", " ")).andExpect(status().isBadRequest());

        JsonNode closed = ok(expert.token(), post("/api/tickets/" + ticketId + "/done"), map("reply", "Payment released"));
        assertThat(closed.get("status").asText()).isEqualTo("RESOLVED");
        assertThat(closed.get("taskDone").asBoolean()).isTrue();

        // the task moved to the expert and is done; it is not sent back to the worker
        JsonNode t = ok(expert.token(), get("/api/tasks/" + id), null);
        assertThat(t.get("status").asText()).isEqualTo("COMPLETED");
        assertThat(t.at("/assignee/fullName").asText()).isEqualTo("Done Expert");
        assertThat(t.get("pending").asBoolean()).isFalse();
        assertThat(ok(expert.token(), get("/api/tasks?scope=assigned&status=COMPLETED"), null).findValuesAsText("title"))
                .contains("Release vendor payment");
        assertThat(ok(worker.token(), get("/api/tasks?scope=assigned"), null).findValuesAsText("title"))
                .doesNotContain("Release vendor payment");
        assertThat(lastNote(worker.token()).get("message").asText()).contains("Done Expert finished \"Release vendor payment\"");
        assertThat(ok(expert.token(), get("/api/tickets?status=RESOLVED"), null).findValuesAsText("note"))
                .contains("I cannot approve payments, please do it");
    }

    @Test
    void employeeAsksAdminToStopARepeatingTaskAndTheTicketCopyStays() throws Exception {
        Person p = person("Repeat Asker");
        long tplId = ok(admin, post("/api/recurring"), map("title", "Daily stock count", "frequency", "DAILY", "assigneeId", p.id()))
                .get("id").asLong();
        call(p.token(), patch("/api/recurring/" + tplId + "/active?value=false"), null).andExpect(status().isForbidden());

        java.time.Instant tomorrow = LocalDate.now(OFFICE).plusDays(1).atStartOfDay(OFFICE).toInstant();
        JsonNode future = null;
        for (JsonNode t : ok(admin, get("/api/tasks?assigneeId=" + p.id()), null)) {
            if (t.get("recurringTemplateId").asLong() == tplId && java.time.Instant.parse(t.get("dueAt").asText()).isAfter(tomorrow)) {
                future = t;
                break;
            }
        }
        assertThat(future).isNotNull();
        long futureId = future.get("id").asLong();
        // the employee finds the same copy in their own list (the screen raises the ticket on it)
        assertThat(ok(p.token(), get("/api/tasks?scope=assigned"), null).findValuesAsText("id")).contains(String.valueOf(futureId));
        JsonNode me = ok(admin, get("/api/auth/me"), null);
        long ticketId = ok(p.token(), post("/api/tasks/" + futureId + "/tickets"),
                map("assignedToId", me.get("id").asLong(), "note", "Please stop this repeating task")).get("id").asLong();

        ok(admin, patch("/api/recurring/" + tplId + "/active?value=false"), null);
        ok(admin, get("/api/tasks/" + futureId), null);   // the copy with the ticket was not removed
        ok(admin, post("/api/tickets/" + ticketId + "/resolve"), map("reply", "Stopped it"));
        assertThat(lastNote(p.token()).get("type").asText()).isEqualTo("TICKET_RESOLVED");
    }

    @Test
    void personalLeaveStopsRepeatingCopiesAndTasksWaitForTheEmployeesDecision() throws Exception {
        Person p = person("Leave Taker");
        Person boss = person("Leave Boss");
        LocalDate today = LocalDate.now(OFFICE);
        LocalDate yesterday = today.minusDays(1);
        long tplId = ok(admin, post("/api/recurring"), map("title", "Daily leave check", "frequency", "DAILY", "assigneeId", p.id()))
                .get("id").asLong();
        // one-off tasks due yesterday (a leave day) and today
        long late = ok(boss.token(), post("/api/tasks"), map("title", "Due on leave A", "assigneeId", p.id(),
                "dueAt", yesterday + "T11:00")).get("id").asLong();
        long late2 = ok(boss.token(), post("/api/tasks"), map("title", "Due on leave B", "assigneeId", p.id(),
                "dueAt", yesterday + "T12:00")).get("id").asLong();
        assertThat(ok(p.token(), get("/api/tasks/" + late), null).get("overdue").asBoolean()).isTrue();

        // employees add only their own leave, and not for past days
        call(p.token(), post("/api/leaves"), map("employeeId", p.id(), "startDate", yesterday.toString(), "endDate", today.plusDays(2).toString()))
                .andExpect(status().isBadRequest());
        call(p.token(), post("/api/leaves"), map("employeeId", boss.id(), "startDate", today.toString(), "endDate", today.toString()))
                .andExpect(status().isForbidden());
        call(admin, post("/api/leaves"), map("employeeId", p.id(), "startDate", today.toString(), "endDate", yesterday.toString()))
                .andExpect(status().isBadRequest());
        long leaveId = ok(admin, post("/api/leaves"), map("employeeId", p.id(), "startDate", yesterday.toString(),
                "endDate", today.plusDays(2).toString(), "reason", "Family function")).get("id").asLong();
        call(admin, post("/api/leaves"), map("employeeId", p.id(), "startDate", today.toString(), "endDate", today.toString()))
                .andExpect(status().isBadRequest());   // overlaps
        assertThat(lastNote(p.token()).get("type").asText()).isEqualTo("LEAVE_ADDED");
        assertThat(ok(p.token(), get("/api/leaves"), null).size()).isEqualTo(1);

        // no repeating copies on the leave days; the task due on leave is not overdue
        java.time.Instant leaveEnd = today.plusDays(3).atStartOfDay(OFFICE).toInstant();
        for (JsonNode t : ok(admin, get("/api/tasks?assigneeId=" + p.id()), null)) {
            if (t.get("recurringTemplateId").isNull()) continue;
            assertThat(java.time.Instant.parse(t.get("dueAt").asText())).isAfterOrEqualTo(leaveEnd);
        }
        JsonNode onLeave = ok(p.token(), get("/api/tasks/" + late), null);
        assertThat(onLeave.get("onLeave").asBoolean()).isTrue();
        assertThat(onLeave.get("overdue").asBoolean()).isFalse();
        assertThat(ok(p.token(), get("/api/tasks?overdue=true"), null).findValuesAsText("title")).doesNotContain("Due on leave A");
        call(admin, post("/api/recurring/" + tplId + "/generate-now"), null).andExpect(status().isBadRequest());

        // the employee decides: allow = new date (not in the past, not on leave), deny = skip
        call(boss.token(), post("/api/tasks/" + late + "/leave-decision"), map("decision", "ALLOW", "dueAt", today.plusDays(4) + "T18:00"))
                .andExpect(status().isForbidden());
        call(p.token(), post("/api/tasks/" + late + "/leave-decision"), map("decision", "ALLOW", "dueAt", yesterday + "T18:00"))
                .andExpect(status().isBadRequest());
        call(p.token(), post("/api/tasks/" + late + "/leave-decision"), map("decision", "ALLOW", "dueAt", today.plusDays(1) + "T18:00"))
                .andExpect(status().isBadRequest());   // still on leave then
        JsonNode moved = ok(p.token(), post("/api/tasks/" + late + "/leave-decision"),
                map("decision", "ALLOW", "dueAt", today.plusDays(4) + "T18:00"));
        assertThat(moved.get("onLeave").asBoolean()).isFalse();
        assertThat(moved.get("status").asText()).isEqualTo("TODO");
        assertThat(lastNote(boss.token()).get("message").asText()).contains("was on leave and moved \"Due on leave A\"");
        JsonNode skipped = ok(p.token(), post("/api/tasks/" + late2 + "/leave-decision"), map("decision", "DENY", "note", "No longer needed"));
        assertThat(skipped.get("status").asText()).isEqualTo("CANCELLED");
        assertThat(lastNote(boss.token()).get("message").asText()).contains("skipped \"Due on leave B\"");

        // removing the leave makes the repeating copies again
        ok(admin, delete("/api/leaves/" + leaveId), null);
        boolean todayCopy = false;
        for (JsonNode t : ok(admin, get("/api/tasks?assigneeId=" + p.id()), null)) {
            if (!t.get("recurringTemplateId").isNull()
                    && java.time.Instant.parse(t.get("dueAt").asText()).atZone(OFFICE).toLocalDate().equals(today)) todayCopy = true;
        }
        assertThat(todayCopy || today.getDayOfWeek() == DayOfWeek.SUNDAY).isTrue();
    }

    @Test
    void employeeAddsOwnLeaveButOnlyAdminsChangeItAskedForWithATicket() throws Exception {
        Person p = person("Leave Self");
        LocalDate today = LocalDate.now(OFFICE);
        JsonNode leave = ok(p.token(), post("/api/leaves"), map("employeeId", p.id(), "startDate", today.plusDays(5).toString(),
                "endDate", today.plusDays(6).toString(), "reason", "Wedding"));
        long leaveId = leave.get("id").asLong();
        assertThat(lastNote(admin).get("message").asText()).contains("Leave Self added leave");

        // only admins edit or remove it
        call(p.token(), put("/api/leaves/" + leaveId), map("employeeId", p.id(), "startDate", today.plusDays(5).toString(),
                "endDate", today.plusDays(8).toString())).andExpect(status().isForbidden());
        call(p.token(), delete("/api/leaves/" + leaveId), null).andExpect(status().isForbidden());

        // so the employee raises a ticket about the leave to an admin
        long adminId = ok(admin, get("/api/auth/me"), null).get("id").asLong();
        Person other = person("Leave Other");
        call(p.token(), post("/api/leaves/" + leaveId + "/tickets"), map("assignedToId", other.id(), "note", "Change it"))
                .andExpect(status().isBadRequest());   // must be an admin
        call(other.token(), post("/api/leaves/" + leaveId + "/tickets"), map("assignedToId", adminId, "note", "Change it"))
                .andExpect(status().isNotFound());     // not their leave
        JsonNode ticket = ok(p.token(), post("/api/leaves/" + leaveId + "/tickets"),
                map("assignedToId", adminId, "note", "Please make it 3 days, till the 8th"));
        assertThat(ticket.get("task").isNull()).isTrue();
        assertThat(ticket.get("subject").asText()).startsWith("Leave ");
        assertThat(ticket.get("leaveId").asLong()).isEqualTo(leaveId);
        assertThat(ok(admin, get("/api/tickets"), null).findValuesAsText("note")).contains("Please make it 3 days, till the 8th");

        JsonNode changed = ok(admin, put("/api/leaves/" + leaveId), map("employeeId", p.id(), "startDate", today.plusDays(5).toString(),
                "endDate", today.plusDays(8).toString(), "reason", "Wedding"));
        assertThat(changed.get("endDate").asText()).isEqualTo(today.plusDays(8).toString());
        call(admin, post("/api/tickets/" + ticket.get("id").asLong() + "/done"), map("reply", "x")).andExpect(status().isBadRequest());
        ok(admin, post("/api/tickets/" + ticket.get("id").asLong() + "/resolve"), map("reply", "Changed to 3 days"));
        assertThat(lastNote(p.token()).get("type").asText()).isEqualTo("TICKET_RESOLVED");

        // removing the leave keeps the ticket (it just no longer points to the leave)
        ok(admin, delete("/api/leaves/" + leaveId), null);
        JsonNode kept = ok(p.token(), get("/api/tickets?scope=raised&status=RESOLVED"), null).get(0);
        assertThat(kept.get("subject").asText()).startsWith("Leave ");
        assertThat(kept.get("leaveId").isNull()).isTrue();
    }

    @Test
    void listFilters() throws Exception {
        Person a = person("Lister Nine");
        Person b = person("Helper Ten");
        ok(a.token(), post("/api/tasks"), map("title", "Unique zebra report", "assigneeId", b.id(), "priority", "URGENT"));
        ok(a.token(), post("/api/tasks"), map("title", "My own thing"));
        assertThat(ok(a.token(), get("/api/tasks?scope=created"), null).findValuesAsText("title")).containsExactly("Unique zebra report");
        assertThat(ok(a.token(), get("/api/tasks"), null).findValuesAsText("title")).containsExactly("My own thing");
        assertThat(ok(admin, get("/api/tasks?q=ZEBRA"), null).findValuesAsText("title")).containsExactly("Unique zebra report");
        JsonNode urgent = ok(admin, get("/api/tasks?priority=URGENT&assigneeId=" + b.id()), null);
        assertThat(urgent.size()).isEqualTo(1);
        call(admin, get("/api/tasks?scope=everything"), null).andExpect(status().isBadRequest());
    }

    // ================================================================ daily & weekly, holidays

    @Test
    void dailyCopiesNeverOnSundayAndPauseRemovesFuture() throws Exception {
        Person p = person("Daily Eleven");
        JsonNode tpl = ok(admin, post("/api/recurring"), map("title", "Cash book " + p.id(), "assigneeId", p.id(),
                "frequency", "DAILY", "dueTime", "11:00", "estimatedHours", 2.5));
        assertThat(tpl.get("dueTime").asText()).isEqualTo("11:00:00");
        assertThat(tpl.get("estimatedHours").asDouble()).isEqualTo(2.5);
        JsonNode copies = ok(admin, get("/api/tasks?assigneeId=" + p.id()), null);
        long expected = 0;
        for (int i = 0; i < 7; i++) if (LocalDate.now(OFFICE).plusDays(i).getDayOfWeek() != DayOfWeek.SUNDAY) expected++;
        assertThat(copies.size()).isEqualTo((int) expected);   // test database has no holidays in the next week
        copies.forEach(c -> {
            assertThat(c.get("repeat").asText()).isEqualTo("DAILY");
            assertThat(c.get("estimatedHours").asDouble()).isEqualTo(2.5);
        });

        ok(admin, patch("/api/recurring/" + tpl.get("id").asLong() + "/active?value=false"), null);
        LocalDate tomorrow = LocalDate.now(OFFICE).plusDays(1);
        JsonNode left = ok(admin, get("/api/tasks?assigneeId=" + p.id() + "&workFrom=" + tomorrow), null);
        assertThat(left.size()).isZero();

        call(admin, post("/api/recurring"), map("title", "W", "assigneeId", p.id(), "frequency", "WEEKLY", "dayOfWeek", "SUNDAY"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Sunday is the weekly off. Choose Monday to Saturday."));
    }

    @Test
    void monthlyAndYearlyScheduledTasksUseStartTimeAndDuration() throws Exception {
        Person p = person("Monthly Scheduled");
        var holidays = ok(admin, get("/api/holidays"), null).findValuesAsText("date");
        LocalDate occurrence = LocalDate.now(OFFICE).plusDays(1);
        for (int i = 0; i < 7 && (occurrence.getDayOfWeek() == DayOfWeek.SUNDAY || holidays.contains(occurrence.toString())); i++) {
            occurrence = occurrence.plusDays(1);
        }

        JsonNode template = ok(admin, post("/api/recurring"), map(
                "title", "Monthly check " + p.id(),
                "assigneeId", p.id(),
                "frequency", "MONTHLY",
                "startDate", occurrence.toString(),
                "scheduledTime", "09:30",
                "durationMinutes", 20));
        assertThat(template.get("frequency").asText()).isEqualTo("MONTHLY");
        assertThat(template.get("scheduledTime").asText()).isEqualTo("09:30:00");
        assertThat(template.get("durationMinutes").asInt()).isEqualTo(20);
        JsonNode yearlyTemplate = ok(admin, post("/api/recurring"), map(
                "title", "Yearly check " + p.id(),
                "assigneeId", p.id(),
                "frequency", "YEARLY",
                "startDate", occurrence.toString(),
                "scheduledTime", "09:30",
                "durationMinutes", 20));
        assertThat(yearlyTemplate.get("frequency").asText()).isEqualTo("YEARLY");

        JsonNode tasks = ok(admin, get("/api/tasks?assigneeId=" + p.id() + "&workFrom=" + occurrence + "&workTo=" + occurrence), null);
        assertThat(tasks).hasSize(2);
        assertThat(tasks.findValuesAsText("repeat")).containsExactlyInAnyOrder("MONTHLY", "YEARLY");
        tasks.forEach(task -> {
            assertThat(java.time.Instant.parse(task.get("scheduledAt").asText()).atZone(OFFICE).toLocalTime().toString()).isEqualTo("09:30");
            assertThat(java.time.Duration.between(
                    java.time.Instant.parse(task.get("scheduledAt").asText()),
                    java.time.Instant.parse(task.get("dueAt").asText())).toMinutes()).isEqualTo(20);
        });
    }

    @Test
    void upcomingWorkStartedTodayShowsTodayAndFinishedWorkShowsWhenItWasDone() throws Exception {
        Person assigner = person("Early Assigner");
        Person worker = person("Early Worker");
        LocalDate today = LocalDate.now(OFFICE);
        long id = ok(assigner.token(), post("/api/tasks"), map("title", "Start early " + worker.id(), "assigneeId", worker.id(),
                "dueAt", localDue(10))).get("id").asLong();
        String todayList = "/api/tasks?workFrom=" + today + "&workTo=" + today;
        assertThat(ok(worker.token(), get(todayList), null).findValuesAsText("id")).doesNotContain(String.valueOf(id));

        JsonNode started = ok(worker.token(), post("/api/tasks/" + id + "/status"), map("status", "IN_PROGRESS"));
        assertThat(java.time.Instant.parse(started.get("startedAt").asText()).atZone(OFFICE).toLocalDate()).isEqualTo(today);
        assertThat(ok(worker.token(), get(todayList), null).findValuesAsText("id")).contains(String.valueOf(id));
        // not on its old due day any more
        LocalDate due = java.time.Instant.parse(started.get("dueAt").asText()).atZone(OFFICE).toLocalDate();
        assertThat(ok(worker.token(), get("/api/tasks?workFrom=" + due + "&workTo=" + due), null).findValuesAsText("id"))
                .doesNotContain(String.valueOf(id));
        // ... unless the calendar asks for work scheduled on that day too
        assertThat(ok(worker.token(), get("/api/tasks?workFrom=" + due + "&workTo=" + due + "&withPlanned=true"), null)
                .findValuesAsText("id")).contains(String.valueOf(id));
    }

    @Test
    void anUpcomingMonthlyDayCanBeOpenedFromTheCalendar() throws Exception {
        Person p = person("Monthly Open Ahead");
        var holidays = ok(admin, get("/api/holidays"), null).findValuesAsText("date");
        LocalDate start = LocalDate.now(OFFICE).plusDays(1);
        long tplId = ok(admin, post("/api/recurring"), map(
                "title", "Monthly open " + p.id(), "assigneeId", p.id(), "frequency", "MONTHLY",
                "startDate", start.toString(), "scheduledTime", "09:30", "durationMinutes", 20)).get("id").asLong();
        // a later month whose day is a working day, well past the 7 days the server fills
        LocalDate later = start.plusMonths(2);
        for (int i = 0; i < 12 && (later.getDayOfWeek() == DayOfWeek.SUNDAY || holidays.contains(later.toString())
                || later.getDayOfMonth() != start.getDayOfMonth()); i++) {
            later = start.plusMonths(3 + i);
        }

        long taskId = ok(p.token(), post("/api/recurring/" + tplId + "/copies?date=" + later), null).get("taskId").asLong();
        JsonNode task = ok(p.token(), get("/api/tasks/" + taskId), null);
        assertThat(task.get("repeat").asText()).isEqualTo("MONTHLY");
        assertThat(java.time.Instant.parse(task.get("scheduledAt").asText()).atZone(OFFICE).toLocalDate()).isEqualTo(later);
        // opening it again gives the same task, not a second copy
        assertThat(ok(p.token(), post("/api/recurring/" + tplId + "/copies?date=" + later), null).get("taskId").asLong()).isEqualTo(taskId);
        // a day it does not repeat on
        call(p.token(), post("/api/recurring/" + tplId + "/copies?date=" + later.plusDays(1)), null).andExpect(status().isBadRequest());
    }

    @Test
    void monthlyTaskCanBeDueOnALaterDayInsteadOfAfterMinutes() throws Exception {
        Person p = person("Monthly Due Later");
        var holidays = ok(admin, get("/api/holidays"), null).findValuesAsText("date");
        LocalDate occurrence = LocalDate.now(OFFICE).plusDays(1);
        for (int i = 0; i < 7 && (occurrence.getDayOfWeek() == DayOfWeek.SUNDAY || holidays.contains(occurrence.toString())); i++) {
            occurrence = occurrence.plusDays(1);
        }

        JsonNode template = ok(admin, post("/api/recurring"), map(
                "title", "Monthly bills " + p.id(), "assigneeId", p.id(), "frequency", "MONTHLY",
                "startDate", occurrence.toString(), "scheduledTime", "09:30",
                "dueTime", "17:00", "dueDaysAfter", 3));
        assertThat(template.get("durationMinutes").isNull()).isTrue();
        assertThat(template.get("dueDaysAfter").asInt()).isEqualTo(3);
        assertThat(template.get("dueTime").asText()).isEqualTo("17:00:00");

        JsonNode task = null;
        for (JsonNode t : ok(admin, get("/api/tasks?assigneeId=" + p.id()), null)) {
            if (t.get("recurringTemplateId").asLong() == template.get("id").asLong()) task = t;
        }
        assertThat(task).isNotNull();
        var start = java.time.Instant.parse(task.get("scheduledAt").asText()).atZone(OFFICE);
        var due = java.time.Instant.parse(task.get("dueAt").asText()).atZone(OFFICE);
        assertThat(start.toLocalDate()).isEqualTo(occurrence);
        assertThat(start.toLocalTime().toString()).isEqualTo("09:30");
        assertThat(due.toLocalDate()).isEqualTo(occurrence.plusDays(3));
        assertThat(due.toLocalTime().toString()).isEqualTo("17:00");

        // a weekly task must be due before the next week's copy starts
        call(admin, post("/api/recurring"), map("title", "Too late", "assigneeId", p.id(), "frequency", "WEEKLY",
                "dayOfWeek", "MONDAY", "scheduledTime", "09:30", "dueTime", "17:00", "dueDaysAfter", 7))
                .andExpect(status().isBadRequest());
        // same day: due time must be after the start time
        call(admin, post("/api/recurring"), map("title", "Backwards", "assigneeId", p.id(), "frequency", "MONTHLY",
                "startDate", occurrence.toString(), "scheduledTime", "09:30", "dueTime", "09:00", "dueDaysAfter", 0))
                .andExpect(status().isBadRequest());
    }

    @Test
    void employeesCanCreateRepeatingWorkForOthersButCannotChangeAdminAssignments() throws Exception {
        Person p = person("Self Twelve");
        Person other = person("Other Thirteen");
        JsonNode assigned = ok(p.token(), post("/api/recurring"), map("title", "My plan", "frequency", "DAILY", "assigneeId", other.id()));
        assertThat(assigned.at("/assignee/id").asLong()).isEqualTo(other.id());
        assertThat(assigned.get("selfOwned").asBoolean()).isFalse();
        assertThat(assigned.at("/createdBy/id").asLong()).isEqualTo(p.id());
        JsonNode fromAdmin = ok(admin, post("/api/recurring"), map("title", "Admin plan", "frequency", "DAILY", "assigneeId", p.id()));
        call(p.token(), patch("/api/recurring/" + fromAdmin.get("id").asLong() + "/active?value=false"), null)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Only an admin can change a repeating task"));
        // not even one they set up themselves: they can see it, but only an admin changes or stops it
        call(p.token(), patch("/api/recurring/" + assigned.get("id").asLong() + "/active?value=false"), null)
                .andExpect(status().isForbidden());
        call(p.token(), delete("/api/recurring/" + assigned.get("id").asLong()), null).andExpect(status().isForbidden());
        assertThat(ok(p.token(), get("/api/recurring"), null).findValuesAsText("title")).contains("My plan", "Admin plan");
        assertThat(ok(admin, patch("/api/recurring/" + assigned.get("id").asLong() + "/active?value=false"), null)
                .get("active").asBoolean()).isFalse();
        call(other.token(), patch("/api/recurring/" + fromAdmin.get("id").asLong() + "/active?value=false"), null).andExpect(status().isNotFound());
    }

    @Test
    void holidayRemovesCopiesAndDeletingBringsThemBack() throws Exception {
        Person p = person("Holiday Fourteen");
        ok(admin, post("/api/recurring"), map("title", "Site report " + p.id(), "assigneeId", p.id(), "frequency", "DAILY", "dueTime", "19:00"));
        LocalDate day = LocalDate.now(OFFICE).plusDays(1);
        while (day.getDayOfWeek() == DayOfWeek.SUNDAY) day = day.plusDays(1);
        String q = "/api/tasks?assigneeId=" + p.id() + "&workFrom=" + day + "&workTo=" + day;
        assertThat(ok(admin, get(q), null).size()).isEqualTo(1);

        call(p.token(), post("/api/holidays"), map("date", day.toString(), "name", "X")).andExpect(status().isForbidden());
        JsonNode h = ok(admin, post("/api/holidays"), map("date", day.toString(), "name", "Local holiday"));
        assertThat(ok(admin, get(q), null).size()).isZero();
        call(admin, post("/api/holidays"), map("date", day.toString(), "name", "Again")).andExpect(status().isBadRequest());
        ok(admin, delete("/api/holidays/" + h.get("id").asLong()), null);
        assertThat(ok(admin, get(q), null).size()).isEqualTo(1);
    }

    // ================================================================ FMS

    Map<String, Object> flow(String name, String frequency, long step1, long step2) {
        return map("name", name, "description", "Vendor bill received", "frequency", frequency, "startTime", "00:01", "endTime", "23:59",
                "formFields", List.of(map("label", "Vendor", "type", "text", "required", true),
                        map("label", "Site", "type", "select", "options", "PIL, AIGP")),
                "steps", List.of(map("title", "Check bill", "assigneeId", step1, "hours", 1, "checklist", List.of("Match PO", " ", "Match GRN")),
                        map("title", "Approve payment", "assigneeId", step2, "hours", 2), map("title", "  ")));
    }

    @Test
    void workflowSetupIsChecked() throws Exception {
        Person s = person("Step Fifteen");
        Map<String, Object> bad = flow("", "ON_DEMAND", s.id(), s.id());
        call(admin, post("/api/workflows"), bad).andExpect(jsonPath("$.message").value("Give the workflow a name"));
        bad = flow("F", "ON_DEMAND", s.id(), s.id());
        bad.put("endTime", "00:00");
        call(admin, post("/api/workflows"), bad).andExpect(jsonPath("$.message").value("End time must be after start time"));
        bad = flow("F", "WEEKLY", s.id(), s.id());
        call(admin, post("/api/workflows"), bad).andExpect(jsonPath("$.message").value("Choose a day of the week for weekly workflows"));
        bad = flow("F", "ON_DEMAND", s.id(), s.id());
        bad.put("department", "A".repeat(81));
        call(admin, post("/api/workflows"), bad).andExpect(jsonPath("$.message").value("Department must be 80 characters or fewer"));
        Map<String, Object> request = flow("Bill approval", "ON_DEMAND", s.id(), s.id());
        request.put("department", " Accounts ");
        JsonNode w = ok(admin, post("/api/workflows"), request);
        assertThat(w.get("department").asText()).isEqualTo("Accounts");
        request.put("department", "Projects");
        JsonNode updated = ok(admin, put("/api/workflows/" + w.get("id").asLong()), request);
        assertThat(updated.get("department").asText()).isEqualTo("Projects");
        assertThat(w.get("steps").size()).isEqualTo(2);   // blank step skipped
        assertThat(w.at("/steps/0/checklist").size()).isEqualTo(2);   // blank how step skipped
        assertThat(w.at("/formFields/1/options").toString()).isEqualTo("[\"PIL\",\"AIGP\"]");
        assertThat(w.at("/formFields/0/id").asText()).isEqualTo("f1");
        assertThat(w.get("totalHours").asInt()).isEqualTo(3);
        assertThat(w.get("startTime").asText()).isEqualTo("00:01");
    }

    @Test
    void workflowCanBeCreatedWithoutAssigningAnySteps() throws Exception {
        Person s1 = person("Unassigned FMS One");
        Map<String, Object> request = flow("Unassigned FMS " + UUID.randomUUID(), "ON_DEMAND", s1.id(), s1.id());
        List<Map<String, Object>> steps = List.of(
                map("title", "Check bill", "assigneeId", null, "hours", 1, "checklist", List.of("Match PO", "Match GRN")),
                map("title", "Approve payment", "assigneeId", null, "hours", 2));
        request.put("steps", steps);
        JsonNode workflow = ok(admin, post("/api/workflows"), request);
        assertThat(workflow.at("/steps/0/assignee").isNull()).isTrue();
        assertThat(workflow.at("/steps/1/assignee").isNull()).isTrue();
        call(admin, post("/api/workflows/" + workflow.get("id").asLong() + "/start-now"), map("formData", Map.of()))
                .andExpect(jsonPath("$.message").value("Assign an active person to every FMS step before starting it"));

        request.put("steps", List.of(
                map("title", "Check bill", "assigneeId", s1.id(), "hours", 1, "checklist", List.of("Match PO", "Match GRN")),
                map("title", "Approve payment", "assigneeId", s1.id(), "hours", 2)));
        JsonNode assigned = ok(admin, put("/api/workflows/" + workflow.get("id").asLong()), request);
        assertThat(assigned.at("/steps/0/assignee/id").asLong()).isEqualTo(s1.id());
    }

    @Test
    void startNowChecklistNextStepAndFinish() throws Exception {
        Person s1 = person("Checker Sixteen");
        Person s2 = person("Approver Seventeen");
        JsonNode w = ok(admin, post("/api/workflows"), flow("Bill flow " + UUID.randomUUID(), "ON_DEMAND", s1.id(), s2.id()));
        String start = "/api/workflows/" + w.get("id").asLong() + "/start-now";
        call(admin, post(start), map("formData", Map.of())).andExpect(jsonPath("$.message").value("Please fill “Vendor”"));
        call(admin, post(start), map("formData", map("f1", "A", "f2", "Other"))).andExpect(jsonPath("$.message").value("Choose a valid option for “Site”"));
        JsonNode run = ok(admin, post(start), map("formData", map("f1", " Asian Paints ", "f2", "PIL")));
        assertThat(run.get("label").asText()).isEqualTo("Asian Paints");
        assertThat(run.at("/steps/0/task/status").asText()).isEqualTo("IN_PROGRESS");
        assertThat(run.at("/steps/1/task").isNull()).isTrue();

        long step1 = run.at("/steps/0/task/id").asLong();
        JsonNode t1 = ok(s1.token(), get("/api/tasks/" + step1), null);
        assertThat(t1.at("/workflow/step").asInt()).isEqualTo(1);
        assertThat(t1.get("estimatedHours").asInt()).isEqualTo(1);
        assertThat(t1.get("dueAt").isNull()).isFalse();
        assertThat(t1.get("reviewer").isNull()).isTrue();
        call(s1.token(), post("/api/tasks/" + step1 + "/status"), map("status", "COMPLETED"))
                .andExpect(jsonPath("$.message").value("Tick every checklist item first, then mark the step done"));
        ok(s1.token(), post("/api/tasks/" + step1 + "/checklist"), map("index", 0, "done", true));
        ok(s1.token(), post("/api/tasks/" + step1 + "/checklist"), map("index", 1, "done", true));
        call(s1.token(), post("/api/tasks/" + step1 + "/checklist"), map("index", 5, "done", true)).andExpect(status().isNotFound());
        ok(s1.token(), post("/api/tasks/" + step1 + "/status"), map("status", "COMPLETED"));
        call(s1.token(), get("/api/tasks/" + step1), null).andExpect(status().isNotFound());

        JsonNode live = ok(s2.token(), get("/api/workflows/runs/" + run.get("id").asLong()), null);
        assertThat(live.get("currentStep").asInt()).isEqualTo(2);
        assertThat(live.at("/steps/1/task/id").asLong()).isEqualTo(step1);
        assertThat(live.at("/steps/0/task/id").isNull()).isTrue();
        assertThat(lastNote(s2.token()).get("message").asText()).contains("Checker Sixteen finished step 1");
        ok(s2.token(), post("/api/tasks/" + live.at("/steps/1/task/id").asLong() + "/status"), map("status", "COMPLETED"));
        JsonNode finished = ok(admin, get("/api/workflows/runs/" + run.get("id").asLong()), null);
        assertThat(finished.get("status").asText()).isEqualTo("DONE");
        finished.get("steps").forEach(st -> assertThat(st.get("delayMinutes").isNull()).isFalse());
        assertThat(ok(admin, get("/api/workflows/" + w.get("id").asLong() + "/runs"), null).size()).isEqualTo(1);
    }

    @Test
    void scheduledRunWaitsForStepOnesForm() throws Exception {
        if (LocalDate.now(OFFICE).getDayOfWeek() == DayOfWeek.SUNDAY) return;   // nothing runs on Sundays
        Person s1 = person("Gate Eighteen");
        Person s2 = person("Sign Nineteen");
        JsonNode w = ok(admin, post("/api/workflows"), flow("Gate pass " + s1.id(), "DAILY", s1.id(), s2.id()));
        JsonNode today = null;
        for (JsonNode r : ok(s1.token(), get("/api/workflows/runs"), null)) {
            if (r.get("workflowId").asLong() == w.get("id").asLong()) today = r;
        }
        assertThat(today).isNotNull();
        assertThat(today.get("needsForm").asBoolean()).isTrue();
        long step1 = today.at("/steps/0/task/id").asLong();
        call(s1.token(), post("/api/tasks/" + step1 + "/status"), map("status", "IN_PROGRESS"))
                .andExpect(jsonPath("$.message").value("Fill the workflow form first. The work starts after the form is filled."));
        String form = "/api/workflows/runs/" + today.get("id").asLong() + "/form";
        call(s2.token(), post(form), map("formData", map("f1", "X"))).andExpect(status().isForbidden());
        JsonNode filled = ok(s1.token(), post(form), map("formData", map("f1", "MH12 AB 1234")));
        assertThat(filled.get("needsForm").asBoolean()).isFalse();
        assertThat(ok(s1.token(), get("/api/tasks/" + step1), null).get("status").asText()).isEqualTo("IN_PROGRESS");
        call(s1.token(), post(form), map("formData", map("f1", "Y"))).andExpect(jsonPath("$.message").value("The form for this run is already filled"));
        assertThat(scheduler.runAll().workflowRuns()).isZero();   // only one scheduled run a day
    }

    @Test
    void linkedTaskHearsWhenItsFmsFinishes() throws Exception {
        Person p = person("Linked Twenty");
        long taskId = ok(p.token(), post("/api/tasks"), map("title", "Site bill")).get("id").asLong();
        Map<String, Object> body = map("name", "Site bill FMS", "frequency", "ON_DEMAND", "startTime", "09:00", "endTime", "18:00",
                "sourceTaskId", taskId, "startNow", true,
                "steps", List.of(map("title", "A", "assigneeId", p.id(), "hours", 1), map("title", "B", "assigneeId", p.id(), "hours", 1)));
        JsonNode w = ok(p.token(), post("/api/workflows"), body);
        assertThat(ok(p.token(), get("/api/workflows?taskId=" + taskId), null).findValuesAsText("name")).containsExactly("Site bill FMS");
        JsonNode run = ok(p.token(), get("/api/workflows/runs?taskId=" + taskId), null).get(0);
        ok(p.token(), post("/api/tasks/" + run.at("/steps/0/task/id").asLong() + "/status"), map("status", "COMPLETED"));
        run = ok(p.token(), get("/api/workflows/runs/" + run.get("id").asLong()), null);
        ok(p.token(), post("/api/tasks/" + run.at("/steps/1/task/id").asLong() + "/status"), map("status", "COMPLETED"));
        assertThat(ok(p.token(), get("/api/workflows/runs?taskId=" + taskId), null).at("/0/status").asText()).isEqualTo("DONE");
        JsonNode history = ok(p.token(), get("/api/tasks/" + taskId + "/activity"), null);
        assertThat(history.get(history.size() - 1).get("comment").asText()).endsWith("finished: all 2 steps completed.");

        Person outsider = person("Outsider TwentyOne");
        call(outsider.token(), post("/api/tasks"), map("title", "X", "workflowId", w.get("id").asLong()))
                .andExpect(jsonPath("$.message").value("Choose an FMS you can access"));
        call(outsider.token(), patch("/api/workflows/" + w.get("id").asLong() + "/active?value=false"), null).andExpect(status().isNotFound());
    }

    @Test
    void anyVisibleEmployeeCanEditFmsButCannotPauseIt() throws Exception {
        Person stepOne = person("Fms Editor");
        Person stepTwo = person("Fms Reviewer");
        Map<String, Object> initial = flow("Editable FMS " + UUID.randomUUID(), "ON_DEMAND", stepOne.id(), stepTwo.id());
        initial.put("startTime", "10:00");
        initial.put("endTime", "18:00");
        JsonNode workflow = ok(admin, post("/api/workflows"), initial);
        String path = "/api/workflows/" + workflow.get("id").asLong();

        Map<String, Object> edit = flow("Updated FMS " + UUID.randomUUID(), "ON_DEMAND", stepOne.id(), stepTwo.id());
        edit.put("startTime", "10:00");
        edit.put("endTime", "18:00");
        JsonNode updated = ok(stepOne.token(), put(path), edit);
        assertThat(updated.get("name").asText()).startsWith("Updated FMS");
        call(stepOne.token(), patch(path + "/active?value=false"), null).andExpect(status().isForbidden());

        Person outsider = person("Fms Outsider");
        Map<String, Object> unauthorized = flow("Unauthorized edit", "ON_DEMAND", stepOne.id(), stepTwo.id());
        unauthorized.put("startTime", "10:00");
        unauthorized.put("endTime", "18:00");
        call(outsider.token(), put(path), unauthorized)
                .andExpect(status().isNotFound());
    }

    @Test
    void startingDailyFmsForLinkedTaskCreatesOnlyOneRunToday() throws Exception {
        Person stepOne = person("Daily FMS Starter");
        Person stepTwo = person("Daily FMS Next");
        long sourceTaskId = ok(admin, post("/api/tasks"), map("title", "Purchase request " + stepOne.id(),
                "assigneeId", stepOne.id())).get("id").asLong();
        Map<String, Object> request = flow("Linked daily FMS " + UUID.randomUUID(), "DAILY", stepOne.id(), stepTwo.id());
        request.put("startTime", "10:00");
        request.put("endTime", "18:00");
        request.put("sourceTaskId", sourceTaskId);
        request.put("startNow", true);

        JsonNode workflow = ok(admin, post("/api/workflows"), request);
        scheduler.runAll();
        JsonNode runs = ok(admin, get("/api/workflows/" + workflow.get("id").asLong() + "/runs"), null);
        assertThat(runs).hasSize(1);
        assertThat(runs.get(0).at("/sourceTask/id").asLong()).isEqualTo(sourceTaskId);
        JsonNode secondRun = ok(admin, post("/api/workflows/" + workflow.get("id").asLong() + "/start-now"),
                map("formData", map("f1", "PIL", "f2", "AIGP")));
        assertThat(secondRun.get("id").asLong()).isNotEqualTo(runs.get(0).get("id").asLong());
        assertThat(ok(admin, get("/api/workflows/" + workflow.get("id").asLong() + "/runs"), null)).hasSize(2);
    }

    // ================================================================ reports & notifications

    @Test
    void reportsAddUpAndEmployeesSeeOnlyThemselves() throws Exception {
        Person p = person("Report TwentyTwo");
        JsonNode d = ok(admin, get("/api/reports/dashboard"), null);
        assertThat(d.get("totalOpen").asLong()).isEqualTo(d.get("todo").asLong() + d.get("inProgress").asLong() + d.get("awaitingReview").asLong());
        long byPriority = 0;
        for (JsonNode v : d.get("openByPriority")) byPriority += v.asLong();
        assertThat(byPriority).isEqualTo(d.get("totalOpen").asLong());

        JsonNode team = ok(admin, get("/api/reports/team"), null);
        team.forEach(m -> assertThat(m.at("/today/total").asLong())
                .isEqualTo(m.at("/today/todo").asLong() + m.at("/today/inProgress").asLong() + m.at("/today/done").asLong()));
        call(p.token(), get("/api/reports/team"), null).andExpect(status().isForbidden());

        JsonNode perf = ok(p.token(), get("/api/reports/performance?employeeId=1"), null);
        assertThat(perf.get("employeeId").asLong()).isEqualTo(p.id());
        assertThat(perf.get("trend").size()).isEqualTo(6);
        assertThat(perf.has("score")).isTrue();   // performance fields are at the top level
        assertThat(ok(admin, get("/api/reports/yearly?employeeId=" + p.id() + "&year=2026"), null).get("months").size()).isEqualTo(12);
        call(admin, get("/api/reports/performance?month=2026-13"), null).andExpect(jsonPath("$.message").value("Invalid month: 2026-13"));

        JsonNode daily = ok(admin, get("/api/reports/daily?from=2026-10-01&to=2026-10-07"), null);
        assertThat(daily.size()).isEqualTo(7);
        assertThat(daily.at("/0/date").asText()).isEqualTo("2026-10-01");
        call(admin, get("/api/reports/daily?from=2026-10-07&to=2026-10-01"), null)
                .andExpect(jsonPath("$.message").value("'to' date must be on or after 'from' date"));
    }

    @Test
    void dailySummaryOnceAndReadState() throws Exception {
        Person p = person("Notes TwentyThree");
        ok(p.token(), get("/api/notifications/unread-count"), null);
        ok(p.token(), get("/api/notifications"), null);
        long summaries = 0;
        for (JsonNode n : ok(p.token(), get("/api/notifications"), null)) if ("DAILY_DIGEST".equals(n.get("type").asText())) summaries++;
        assertThat(summaries).isEqualTo(1);
        long first = ok(p.token(), get("/api/notifications?limit=1"), null).at("/0/id").asLong();
        Person other = person("Other TwentyFour");
        call(other.token(), post("/api/notifications/" + first + "/read"), null).andExpect(status().isNotFound());
        ok(p.token(), post("/api/notifications/read-all"), null);
        assertThat(ok(p.token(), get("/api/notifications/unread-count"), null).get("count").asLong()).isZero();
    }

    @Test
    void overdueReminderOncePerTask() throws Exception {
        Person p = person("Late TwentyFive");
        String pastDue = java.time.Instant.now().minusSeconds(3600).toString();
        ok(admin, post("/api/tasks"), map("title", "Late labour sheet " + p.id(), "assigneeId", p.id(), "dueAt", pastDue));
        assertThat(scheduler.sendReminders()).isGreaterThanOrEqualTo(1);
        assertThat(lastNote(p.token()).get("message").asText()).startsWith("Overdue: \"Late labour sheet");
        int again = scheduler.sendReminders();
        assertThat(lastNote(p.token()).get("message").asText()).startsWith("Overdue: \"Late labour sheet");
        assertThat(again).isGreaterThanOrEqualTo(0);
        long overdueNotes = 0;
        for (JsonNode n : ok(p.token(), get("/api/notifications"), null)) if ("OVERDUE".equals(n.get("type").asText())) overdueNotes++;
        assertThat(overdueNotes).isEqualTo(1);
    }
}
