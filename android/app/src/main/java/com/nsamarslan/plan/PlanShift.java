package com.nsamarslan.plan;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The plan arithmetic behind "+10 dk" on a notification, on the stored JSON
 * (events, focus windows, slots). Mirrors snoozeItem / extendItem in
 * schedule.ts; no Android types, so it is tested against the app's model on
 * the JVM (scripts/shift-parity).
 */
final class PlanShift {
    static final int SNOOZE_MIN = 10;
    private static final long MIN = 60_000L;
    /** A running block "touches" the next one if it ends this close to its start. */
    private static final long ADJACENT_MS = 2 * MIN;

    private static final class Slot {
        final JSONObject o;
        final String key;
        final String day;
        final long start;
        final long end;
        final boolean open;
        final boolean active;
        final boolean notify;

        Slot(JSONObject o) {
            this.o = o;
            key = o.optString("itemKey");
            int bar = key.indexOf('|');
            day = bar < 0 ? key : key.substring(0, bar);
            start = o.optLong("start");
            end = o.optLong("end");
            open = o.optBoolean("open");
            active = o.optBoolean("active");
            notify = o.optBoolean("notify", true);
        }
    }

    private PlanShift() {}

    /** Before a block starts: it moves to 10 minutes from now (or from its start,
     *  if later). If the block right before it is still running, that one gets
     *  the time instead. Changes the arrays in place; false if the block is unknown. */
    static boolean snooze(JSONArray events, JSONArray windows, JSONArray slotArr, String key, long tapAt) throws JSONException {
        List<Slot> slots = slots(slotArr);
        Slot t = find(slots, key);
        if (t == null) return false;
        long newStart = ceilMin(Math.max(t.start, tapAt)) + SNOOZE_MIN * MIN;
        Slot running = null;
        for (Slot s : slots) {
            if (s != t && s.active && s.day.equals(t.day) && Math.abs(s.end - t.start) <= ADJACENT_MS && s.start <= tapAt) {
                running = s;
                break;
            }
        }
        Map<String, long[]> shift = new HashMap<>();
        if (running != null) {
            shift.put(running.key, new long[] {0, newStart - running.end});
            cascade(slots, running, running.start, newStart, shift);
        } else {
            long d = newStart - t.start;
            shift.put(t.key, new long[] {d, d});
            cascade(slots, t, Math.min(newStart, t.start), newStart + (t.end - t.start), shift);
        }
        apply(events, windows, slots, shift, null);
        return true;
    }

    /** At the end of a block: 10 more minutes (from now, if it already ended). */
    static boolean extend(JSONArray events, JSONArray windows, JSONArray slotArr, String key, long tapAt) throws JSONException {
        List<Slot> slots = slots(slotArr);
        Slot t = find(slots, key);
        if (t == null) return false;
        long newEnd = ceilMin(Math.max(t.end, tapAt)) + SNOOZE_MIN * MIN;
        Map<String, long[]> shift = new HashMap<>();
        shift.put(t.key, new long[] {0, newEnd - t.end});
        cascade(slots, t, t.start, newEnd, shift);
        apply(events, windows, slots, shift, t.key);
        return true;
    }

    /** Same rule as pushAfter() in schedule.ts: open blocks after `from` move just
     *  enough not to start before `prevEnd`, until a gap absorbs the shift. */
    private static void cascade(List<Slot> slots, Slot target, long from, long prevEnd, Map<String, long[]> shift) {
        List<Slot> after = new ArrayList<>();
        for (Slot s : slots) {
            if (s == target || !s.open || !s.day.equals(target.day)) continue;
            if (s.start > from || (s.start == from && (from != target.start || s.end >= target.end))) after.add(s);
        }
        Collections.sort(after, (a, b) -> Long.compare(a.start, b.start));
        for (Slot s : after) {
            if (s.start >= prevEnd) break;
            long d = prevEnd - s.start;
            shift.put(s.key, new long[] {d, d});
            prevEnd += s.end - s.start;
        }
    }

    private static void apply(JSONArray events, JSONArray windows, List<Slot> slots, Map<String, long[]> shift, String started)
        throws JSONException {
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            long[] d = e == null ? null : shift.get(e.optString("itemKey"));
            if (d == null) continue;
            e.put("at", e.optLong("at") + ("end".equals(e.optString("kind")) ? d[1] : d[0]));
        }
        for (int i = 0; i < windows.length(); i++) {
            JSONObject w = windows.optJSONObject(i);
            long[] d = w == null ? null : shift.get(w.optString("itemKey"));
            if (d == null) continue;
            w.put("start", w.optLong("start") + d[0]);
            w.put("end", w.optLong("end") + d[1]);
        }
        for (Slot s : slots) {
            long[] d = shift.get(s.key);
            if (d != null) {
                s.o.put("start", s.start + d[0]);
                s.o.put("end", s.end + d[1]);
            }
            // Asking for more time means it is being worked on.
            if (s.key.equals(started)) {
                s.o.put("open", false);
                s.o.put("active", true);
            }
        }
        // As in buildEvents: a block that now ends right where the next one starts
        // needs no end notice; the next block's "Şimdi" says it all.
        for (int i = events.length() - 1; i >= 0; i--) {
            JSONObject e = events.optJSONObject(i);
            if (e == null || !"end".equals(e.optString("kind")) || !shift.containsKey(e.optString("itemKey"))) continue;
            if (nextStartsRightAfter(slots, e.optString("itemKey"), e.optLong("at"))) events.remove(i);
        }
    }

    private static boolean nextStartsRightAfter(List<Slot> slots, String key, long end) {
        String day = key.substring(0, Math.max(0, key.indexOf('|')));
        JSONObject next = null;
        for (Slot s : slots) {
            long start = s.o.optLong("start");
            if (s.key.equals(key) || !s.day.equals(day) || !s.o.optBoolean("open") || start < end - MIN) continue;
            if (next == null || start < next.optLong("start")) next = s.o;
        }
        return next != null && next.optLong("start") - end <= ADJACENT_MS && next.optBoolean("notify", true);
    }

    private static List<Slot> slots(JSONArray a) {
        List<Slot> out = new ArrayList<>();
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            if (o != null) out.add(new Slot(o));
        }
        return out;
    }

    private static Slot find(List<Slot> slots, String key) {
        for (Slot s : slots) if (s.key.equals(key)) return s;
        return null;
    }

    private static long ceilMin(long t) {
        return ((t + MIN - 1) / MIN) * MIN;
    }
}
