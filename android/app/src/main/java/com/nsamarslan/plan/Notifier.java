package com.nsamarslan.plan;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/** Builds the block notifications: picture, first step and one-tap buttons. */
final class Notifier {
    static final String CH_FOCUS = "focus_service";
    private static final String CH_BLOCKS = "blocks_v1";
    private static final String CH_BLOCKS_DND = "blocks_dnd_v1";
    private static final String CH_CUES = "cues_v1";
    /** pre/start/remind of one block share an id so they replace each other. */
    private static final long STALE_MS = 2 * 60_000;

    private Notifier() {}

    static int idFor(String itemKey, String kind) {
        String group = ("pre".equals(kind) || "start".equals(kind) || "remind".equals(kind)) ? "start" : kind;
        return (itemKey + "|" + group).hashCode();
    }

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        AudioAttributes aa = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        long[] vib = {0, 300, 150, 300, 150, 500};

        boolean dnd = nm.isNotificationPolicyAccessGranted();
        String id = dnd ? CH_BLOCKS_DND : CH_BLOCKS;
        if (nm.getNotificationChannel(id) == null) {
            NotificationChannel ch = new NotificationChannel(id, "Blok başlangıçları", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Blok başlarken, başlamadıysan tekrar ve bitişte");
            ch.enableVibration(true);
            ch.setVibrationPattern(vib);
            ch.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), aa);
            ch.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            // Only honoured when the app has Do Not Disturb access at creation time,
            // hence the separate channel id once access is granted.
            if (dnd) ch.setBypassDnd(true);
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CH_CUES) == null) {
            NotificationChannel ch = new NotificationChannel(CH_CUES, "Mola ve dönüş", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Pomodoro molası, yürüyüşte dönüş zamanı");
            ch.enableVibration(true);
            if (dnd) ch.setBypassDnd(true);
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CH_FOCUS) == null) {
            NotificationChannel ch = new NotificationChannel(CH_FOCUS, "Odak modu", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Odak modu açıkken görünen kalıcı bildirim");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }

    private static String blocksChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return CH_BLOCKS;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm.getNotificationChannel(CH_BLOCKS_DND) != null ? CH_BLOCKS_DND : CH_BLOCKS;
    }

    static PendingIntent openApp(Context c, int req) {
        Intent i = new Intent(c, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(MainActivity.EXTRA_FROM_ALARM, true);
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent action(Context c, String type, String itemKey) {
        Intent i = new Intent(c, ActionReceiver.class)
            .setAction(ActionReceiver.ACTION)
            .putExtra(ActionReceiver.EXTRA_TYPE, type)
            .putExtra(ActionReceiver.EXTRA_ITEM, itemKey);
        return PendingIntent.getBroadcast(c, (itemKey + type).hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static Bitmap art(Context c, String key) {
        int res = c.getResources().getIdentifier("art_" + key, "drawable", c.getPackageName());
        return res == 0 ? null : BitmapFactory.decodeResource(c.getResources(), res);
    }

    static void post(Context c, JSONObject e, long now) {
        String kind = e.optString("kind");
        String key = e.optString("itemKey");
        long at = e.optLong("at");
        boolean beforeStart = "pre".equals(kind) || "start".equals(kind) || "remind".equals(kind);
        if (beforeStart && Store.isAcked(c, key)) return;
        if (!"start".equals(kind) && now - at > STALE_MS) return;

        ensureChannels(c);
        boolean loud = beforeStart && !"pre".equals(kind);
        String channel = ("cue".equals(kind) || "pre".equals(kind)) ? CH_CUES : blocksChannel(c);
        int color;
        try {
            color = Color.parseColor(e.optString("color", "#3b82f6"));
        } catch (IllegalArgumentException ex) {
            color = Color.parseColor("#3b82f6");
        }
        int id = idFor(key, kind);
        Bitmap pic = art(c, e.optString("art"));

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, channel)
            .setSmallIcon(R.drawable.ic_stat_plan)
            .setContentTitle(e.optString("title"))
            .setContentText(e.optString("body"))
            .setColor(color)
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .setWhen(at)
            .setShowWhen(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(loud ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_DEFAULT)
            // Alarm category passes our focus-mode policy, which allows alarms.
            .setCategory(loud ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(openApp(c, id));
        if (pic != null) {
            b.setLargeIcon(pic);
            b.setStyle(new NotificationCompat.BigPictureStyle().bigPicture(pic).bigLargeIcon((Bitmap) null).setSummaryText(e.optString("body")));
        } else {
            b.setStyle(new NotificationCompat.BigTextStyle().bigText(e.optString("body")));
        }
        if (beforeStart) {
            b.addAction(0, "Başladım", action(c, "start", key));
            b.addAction(0, "Atla", action(c, "skip", key));
        } else if ("end".equals(kind)) {
            b.addAction(0, "Tamamladım", action(c, "done", key));
        }
        if ("start".equals(kind) && e.optBoolean("fullScreen") && canFullScreen(c)) {
            b.setFullScreenIntent(openApp(c, id + 1), true);
        }
        try {
            NotificationManagerCompat.from(c).notify(id, b.build());
        } catch (SecurityException ignored) {
            // notification permission not granted
        }
    }

    static boolean canFullScreen(Context c) {
        if (Build.VERSION.SDK_INT < 34) return true;
        return c.getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }
}
