package com.nsamarslan.plan;

import android.app.AutomaticZenRule;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.notification.Condition;
import android.service.notification.ZenPolicy;

import androidx.annotation.RequiresApi;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/** Turns focus windows into Do Not Disturb + the app lock service. */
final class FocusController {
    private static final Uri CONDITION = Uri.parse("plan://focus");

    static final class Focus {
        String label = "";
        String color = "#6366f1";
        String art = "free";
        long end;
        boolean silence;
        boolean lock;
        final Set<String> allowed = new HashSet<>();
    }

    private FocusController() {}

    /** Merged state of every window covering `now`, or null. Honors the emergency unlock. */
    static Focus current(Context c, long now) {
        if (now < Store.suppressUntil(c)) return null;
        JSONArray ws = Store.windows(c);
        Focus f = null;
        boolean fromBlock = false;
        for (int i = 0; i < ws.length(); i++) {
            JSONObject w = ws.optJSONObject(i);
            if (w == null) continue;
            if (w.optLong("start") > now || w.optLong("end") <= now) continue;
            if (f == null) f = new Focus();
            boolean isBlock = w.has("itemKey");
            if (f.label.isEmpty() || (isBlock && !fromBlock)) {
                f.label = w.optString("label");
                f.color = w.optString("color", f.color);
                f.art = w.optString("art", f.art);
                fromBlock = isBlock;
            }
            f.end = Math.max(f.end, w.optLong("end"));
            f.silence |= w.optBoolean("silence");
            f.lock |= w.optBoolean("lock");
            JSONArray al = w.optJSONArray("allowed");
            if (al != null) for (int k = 0; k < al.length(); k++) f.allowed.add(al.optString(k));
        }
        return f;
    }

    static void apply(Context c, long now) {
        Focus f = current(c, now);
        setDnd(c, f != null && f.silence, f == null ? "" : f.label);
        if (f != null && f.lock && Permissions.canLock(c)) FocusService.start(c);
        else c.stopService(new Intent(c, FocusService.class));
    }

    /** Emergency exit: no focus until the current window ends. */
    static void unlock(Context c) {
        Focus f = current(c, System.currentTimeMillis());
        if (f == null) return;
        Store.setSuppressUntil(c, f.end);
        Store.pushAction(c, "unlock", null);
    }

    private static void setDnd(Context c, boolean on, String label) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (!nm.isNotificationPolicyAccessGranted()) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                String id = ensureRule(c, nm);
                nm.setAutomaticZenRuleState(id, new Condition(CONDITION, on ? "Odak: " + label : "", on ? Condition.STATE_TRUE : Condition.STATE_FALSE));
            } else {
                legacyDnd(c, nm, on);
            }
        } catch (RuntimeException e) {
            // A rule removed by the user from system settings: recreate next time.
            Store.setZenRuleId(c, null);
        }
    }

    /** Our own DND mode: calls from anyone (incl. WhatsApp calls) + alarms + media; messages silenced. */
    @RequiresApi(Build.VERSION_CODES.Q)
    private static String ensureRule(Context c, NotificationManager nm) {
        String id = Store.zenRuleId(c);
        if (id != null && nm.getAutomaticZenRule(id) != null) return id;
        ZenPolicy.Builder pb = new ZenPolicy.Builder()
            .allowCalls(ZenPolicy.PEOPLE_TYPE_ANYONE)
            .allowRepeatCallers(true)
            .allowAlarms(true)
            .allowMedia(true)
            .allowMessages(ZenPolicy.PEOPLE_TYPE_NONE)
            .allowEvents(false)
            .allowReminders(false)
            .allowSystem(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) pb.allowConversations(ZenPolicy.CONVERSATION_SENDERS_NONE);
        AutomaticZenRule rule = new AutomaticZenRule(
            "Plan odak modu",
            null,
            new ComponentName(c, MainActivity.class),
            CONDITION,
            pb.build(),
            NotificationManager.INTERRUPTION_FILTER_PRIORITY,
            true);
        id = nm.addAutomaticZenRule(rule);
        Store.setZenRuleId(c, id);
        return id;
    }

    @SuppressWarnings("deprecation")
    private static void legacyDnd(Context c, NotificationManager nm, boolean on) {
        if (on) {
            if (Store.prevFilter(c) < 0) Store.setPrevFilter(c, nm.getCurrentInterruptionFilter());
            nm.setNotificationPolicy(new NotificationManager.Policy(
                NotificationManager.Policy.PRIORITY_CATEGORY_CALLS | NotificationManager.Policy.PRIORITY_CATEGORY_REPEAT_CALLERS,
                NotificationManager.Policy.PRIORITY_SENDERS_ANY,
                NotificationManager.Policy.PRIORITY_SENDERS_ANY));
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
        } else if (Store.prevFilter(c) >= 0) {
            nm.setInterruptionFilter(Store.prevFilter(c));
            Store.setPrevFilter(c, -1);
        }
    }
}
