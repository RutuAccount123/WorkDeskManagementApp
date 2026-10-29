package com.decentdecor.workdesk.service.support;

import static com.decentdecor.workdesk.TestData.person;
import static com.decentdecor.workdesk.TestData.task;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import org.junit.jupiter.api.Test;

/** Who may move a task where (same rules as the screens). */
class TaskRulesTest {
    final Employee admin = person(1, "System Admin", Role.ADMIN);
    final Employee priya = person(2, "Priya Sharma", Role.EMPLOYEE);
    final Employee rahul = person(3, "Rahul Patil", Role.EMPLOYEE);
    final Employee sneha = person(4, "Sneha Kulkarni", Role.EMPLOYEE);

    @Test
    void assigneeStartsAndSubmitsButCannotApprove() {
        Task t = task(10, priya, rahul, sneha, TaskStatus.TODO);
        assertTrue(TaskRules.canMove(t, priya, TaskStatus.IN_PROGRESS));
        assertFalse(TaskRules.canMove(t, priya, TaskStatus.COMPLETED));
        t.setStatus(TaskStatus.IN_PROGRESS);
        assertTrue(TaskRules.canMove(t, priya, TaskStatus.SUBMITTED));
        t.setStatus(TaskStatus.SUBMITTED);
        assertFalse(TaskRules.canMove(t, priya, TaskStatus.COMPLETED));
    }

    @Test
    void reviewerApprovesOrSendsBack_assignerCannotApprove() {
        Task t = task(10, priya, rahul, sneha, TaskStatus.SUBMITTED);
        assertTrue(TaskRules.canMove(t, sneha, TaskStatus.COMPLETED));
        assertTrue(TaskRules.canMove(t, sneha, TaskStatus.REOPENED));
        assertFalse(TaskRules.canMove(t, rahul, TaskStatus.COMPLETED));
        assertTrue(TaskRules.canMove(t, rahul, TaskStatus.CANCELLED));
    }

    @Test
    void ownWorkWithoutReviewerCanBeClosedByThePerson() {
        Task t = task(10, priya, priya, null, TaskStatus.TODO);
        assertTrue(TaskRules.canMove(t, priya, TaskStatus.COMPLETED));
        t.setStatus(TaskStatus.COMPLETED);
        assertTrue(TaskRules.canMove(t, priya, TaskStatus.IN_PROGRESS));
    }

    @Test
    void fmsStepsNeverHaveAReviewer() {
        Task t = task(10, priya, admin, sneha, TaskStatus.IN_PROGRESS);
        t.setWorkflowRun(new WorkflowRun());
        assertTrue(TaskRules.canMove(t, priya, TaskStatus.COMPLETED));   // no review for steps
        assertFalse(t.involves(sneha.getId()));
    }

    @Test
    void adminCanDoAnythingAllowedAndSeeEverything() {
        Task t = task(10, priya, rahul, sneha, TaskStatus.IN_PROGRESS);
        assertTrue(TaskRules.canMove(t, admin, TaskStatus.COMPLETED));
        assertFalse(TaskRules.canMove(t, admin, TaskStatus.REOPENED));   // not from IN_PROGRESS
        assertTrue(TaskRules.canSee(t, admin));
    }

    @Test
    void onlyInvolvedPeopleSeeATask() {
        Employee amit = person(5, "Amit Deshmukh", Role.EMPLOYEE);
        Task t = task(10, priya, rahul, sneha, TaskStatus.TODO);
        assertTrue(TaskRules.canSee(t, priya));
        assertTrue(TaskRules.canSee(t, rahul));
        assertTrue(TaskRules.canSee(t, sneha));
        assertFalse(TaskRules.canSee(t, amit));
        assertTrue(TaskRules.canEdit(t, rahul));
        assertFalse(TaskRules.canEdit(t, priya));
    }
}
