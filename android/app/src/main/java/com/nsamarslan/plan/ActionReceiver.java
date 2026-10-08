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
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        nm.cancel(Notifier.idFor(key, "start"));
        nm.cancel(Notifier.idFor(key, "end"));
        nm.cancel(Notifier.idFor(key, "cue"));
        if (!"start".equals(type)) {
            Store.close(c, key);
            dropItem(c, key);
        }
        Scheduler.run(c);
    }

    /** A skipped or finished block: no more cues, end notice or focus lock for it. */
    private static void dropItem(Context c, String key) {
        Store.setSchedule(c, without(Store.events(c), key), without(Store.windows(c), key));
    }

    private static JSONArray without(JSONArray in, String key) {
        JSONArray out = new JSONArray();
        for (int i = 0; i < in.length(); i++) {
            JSONObject o = in.optJSONObject(i);
            if (o != null && !key.equals(o.optString("itemKey"))) out.put(o);
        }
        return out;
    }
}
