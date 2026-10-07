package com.nsamarslan.plan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-arms alarms and focus mode after reboot, app update or a clock/time-zone change. */
public class BootReceiver extends BroadcastReceiver {
    private static final java.util.Set<String> ACTIONS = new java.util.HashSet<>(java.util.Arrays.asList(
        Intent.ACTION_BOOT_COMPLETED,
        Intent.ACTION_MY_PACKAGE_REPLACED,
        Intent.ACTION_TIME_CHANGED,
        Intent.ACTION_TIMEZONE_CHANGED,
        "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"));

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTIONS.contains(intent.getAction())) return;
        Scheduler.run(context);
    }
}
