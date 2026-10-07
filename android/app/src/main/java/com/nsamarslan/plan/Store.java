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
        Set<String> s = new HashSet<>(prefs(c).getStringSet(ACKED, new HashSet<>()));
        s.add(itemKey);
        // Keep the set small: drop keys from past days (keys start with YYYY-MM-DD).
        String today = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date());
        Set<String> keep = new HashSet<>();
        for (String k : s) if (k.compareTo(today) >= 0) keep.add(k);
        prefs(c).edit().putStringSet(ACKED, keep).apply();
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
