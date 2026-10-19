package com.nsamarslan.plan;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;

/**
 * "+10 dk" on a notification while the app is closed: shift the stored plan
 * (PlanShift) so the next notifications and focus windows come at the right
 * time. When the app opens it applies the same tap to the real plan and sends
 * a fresh schedule.
 */
final class Shifter {
    static final int SNOOZE_MIN = PlanShift.SNOOZE_MIN;

    private interface Op {
        boolean run(JSONArray events, JSONArray windows, JSONArray slots) throws JSONException;
    }

    private Shifter() {}

    static void snooze(Context c, String key, long tapAt) {
        update(c, (e, w, s) -> PlanShift.snooze(e, w, s, key, tapAt));
    }

    static void extend(Context c, String key, long tapAt) {
        update(c, (e, w, s) -> PlanShift.extend(e, w, s, key, tapAt));
    }

    private static synchronized void update(Context c, Op op) {
        JSONArray events = Store.events(c);
        JSONArray windows = Store.windows(c);
        JSONArray slots = Store.slots(c);
        try {
            if (!op.run(events, windows, slots)) return;
        } catch (JSONException e) {
            return; // leave the plan as it was; the app fixes it when opened
        }
        Store.setSchedule(c, events, windows);
        Store.setSlots(c, slots);
    }
}
