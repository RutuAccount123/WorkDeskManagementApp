package com.decentdecor.workdesk.entity;

import com.decentdecor.workdesk.entity.enums.Role;
import jakarta.persistence.Column;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Table: employee. A person who can sign in: an admin or an employee.
 * The password is stored only as a BCrypt hash. tokenVersion goes up when the password changes,
 * the person is deactivated or the role changes, so old sign-ins stop working.
 */
@Entity
@Table(name = "employee")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_code", length = 40)
    private String employeeCode;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    /** Always saved in lower case. */
    @Column(name = "email", nullable = false, length = 160, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 10)
    private Role role;

    @Column(name = "department", length = 80)
    private String department;

    @Column(name = "department_admin", nullable = false)
    private boolean departmentAdmin;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "employee_department_access", joinColumns = @JoinColumn(name = "employee_id"))
    @Column(name = "department", nullable = false, length = 80)
    private Set<String> accessibleDepartments = new LinkedHashSet<>();

    @Column(name = "designation", length = 80)
    private String designation;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "token_version", nullable = false)
    private int tokenVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;


    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public boolean isDepartmentAdmin() {
        return isAdmin() && departmentAdmin;
    }

    public boolean isFullAdmin() {
        return isAdmin() && !departmentAdmin;
    }

    /**
     * Admin powers over this person's work: full admins over everyone,
     * department admins over people in the departments they were given.
     */
    public boolean canManage(Employee other) {
        if (isFullAdmin()) return true;
        return isDepartmentAdmin() && other != null && other.getDepartment() != null
                && accessibleDepartments.contains(other.getDepartment());
    }

    /** Ends every sign-in of this person (their tokens no longer match). */
    public void signOutEverywhere() {
        tokenVersion++;
    }

    // ------------------------------------------------------------ getters and setters

    public Long getId() {
        return id;
    }

    public String getEmployeeCode() {
        return employeeCode;
    }

    public void setEmployeeCode(String employeeCode) {
        this.employeeCode = employeeCode;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public boolean isDepartmentAdminAccess() {
        return departmentAdmin;
    }

    public void setDepartmentAdmin(boolean departmentAdmin) {
        this.departmentAdmin = departmentAdmin;
    }

    public Set<String> getAccessibleDepartments() {
        return accessibleDepartments;
    }

    public void setAccessibleDepartments(Set<String> accessibleDepartments) {
        this.accessibleDepartments = new LinkedHashSet<>(accessibleDepartments);
    }

    public String getDesignation() {
        return designation;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }

    public void setTokenVersion(int tokenVersion) {
        this.tokenVersion = tokenVersion;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

}
