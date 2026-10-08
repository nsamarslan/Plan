package com.nsamarslan.plan;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** Small persistent state shared by the plugin, alarms and the focus service. */
final class Store {
    private static final String PREFS = "plan_native";
    private static final String EVENTS = "events";
    private static final String WINDOWS = "windows";
    private static final String ACKED = "acked";
    private static final String CLOSED = "closed";
    private static final String ACTIONS = "actions";
    private static final String SUPPRESS_UNTIL = "suppress_until";
    private static final String ZEN_RULE = "zen_rule_id";
    private static final String PREV_FILTER = "prev_filter";

    private Store() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONArray events(Context c) {
        return array(prefs(c).getString(EVENTS, "[]"));
    }

    static JSONArray windows(Context c) {
        return array(prefs(c).getString(WINDOWS, "[]"));
    }

    static void setSchedule(Context c, JSONArray events, JSONArray windows) {
        prefs(c).edit().putString(EVENTS, events.toString()).putString(WINDOWS, windows.toString()).apply();
    }

    private static JSONArray array(String s) {
        try {
            return new JSONArray(s);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Items the user has already started / skipped from a notification. */
    static boolean isAcked(Context c, String itemKey) {
        return prefs(c).getStringSet(ACKED, new HashSet<>()).contains(itemKey);
    }

    static void ack(Context c, String itemKey) {
        addTo(c, ACKED, itemKey);
    }

    /** Skipped / finished from a notification: nothing more for this block. */
    static boolean isClosed(Context c, String itemKey) {
        return prefs(c).getStringSet(CLOSED, new HashSet<>()).contains(itemKey);
    }

    static void close(Context c, String itemKey) {
        addTo(c, CLOSED, itemKey);
    }

    /**
     * The app sent a fresh plan in which these blocks are still waiting to start
     * (it has seen every button tap by then), so earlier taps no longer apply —
     * e.g. after "Durumu sıfırla" or moving the block.
     */
    static void reopen(Context c, Set<String> pendingKeys) {
        if (pendingKeys.isEmpty()) return;
        SharedPreferences p = prefs(c);
        Set<String> acked = new HashSet<>(p.getStringSet(ACKED, new HashSet<>()));
        Set<String> closed = new HashSet<>(p.getStringSet(CLOSED, new HashSet<>()));
        if (acked.removeAll(pendingKeys) | closed.removeAll(pendingKeys)) {
            p.edit().putStringSet(ACKED, acked).putStringSet(CLOSED, closed).apply();
        }
    }

    private static void addTo(Context c, String name, String itemKey) {
        Set<String> s = new HashSet<>(prefs(c).getStringSet(name, new HashSet<>()));
        s.add(itemKey);
        // Keep the set small: drop keys from past days (keys start with YYYY-MM-DD).
        String yesterday = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            .format(new java.util.Date(System.currentTimeMillis() - 86_400_000L));
        Set<String> keep = new HashSet<>();
        for (String k : s) if (k.compareTo(yesterday) >= 0) keep.add(k);
        prefs(c).edit().putStringSet(name, keep).apply();
    }

    /** Actions taken from notification buttons, consumed by the web app on resume. */
    static synchronized void pushAction(Context c, String type, String itemKey) {
        JSONArray a = array(prefs(c).getString(ACTIONS, "[]"));
        try {
            JSONObject o = new JSONObject();
            o.put("type", type);
            if (itemKey != null) o.put("itemKey", itemKey);
            o.put("at", System.currentTimeMillis());
            a.put(o);
        } catch (JSONException ignored) {
        }
        prefs(c).edit().putString(ACTIONS, a.toString()).apply();
    }

    static synchronized JSONArray takeActions(Context c) {
        JSONArray a = array(prefs(c).getString(ACTIONS, "[]"));
        prefs(c).edit().putString(ACTIONS, "[]").apply();
        return a;
    }

    static long suppressUntil(Context c) {
        return prefs(c).getLong(SUPPRESS_UNTIL, 0);
    }

    static void setSuppressUntil(Context c, long t) {
        prefs(c).edit().putLong(SUPPRESS_UNTIL, t).apply();
    }

    static String zenRuleId(Context c) {
        return prefs(c).getString(ZEN_RULE, null);
    }

    static void setZenRuleId(Context c, String id) {
        prefs(c).edit().putString(ZEN_RULE, id).apply();
    }

    static int prevFilter(Context c) {
        return prefs(c).getInt(PREV_FILTER, -1);
    }

    static void setPrevFilter(Context c, int f) {
        prefs(c).edit().putInt(PREV_FILTER, f).apply();
    }
}
