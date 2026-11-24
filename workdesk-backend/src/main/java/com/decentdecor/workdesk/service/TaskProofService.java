package com.decentdecor.workdesk.service;

import com.decentdecor.workdesk.dto.task.AttachmentResponse;
import com.decentdecor.workdesk.dto.task.AttachmentUpload;
import com.decentdecor.workdesk.dto.task.StatusRequest;
import com.decentdecor.workdesk.dto.task.TaskResponse;
import com.decentdecor.workdesk.entity.Employee;
import com.decentdecor.workdesk.entity.Task;
import com.decentdecor.workdesk.entity.TaskAttachment;
import com.decentdecor.workdesk.entity.enums.ActivityAction;
import com.decentdecor.workdesk.entity.enums.TaskStatus;
import com.decentdecor.workdesk.exception.BadRequestException;
import com.decentdecor.workdesk.exception.ForbiddenException;
import com.decentdecor.workdesk.exception.NotFoundException;
import com.decentdecor.workdesk.repository.TaskAttachmentRepository;
import com.decentdecor.workdesk.security.CurrentUser;
import com.decentdecor.workdesk.service.support.ActivityLogger;
import com.decentdecor.workdesk.service.support.People;
import com.decentdecor.workdesk.util.OfficeTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Proof of work: photos or files attached when a task is marked done or submitted for review,
 * so the reviewer / assigner can check the work. Anyone who can open the task can see them.
 */
@Service
public class TaskProofService {
    static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    static final int MAX_FILES_PER_TASK = 20;

    /** Allowed file types by extension → content type stored. */
    private static final Map<String, String> TYPES = Map.ofEntries(
            Map.entry("jpg", "image/jpeg"), Map.entry("jpeg", "image/jpeg"), Map.entry("png", "image/png"),
            Map.entry("gif", "image/gif"), Map.entry("webp", "image/webp"), Map.entry("heic", "image/heic"),
            Map.entry("pdf", "application/pdf"), Map.entry("txt", "text/plain"), Map.entry("csv", "text/csv"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("zip", "application/zip"));

    private final TaskService taskService;
    private final TaskAttachmentRepository attachments;
    private final People people;
    private final ActivityLogger activity;
    private final OfficeTime time;

    public TaskProofService(TaskService taskService, TaskAttachmentRepository attachments, People people,
                            ActivityLogger activity, OfficeTime time) {
        this.taskService = taskService;
        this.attachments = attachments;
        this.people = people;
        this.activity = activity;
        this.time = time;
    }

    /** POST /api/tasks/{id}/status — saves any proof files, then moves the task (all or nothing). */
    @Transactional
    public TaskResponse changeStatus(CurrentUser user, Long id, StatusRequest req) {
        List<AttachmentUpload> files = req.attachments() == null ? List.of() : req.attachments();
        if (!files.isEmpty()) attach(user, id, req.status(), files);
        return taskService.changeStatus(user, id, req.status(), req.comment());
    }

    private void attach(CurrentUser user, Long id, String toValue, List<AttachmentUpload> files) {
        Employee me = people.me(user);
        Task t = taskService.visibleTask(id, me, true);
        String to = toValue == null ? "" : toValue.trim().toUpperCase(Locale.ROOT);
        if (!to.equals(TaskStatus.COMPLETED.name()) && !to.equals(TaskStatus.SUBMITTED.name())) {
            throw new BadRequestException("Attach proof only when marking the task done or submitting it");
        }
        if (!t.getAssignee().getId().equals(me.getId()) && !me.canManage(t.getAssignee())) {
            throw new ForbiddenException("Only the person doing this task can attach proof of work");
        }
        if (attachments.countByTaskId(t.getId()) + files.size() > MAX_FILES_PER_TASK) {
            throw new BadRequestException("A task can have up to " + MAX_FILES_PER_TASK + " proof files");
        }
        for (AttachmentUpload f : files) {
            TaskAttachment a = new TaskAttachment();
            String name = f.fileName().trim().replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
            a.setTask(t);
            a.setUploadedBy(me);
            a.setFileName(name);
            a.setContentType(typeOf(name));
            a.setData(decode(f.data(), name));
            a.setSizeBytes(a.getData().length);
            a.setCreatedAt(time.now());
            attachments.save(a);
        }
        activity.note(t, me, ActivityAction.COMMENTED, "Attached proof of work: "
                + files.stream().map(f -> f.fileName().trim()).collect(Collectors.joining(", ")));
    }

    private static String typeOf(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        String type = TYPES.get(ext);
        if (type == null) {
            throw new BadRequestException("\"" + name + "\" is not a supported file. Attach a photo, PDF, Word, Excel, PowerPoint, text or ZIP file");
        }
        return type;
    }

    private static byte[] decode(String data, String name) {
        if (data.length() > MAX_FILE_BYTES * 4L / 3L + 8) throw tooBig(name);
        final byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(data.trim());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Could not read \"" + name + "\"");
        }
        if (bytes.length == 0) throw new BadRequestException("\"" + name + "\" is empty");
        if (bytes.length > MAX_FILE_BYTES) throw tooBig(name);
        return bytes;
    }

    private static BadRequestException tooBig(String name) {
        return new BadRequestException("\"" + name + "\" is larger than 5 MB");
    }

    /** GET /api/tasks/{id}/attachments — the list, without file contents. */
    @Transactional(readOnly = true)
    public List<AttachmentResponse> list(CurrentUser user, Long id) {
        Task t = taskService.visibleTask(id, people.me(user), false);
        return attachments.listForTask(t.getId()).stream()
                .map(i -> new AttachmentResponse(i.id(), i.fileName(), i.contentType(), i.sizeBytes(),
                        i.uploadedByName(), i.createdAt(), null))
                .toList();
    }

    /** GET /api/tasks/{id}/attachments/{attachmentId} — one file with its contents. */
    @Transactional(readOnly = true)
    public AttachmentResponse get(CurrentUser user, Long id, Long attachmentId) {
        Task t = taskService.visibleTask(id, people.me(user), false);
        TaskAttachment a = attachments.findByIdAndTaskId(attachmentId, t.getId())
                .orElseThrow(() -> NotFoundException.of("Attachment"));
        return new AttachmentResponse(a.getId(), a.getFileName(), a.getContentType(), a.getSizeBytes(),
                a.getUploadedBy().getFullName(), a.getCreatedAt(), Base64.getEncoder().encodeToString(a.getData()));
    }
}
