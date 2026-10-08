package com.nsamarslan.plan;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * One exact alarm at a time: when it fires we post every notification that is
 * due, update focus mode, and arm the alarm for the next event or focus
 * boundary. This keeps us far below Android's per-app alarm limit and survives
 * the app being killed.
 */
final class Scheduler {
    static final String ACTION_TICK = "com.nsamarslan.plan.TICK";
    private static final String PREFS = "plan_scheduler";
    private static final String PROCESSED = "processed_until";
    /** Events this close in the future are posted now instead of arming a separate alarm. */
    private static final long EARLY_MS = 15_000;

    private Scheduler() {}

    static synchronized void run(Context c) {
        long now = System.currentTimeMillis();
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long processed = p.getLong(PROCESSED, now - 60_000);
        long until = now + EARLY_MS;

        JSONArray events = Store.events(c);
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            if (e == null) continue;
            long at = e.optLong("at");
            if (at > processed && at <= until) Notifier.post(c, e, now);
        }
        p.edit().putLong(PROCESSED, Math.max(processed, until)).apply();

        FocusController.apply(c, now);
        armNext(c, now, Math.max(processed, until));
    }

    private static void armNext(Context c, long now, long processedUntil) {
        long next = Long.MAX_VALUE;
        boolean important = false;
        JSONArray events = Store.events(c);
        for (int i = 0; i < events.length(); i++) {
            JSONObject e = events.optJSONObject(i);
            if (e == null) continue;
            long at = e.optLong("at");
            if (at > processedUntil && at < next) {
                next = at;
                important = "start".equals(e.optString("kind"));
            }
        }
        JSONArray windows = Store.windows(c);
        for (int i = 0; i < windows.length(); i++) {
            JSONObject w = windows.optJSONObject(i);
            if (w == null) continue;
            long s = w.optLong("start");
            long en = w.optLong("end");
            if (s > now && s <= next) {
                next = s;
                important = true;
            }
            if (en > now && en <= next) {
                next = en;
                important = true;
            }
        }
        long sup = Store.suppressUntil(c);
        if (sup > now && sup < next) next = sup;

        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = tickIntent(c);
        if (next == Long.MAX_VALUE) {
            am.cancel(pi);
            return;
        }
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        try {
            if (exact && important) {
                // Alarm-clock alarms are delivered on time even in deep Doze.
                PendingIntent show = PendingIntent.getActivity(
                    c, 1, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(next, show), pi);
            } else if (exact) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            }
        } catch (SecurityException se) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        }
    }

    private static PendingIntent tickIntent(Context c) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
