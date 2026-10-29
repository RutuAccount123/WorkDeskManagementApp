package com.decentdecor.workdesk.security;

/** The signed-in person for this request. */
public record CurrentUser(long id, String role) {
    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
