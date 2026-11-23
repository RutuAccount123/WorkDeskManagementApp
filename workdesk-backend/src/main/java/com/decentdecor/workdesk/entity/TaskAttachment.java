package com.decentdecor.workdesk.entity;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Table: task_attachment. Proof of work (a photo or file) attached when a task is marked done
 * or submitted for review. Deleted together with the task (ON DELETE CASCADE).
 */
@Entity
@Table(name = "task_attachment")
public class TaskAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id")
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by_id")
    private Employee uploadedBy;

    @Column(name = "file_name", nullable = false, length = 200)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Basic(fetch = FetchType.LAZY)
    @Column(name = "data", nullable = false)
    private byte[] data;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public Employee getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(Employee uploadedBy) { this.uploadedBy = uploadedBy; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public int getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(int sizeBytes) { this.sizeBytes = sizeBytes; }
    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
