package com.nsamarslan.plan;

import android.Manifest;
import android.app.AlarmManager;
import android.app.AppOpsManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;

/** Status of every special permission the app needs, and the settings screen for each. */
final class Permissions {
    private Permissions() {}

    static boolean notifications(Context c) {
        if (Build.VERSION.SDK_INT >= 33
            && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    static boolean exactAlarm(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms();
    }

    static boolean dnd(Context c) {
        return ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).isNotificationPolicyAccessGranted();
    }

    @SuppressWarnings("deprecation")
    static boolean usage(Context c) {
        AppOpsManager ops = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
            : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    static boolean overlay(Context c) {
        return Settings.canDrawOverlays(c);
    }

    static boolean battery(Context c) {
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        return pm.isIgnoringBatteryOptimizations(c.getPackageName());
    }

    static boolean canLock(Context c) {
        return usage(c) && overlay(c);
    }

    static JSObject all(Context c) {
        JSObject o = new JSObject();
        o.put("notifications", notifications(c));
        o.put("exactAlarm", exactAlarm(c));
        o.put("fullScreen", Notifier.canFullScreen(c));
        o.put("dnd", dnd(c));
        o.put("usage", usage(c));
        o.put("overlay", overlay(c));
        o.put("battery", battery(c));
        return o;
    }

    /** Settings screen where the user can grant `name`; null when it needs a runtime prompt. */
    static Intent settingsIntent(Context c, String name) {
        Uri pkg = Uri.parse("package:" + c.getPackageName());
        switch (name) {
            case "notifications":
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName())
                    : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg);
            case "exactAlarm":
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg) : null;
            case "fullScreen":
                return Build.VERSION.SDK_INT >= 34 ? new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) : null;
            case "dnd":
                return new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            case "usage":
                return new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            case "overlay":
                return new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg);
            case "battery":
                return new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg);
            default:
                return null;
        }
    }
}
