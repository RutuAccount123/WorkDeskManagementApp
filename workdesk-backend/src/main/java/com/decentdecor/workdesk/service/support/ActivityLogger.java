package com.decentdecor.workdesk.service.support;

import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.TaskActivity;
import com.decentdecor.workdesk.entity.enums.ActivityAction;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.repository.TaskActivityRepository;
import com.decentdecor.workdesk.util.OfficeTime;
import com.decentdecor.workdesk.util.Texts;
import org.springframework.stereotype.Component;

/** Writes a line to a task's history. actor null = the system. */
@Component
public class ActivityLogger {
    private final TaskActivityRepository activities;
    private final OfficeTime time;

    public ActivityLogger(TaskActivityRepository activities, OfficeTime time) {
        this.activities = activities;
        this.time = time;
    }

    public TaskActivity log(Task task, Employee actor, ActivityAction action, TaskStatus from, TaskStatus to, String comment) {
        TaskActivity a = new TaskActivity();
        a.setTask(task);
        a.setActor(actor);
        a.setAction(action);
        a.setFromStatus(from);
        a.setToStatus(to);
        a.setComment(Texts.trimToNull(comment));
        a.setCreatedAt(time.now());
        return activities.save(a);
    }

    public TaskActivity note(Task task, Employee actor, ActivityAction action, String comment) {
        return log(task, actor, action, null, null, comment);
    }
}
