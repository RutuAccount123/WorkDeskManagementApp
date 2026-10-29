package com.decentdecor.workdesk.service.support;

import static com.decentdecor.workdesk.TestData.person;
import static com.decentdecor.workdesk.TestData.setId;
import static com.decentdecor.workdesk.TestData.task;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.enums.Role;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

class TaskGroupsTest {
    @Test
    void keepsCurrentStageOncePerRunAndLeavesOtherWorkAlone() {
        var employee = person(1, "Employee", Role.EMPLOYEE);
        WorkflowRun run = new WorkflowRun();
        setId(run, 10);

        Task completedFirstStage = task(1, employee, employee, null, TaskStatus.COMPLETED);
        completedFirstStage.setWorkflowRun(run);
        completedFirstStage.setWorkflowStep(1);
        Task currentStage = task(2, employee, employee, null, TaskStatus.IN_PROGRESS);
        currentStage.setWorkflowRun(run);
        currentStage.setWorkflowStep(2);
        Task standalone = task(3, employee, employee, null, TaskStatus.TODO);

        List<Task> result = TaskGroups.onePerWorkflowRun(List.of(completedFirstStage, currentStage, standalone));

        assertEquals(2, result.size());
        assertEquals(List.of(currentStage, standalone), result);
    }

    @Test
    void keepsTheFinalStageWhenEveryStageIsClosed() {
        var employee = person(1, "Employee", Role.EMPLOYEE);
        WorkflowRun run = new WorkflowRun();
        setId(run, 10);
        Task first = task(1, employee, employee, null, TaskStatus.COMPLETED);
        first.setWorkflowRun(run);
        first.setWorkflowStep(1);
        Task last = task(2, employee, employee, null, TaskStatus.COMPLETED);
        last.setWorkflowRun(run);
        last.setWorkflowStep(2);

        assertEquals(List.of(last), TaskGroups.onePerWorkflowRun(List.of(first, last)));
    }

    @Test
    void linkedWorkflowWithoutRunDoesNotReplaceTheTask() {
        var employee = person(1, "Employee", Role.EMPLOYEE);
        Task standalone = task(1, employee, employee, null, TaskStatus.TODO);
        Workflow workflow = new Workflow();
        setId(workflow, 20);
        standalone.setLinkedWorkflow(workflow);

        assertEquals(List.of(standalone), TaskGroups.onePerWorkflowRun(List.of(standalone)));
    }

    @Test
    void groupsTheSourceTaskWithItsActiveFmsRun() {
        var employee = person(1, "Employee", Role.EMPLOYEE);
        Task source = task(1, employee, employee, null, TaskStatus.TODO);
        WorkflowRun run = new WorkflowRun();
        setId(run, 10);
        run.setRunDate(java.time.LocalDate.of(2026, 10, 28));
        run.setNumber(1);
        run.setSourceTask(source);
        Task stage = task(2, employee, employee, null, TaskStatus.IN_PROGRESS);
        stage.setWorkflowRun(run);
        stage.setWorkflowStep(1);

        assertEquals(List.of(stage), TaskGroups.onePerWorkflowRun(List.of(source, stage)));
    }

    @Test
    void groupsSourceTaskWithNewestRunButKeepsOtherRunsDistinct() {
        var employee = person(1, "Employee", Role.EMPLOYEE);
        Task source = task(1, employee, employee, null, TaskStatus.TODO);
        WorkflowRun earlier = new WorkflowRun();
        setId(earlier, 10);
        earlier.setRunDate(java.time.LocalDate.of(2026, 10, 27));
        earlier.setNumber(1);
        earlier.setSourceTask(source);
        Task earlierStage = task(2, employee, employee, null, TaskStatus.COMPLETED);
        earlierStage.setWorkflowRun(earlier);
        earlierStage.setWorkflowStep(1);

        WorkflowRun latest = new WorkflowRun();
        setId(latest, 11);
        latest.setRunDate(java.time.LocalDate.of(2026, 10, 28));
        latest.setNumber(1);
        latest.setSourceTask(source);
        Task latestStage = task(3, employee, employee, null, TaskStatus.IN_PROGRESS);
        latestStage.setWorkflowRun(latest);
        latestStage.setWorkflowStep(1);

        assertEquals(List.of(earlierStage, latestStage),
                TaskGroups.onePerWorkflowRun(List.of(source, earlierStage, latestStage)));
    }
}
