package com.decentdecor.workdesk.entity.json;

/**
 * One "How" item of the active FMS stage, stored inside task.checklist (jsonb).
 * doneAt is an ISO date-time text (e.g. 2026-10-28T06:30:00Z) or null.
 */
public record ChecklistItem(String text, boolean done, String doneAt) {

    public static ChecklistItem notDone(String text) {
        return new ChecklistItem(text, false, null);
    }
}
