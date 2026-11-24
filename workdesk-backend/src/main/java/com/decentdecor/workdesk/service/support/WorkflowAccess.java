package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Workflow;
import com.decentdecor.workdesk.entity.WorkflowRun;
import com.decentdecor.workdesk.entity.json.WorkflowStep;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.repository.TaskRepository;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Who can see / change an FMS.
 * See: admins (department admins: FMS of their departments, or set up by someone in them), its owner,
 * anyone with a step in it, and people on the task it is linked to.
 * Change (edit, pause, delete): those admins and its owner.
 */
@Component
public class WorkflowAccess {
    private final TaskRepository tasks;

    public WorkflowAccess(TaskRepository tasks) {
        this.tasks = tasks;
    }

    /** Admin powers over this FMS: full admins, or department admins for FMS of their departments. */
    public boolean manages(Workflow w, Employee me) {
        if (me.isFullAdmin()) return true;
        if (!me.isDepartmentAdmin() || w == null) return false;
        return (w.getDepartment() != null && me.getAccessibleDepartments().contains(w.getDepartment()))
                || me.canManage(w.getCreatedBy());
    }

    public boolean canSee(Workflow w, Employee me) {
        return manages(w, me)
                || w.getCreatedBy().getId().equals(me.getId())
                || hasStep(w.getSteps(), me)
                || (w.getSourceTask() != null && w.getSourceTask().involves(me.getId()))
                || tasks.isInvolvedInLinkedTask(w.getId(), me.getId());
    }

    public boolean canSee(WorkflowRun r, Employee me) {
        return manages(r.getWorkflow(), me) || me.canManage(r.getCreatedBy())
                || r.getCreatedBy().getId().equals(me.getId())
                || hasStep(r.getSteps(), me)
                || (r.getSourceTask() != null && r.getSourceTask().involves(me.getId()));
    }

    public void requireOwner(Workflow w, Employee me) {
        if (!manages(w, me) && !w.getCreatedBy().getId().equals(me.getId())) {
            throw new ForbiddenException("Only the person who set up this workflow (or an admin) can change it");
        }
    }

    private static boolean hasStep(List<WorkflowStep> steps, Employee me) {
        return steps.stream().anyMatch(s -> me.getId().equals(s.assigneeId()));
    }
}
