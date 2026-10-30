package com.decentdecor.workdesk.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** The current user's normalized profile photo, stored separately from employee records. */
@Entity
@Table(name = "employee_profile_photo")
public class ProfilePhoto {
    @Id
    @Column(name = "employee_id")
    private Long employeeId;

    @Column(name = "image_data", nullable = false)
    private byte[] imageData;

    public Long getEmployeeId() {
        return employeeId;
    }

    public void setEmployeeId(Long employeeId) {
        this.employeeId = employeeId;
    }

    public byte[] getImageData() {
        return imageData;
    }

    public void setImageData(byte[] imageData) {
        this.imageData = imageData;
    }
}
