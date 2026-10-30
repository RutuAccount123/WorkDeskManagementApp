package com.decentdecor.workdesk;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.UUID;
import javax.imageio.ImageIO;
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

/**
 * The whole backend against a real PostgreSQL: security, the HTTP API and the PL/pgSQL rules together.
 * (The rules themselves are tested in detail by db-tests/tests.sql.)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiIntegrationTest {

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry r) {
        TestDatabase.register(r);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    String admin;

    @BeforeEach
    void signInAdmin() throws Exception {
        admin = login("admin@company.com", "Admin@123");
    }

    // ------------------------------------------------------------ helpers

    String login(String email, String password) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json("email", email, "password", password)))
                .andExpect(status().isOk()).andReturn();
        return read(r).get("token").asText();
    }

    MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder b) {
        return b.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    JsonNode read(MvcResult r) throws Exception {
        return mapper.readTree(r.getResponse().getContentAsString());
    }

    String json(Object... kv) throws Exception {
        var m = new java.util.LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return mapper.writeValueAsString(m);
    }

    /** A new employee with a unique email; returns [id, token]. */
    String[] newEmployee(String name) throws Exception {
        String email = name.toLowerCase().replace(' ', '.') + "." + UUID.randomUUID().toString().substring(0, 8) + "@company.com";
        JsonNode e = read(mvc.perform(as(admin, post("/api/employees"))
                        .content(json("fullName", name, "email", email, "password", "Start@1234", "role", "EMPLOYEE", "department", "Purchase")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andReturn());
        return new String[] {e.get("id").asText(), login(email, "Start@1234")};
    }

    // ------------------------------------------------------------ sign-in & security

    @Test
    void signInGivesTokenAndUser() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json("email", " ADMIN@company.com ", "password", "Admin@123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresInSeconds").value(43200))
                .andExpect(jsonPath("$.user.role").value("ADMIN"))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
    }

    @Test
    void wrongPasswordAndUnknownEmailGetTheSameAnswer() throws Exception {
        for (String email : new String[] {"admin@company.com", "nobody@company.com"}) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(json("email", email, "password", "Wrong@123")))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.status").value(401))
                    .andExpect(jsonPath("$.message").value("Invalid email or password"));
        }
    }

    @Test
    void profilePhotoCanBeChangedAndRemovedByItsOwner() throws Exception {
        String[] employee = newEmployee("Profile Photo");
        mvc.perform(as(employee[1], get("/api/profile/photo")))
                .andExpect(status().isNoContent());

        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB), "png", png);
        String encoded = Base64.getEncoder().encodeToString(png.toByteArray());
        mvc.perform(as(employee[1], put("/api/profile/photo").content(json("image", encoded))))
                .andExpect(status().isNoContent());

        MvcResult photo = mvc.perform(as(employee[1], get("/api/profile/photo")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"))
                .andReturn();
        assertThat(photo.getResponse().getContentAsByteArray()).startsWith((byte) 0xff, (byte) 0xd8);
        mvc.perform(as(admin, get("/api/profile/photo"))).andExpect(status().isNoContent());

        mvc.perform(as(employee[1], delete("/api/profile/photo")))
                .andExpect(status().isNoContent());
        mvc.perform(as(employee[1], get("/api/profile/photo")))
                .andExpect(status().isNoContent());
    }

    @Test
    void tooManyWrongPasswordsArePaused() throws Exception {
        String email = "guess-" + UUID.randomUUID() + "@company.com";
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json("email", email, "password", "x")))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(json("email", email, "password", "x")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("Too many sign-in attempts")));
    }

    @Test
    void everythingElseNeedsAValidToken() throws Exception {
        mvc.perform(get("/api/tasks")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").value("Not signed in"));
        mvc.perform(get("/api/tasks").header("Authorization", "Bearer not-a-token")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tasks").header("Authorization", "Bearer " + admin + "x")).andExpect(status().isUnauthorized());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
    }

    @Test
    void securityHeadersAreSet() throws Exception {
        mvc.perform(as(admin, get("/api/auth/me")))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Content-Security-Policy", org.hamcrest.Matchers.containsString("default-src 'none'")));
    }

    @Test
    void employeesCannotOpenAdminAreas() throws Exception {
        String emp = newEmployee("Kiran Rao")[1];
        mvc.perform(as(emp, get("/api/employees"))).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("You do not have permission to do this"));
        mvc.perform(as(emp, get("/api/reports/team"))).andExpect(status().isForbidden());
        mvc.perform(as(emp, post("/api/holidays")).content(json("date", "2030-01-01", "name", "X"))).andExpect(status().isForbidden());
        mvc.perform(as(emp, get("/api/people"))).andExpect(status().isOk());
        mvc.perform(as(emp, get("/api/holidays"))).andExpect(status().isOk());
    }

    @Test
    void teamDashboardSupportsTodayWeekAndMonthPeriods() throws Exception {
        for (String period : new String[] {"today", "week", "month"}) {
            mvc.perform(as(admin, get("/api/reports/team").param("period", period)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].range.total").isNumber())
                    .andExpect(jsonPath("$[0].rangeTasks").isArray());
        }
        mvc.perform(as(admin, get("/api/reports/team").param("period", "year")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deactivatedPersonIsSignedOutAtOnce() throws Exception {
        String[] e = newEmployee("Leaving Person");
        mvc.perform(as(e[1], get("/api/auth/me"))).andExpect(status().isOk());
        mvc.perform(as(admin, patch("/api/employees/" + e[0] + "/active?value=false"))).andExpect(status().isOk());
        mvc.perform(as(e[1], get("/api/auth/me"))).andExpect(status().isUnauthorized());
    }

    @Test
    void changingPasswordEndsOtherSignInsAndGivesANewToken() throws Exception {
        String[] e = newEmployee("Pass Changer");
        mvc.perform(as(e[1], post("/api/auth/change-password")).content(json("currentPassword", "nope", "newPassword", "Better@5678")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Current password is incorrect"));
        mvc.perform(as(e[1], post("/api/auth/change-password")).content(json("currentPassword", "Start@1234", "newPassword", "short")))
                .andExpect(status().isBadRequest());
        JsonNode r = read(mvc.perform(as(e[1], post("/api/auth/change-password"))
                        .content(json("currentPassword", "Start@1234", "newPassword", "Better@5678")))
                .andExpect(status().isOk()).andReturn());
        mvc.perform(as(e[1], get("/api/auth/me"))).andExpect(status().isUnauthorized());          // old token
        mvc.perform(as(r.get("token").asText(), get("/api/auth/me"))).andExpect(status().isOk()); // new token
    }

    @Test
    void passwordRulesOnNewEmployees() throws Exception {
        mvc.perform(as(admin, post("/api/employees"))
                        .content(json("fullName", "Weak", "email", "weak@company.com", "password", "password", "role", "EMPLOYEE")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password: use letters and at least one number"));
    }

    // ------------------------------------------------------------ the work itself

    @Test
    void taskFlowThroughTheApi() throws Exception {
        String[] worker = newEmployee("Worker One");
        JsonNode t = read(mvc.perform(as(admin, post("/api/tasks"))
                        .content(json("title", "Collect GST bills", "assigneeId", Long.parseLong(worker[0]), "priority", "HIGH", "dueAt", "2030-01-10T18:00")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("TODO"))
                .andExpect(jsonPath("$.reviewer.fullName").value("System Admin"))
                .andReturn());
        String id = t.get("id").asText();
        mvc.perform(as(worker[1], post("/api/tasks/" + id + "/status")).content(json("status", "COMPLETED")))
                .andExpect(status().isForbidden());
        mvc.perform(as(worker[1], post("/api/tasks/" + id + "/status")).content(json("status", "IN_PROGRESS"))).andExpect(status().isOk());
        mvc.perform(as(worker[1], post("/api/tasks/" + id + "/status")).content(json("status", "SUBMITTED")))
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
        mvc.perform(as(admin, post("/api/tasks/" + id + "/status")).content(json("status", "REOPENED")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Please add a comment explaining what needs to be redone"));
        mvc.perform(as(admin, post("/api/tasks/" + id + "/status")).content(json("status", "COMPLETED")))
                .andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(as(admin, get("/api/tasks/" + id + "/activity"))).andExpect(jsonPath("$.length()").value(4));
        mvc.perform(as(worker[1], get("/api/tasks?scope=assigned&status=COMPLETED")))
                .andExpect(jsonPath("$[0].id").value(Long.parseLong(id)));
    }

    @Test
    void outsidersSeeNotFoundAndBadInputIsExplained() throws Exception {
        String[] a = newEmployee("Owner Person");
        String[] b = newEmployee("Outsider Person");
        JsonNode t = read(mvc.perform(as(a[1], post("/api/tasks")).content(json("title", "Private work"))).andReturn());
        mvc.perform(as(b[1], get("/api/tasks/" + t.get("id").asText())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.message").value("Task not found"));
        mvc.perform(as(a[1], post("/api/tasks")).content(json("title", "  "))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("title: must not be blank"));
        mvc.perform(as(a[1], get("/api/tasks?status=NOPE"))).andExpect(status().isBadRequest());
        mvc.perform(as(a[1], get("/api/tasks/abc"))).andExpect(status().isBadRequest());
        mvc.perform(as(a[1], post("/api/tasks")).content("{not json")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid request: check the values you sent"));
        mvc.perform(as(a[1], delete("/api/tasks/" + t.get("id").asText()))).andExpect(status().isNoContent());
    }

    @Test
    void workflowStartsAndPassesOn() throws Exception {
        String[] s1 = newEmployee("Step One");
        String[] s2 = newEmployee("Step Two");
        String body = mapper.writeValueAsString(mapper.readTree("""
                {"name":"Bill approval","frequency":"ON_DEMAND","startTime":"09:00","endTime":"18:00",
                 "formFields":[{"label":"Vendor","type":"text","required":true}],
                 "steps":[{"title":"Check bill","assigneeId":%s,"hours":1,"checklist":["Match PO"]},
                          {"title":"Approve","assigneeId":%s,"hours":2}]}""".formatted(s1[0], s2[0])));
        JsonNode wf = read(mvc.perform(as(admin, post("/api/workflows")).content(body)).andExpect(status().isCreated()).andReturn());
        mvc.perform(as(admin, post("/api/workflows/" + wf.get("id").asText() + "/start-now")).content("{\"formData\":{}}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Please fill “Vendor”"));
        JsonNode run = read(mvc.perform(as(admin, post("/api/workflows/" + wf.get("id").asText() + "/start-now"))
                        .content("{\"formData\":{\"f1\":\"Asian Paints\"}}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.label").value("Asian Paints")).andReturn());
        String step1 = run.at("/steps/0/task/id").asText();
        mvc.perform(as(s1[1], post("/api/tasks/" + step1 + "/checklist")).content("{\"index\":0,\"done\":true}")).andExpect(status().isOk());
        mvc.perform(as(s1[1], post("/api/tasks/" + step1 + "/status")).content(json("status", "COMPLETED"))).andExpect(status().isOk());
        MvcResult currentRun = mvc.perform(as(s2[1], get("/api/workflows/runs/" + run.get("id").asText())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStep").value(2))
                .andExpect(jsonPath("$.steps[1].task.status").value("TODO"))
                .andReturn();
        JsonNode current = read(currentRun);
        assertThat(current.at("/steps/1/task/id").asText()).isEqualTo(step1);
        assertThat(current.at("/steps/0/task/id").isNull()).isTrue();
        mvc.perform(as(s2[1], post("/api/tasks/" + step1 + "/status")).content(json("status", "COMPLETED")))
                .andExpect(status().isOk());
        JsonNode finished = read(mvc.perform(as(admin, get("/api/workflows/runs/" + run.get("id").asText())))
                .andExpect(status().isOk()).andReturn());
        assertThat(finished.get("status").asText()).isEqualTo("DONE");
        assertThat(finished.at("/steps/0/task/status").asText()).isEqualTo("COMPLETED");
        assertThat(finished.at("/steps/1/task/status").asText()).isEqualTo("COMPLETED");

        JsonNode nextRun = read(mvc.perform(as(admin, post("/api/workflows/" + wf.get("id").asText() + "/start-now"))
                        .content("{\"formData\":{\"f1\":\"Another vendor\"}}"))
                .andExpect(status().isCreated()).andReturn());
        assertThat(nextRun.at("/steps/0/task/id").asText()).isNotEqualTo(step1);
        JsonNode previousRun = read(mvc.perform(as(admin, get("/api/workflows/runs/" + run.get("id").asText())))
                .andExpect(status().isOk()).andReturn());
        assertThat(previousRun.at("/formData/f1").asText()).isEqualTo("Asian Paints");
        JsonNode allTasks = read(mvc.perform(as(admin, get("/api/tasks?scope=all")))
                .andExpect(status().isOk()).andReturn());
        int runTaskCount = 0;
        for (JsonNode task : allTasks) {
            if (task.at("/workflow/runId").asLong() == run.get("id").asLong()) runTaskCount++;
        }
        assertThat(runTaskCount).isEqualTo(1);
    }

    @Test
    void csvDownloadIsSafeForExcel() throws Exception {
        String[] e = newEmployee("Plain Name");
        mvc.perform(as(admin, put("/api/employees/" + e[0]))
                        .content(json("fullName", "=HYPERLINK(\"http://evil\")", "email", "evil." + UUID.randomUUID() + "@company.com", "role", "EMPLOYEE")))
                .andExpect(status().isOk());
        MvcResult r = mvc.perform(as(admin, get("/api/reports/employees.csv?from=2000-01-01&to=2001-01-01")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment")))
                .andReturn();
        String csv = r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).contains("Employee,Department,Assigned");
        assertThat(csv).contains("\"'=HYPERLINK(\"\"http://evil\"\")\"");
        assertThat(csv).doesNotContain("\n=HYPERLINK");
    }

    @Test
    void unknownAddressesGiveJsonErrors() throws Exception {
        mvc.perform(as(admin, get("/api/nothing-here"))).andExpect(status().isNotFound()).andExpect(jsonPath("$.status").value(404));
    }
}
