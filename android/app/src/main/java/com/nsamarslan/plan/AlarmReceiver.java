package com.nsamarslan.plan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fired by the single exact alarm, and after boot / app update / clock changes. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PendingResult pr = goAsync();
        new Thread(() -> {
            try {
                Scheduler.run(context);
            } finally {
                pr.finish();
            }
        }).start();
    }
}
