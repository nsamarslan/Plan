package com.nsamarslan.plan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/** "Başladım" / "Atla" / "Tamamladım" buttons on notifications. */
public class ActionReceiver extends BroadcastReceiver {
    static final String ACTION = "com.nsamarslan.plan.ACTION";
    static final String EXTRA_TYPE = "type";
    static final String EXTRA_ITEM = "itemKey";

    @Override
    public void onReceive(Context c, Intent intent) {
        String type = intent.getStringExtra(EXTRA_TYPE);
        String key = intent.getStringExtra(EXTRA_ITEM);
        if (type == null || key == null) return;
        Store.pushAction(c, type, key);
        Store.ack(c, key);
        NotificationManagerCompat.from(c).cancel(Notifier.idFor(key, "start"));
        NotificationManagerCompat.from(c).cancel(Notifier.idFor(key, "end"));
        if (!"start".equals(type)) dropWindows(c, key);
        Scheduler.run(c);
    }

    /** A skipped or finished block should not keep the phone locked. */
    private static void dropWindows(Context c, String key) {
        JSONArray in = Store.windows(c);
        JSONArray out = new JSONArray();
        for (int i = 0; i < in.length(); i++) {
            JSONObject w = in.optJSONObject(i);
            if (w != null && !key.equals(w.optString("itemKey"))) out.put(w);
        }
        Store.setSchedule(c, Store.events(c), out);
    }
}
