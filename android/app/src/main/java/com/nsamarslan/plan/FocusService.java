package com.nsamarslan.plan;

import android.app.Notification;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.telecom.TelecomManager;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Runs while a focus window locks apps. Watches the foreground app through
 * usage events and covers anything not allowed with a full-screen "focus"
 * card. Phone calls, WhatsApp calls, the launcher and this app stay usable.
 */
public class FocusService extends Service {
    private static final int NOTIF_ID = 4242;
    private static final long POLL_MS = 600;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager wm;
    private View overlay;
    private TextView overlayLabel;
    private TextView overlayUntil;
    private String fgPkg;
    private String fgCls;
    private long lastQuery;
    private String shownLabel = "";
    private Set<String> homePkgs = new HashSet<>();

    static void start(Context c) {
        try {
            ContextCompat.startForegroundService(c, new Intent(c, FocusService.class));
        } catch (RuntimeException e) {
            // Background start not allowed right now; the next alarm or app resume retries.
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        List<ResolveInfo> homes = getPackageManager().queryIntentActivities(home, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo ri : homes) homePkgs.add(ri.activityInfo.packageName);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        FocusController.Focus f = FocusController.current(this, System.currentTimeMillis());
        Notification n = buildNotification(f);
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIF_ID, n);
            }
        } catch (RuntimeException e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        handler.removeCallbacks(loop);
        handler.post(loop);
        return START_STICKY;
    }

    private Notification buildNotification(FocusController.Focus f) {
        Notifier.ensureChannels(this);
        String label = f == null ? "Odak modu" : f.label;
        String until = f == null ? "" : new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(f.end));
        shownLabel = label;
        return new NotificationCompat.Builder(this, Notifier.CH_FOCUS)
            .setSmallIcon(R.drawable.ic_stat_plan)
            .setContentTitle("Odak: " + label)
            .setContentText(until.isEmpty() ? "Diğer uygulamalar kilitli" : until + "'e kadar diğer uygulamalar kilitli")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(Notifier.openApp(this, NOTIF_ID))
            .build();
    }

    private final Runnable loop = new Runnable() {
        @Override
        public void run() {
            long now = System.currentTimeMillis();
            FocusController.Focus f = FocusController.current(FocusService.this, now);
            if (f == null || !f.lock) {
                hideOverlay();
                stopSelf();
                return;
            }
            // Nothing can be opened while the screen is off: check rarely.
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            if (!pm.isInteractive()) {
                hideOverlay();
                handler.postDelayed(this, 3_000);
                return;
            }
            if (!f.label.equals(shownLabel)) {
                ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIF_ID, buildNotification(f));
            }
            updateForeground(now);
            if (isAllowed(f)) hideOverlay();
            else showOverlay(f);
            handler.postDelayed(this, POLL_MS);
        }
    };

    private void updateForeground(long now) {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
        // First look back far: the user may have been in an app long before the lock began.
        long from = lastQuery == 0 ? now - 24 * 60 * 60_000L : lastQuery - 2_000;
        UsageEvents events = usm.queryEvents(from, now);
        UsageEvents.Event e = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            if (e.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED) {
                fgPkg = e.getPackageName();
                fgCls = e.getClassName();
            }
        }
        lastQuery = now;
    }

    private boolean inCall() {
        AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
        int m = am.getMode();
        return m == AudioManager.MODE_IN_CALL || m == AudioManager.MODE_IN_COMMUNICATION || m == AudioManager.MODE_RINGTONE;
    }

    private boolean isAllowed(FocusController.Focus f) {
        String pkg = fgPkg;
        if (pkg == null) return true;
        if (pkg.equals(getPackageName()) || homePkgs.contains(pkg) || f.allowed.contains(pkg)) return true;
        // Any ringing or ongoing call (phone, WhatsApp, …) gets through.
        if (inCall()) return true;
        String p = pkg.toLowerCase(Locale.ROOT);
        String cls = fgCls == null ? "" : fgCls.toLowerCase(Locale.ROOT);
        try {
            TelecomManager tm = (TelecomManager) getSystemService(TELECOM_SERVICE);
            if (pkg.equals(tm.getDefaultDialerPackage())) return true;
        } catch (RuntimeException ignored) {
        }
        if (p.equals("android") || p.equals("com.android.systemui") || p.contains("incallui") || p.contains("telecom")
            || p.contains("dialer") || p.contains("permissioncontroller") || p.contains("packageinstaller")
            || p.contains("emergency") || p.contains("deskclock") || p.contains("clockpackage")) {
            return true;
        }
        if (p.equals("com.whatsapp") || p.equals("com.whatsapp.w4b")) {
            return cls.contains("voip") || cls.contains("call");
        }
        return false;
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private void showOverlay(FocusController.Focus f) {
        String until = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(f.end));
        if (overlay != null) {
            overlayLabel.setText(f.label);
            overlayUntil.setText(until + "'e kadar bu uygulama kapalı.");
            return;
        }
        if (!Permissions.overlay(this)) return;
        int accent;
        try {
            accent = Color.parseColor(f.color);
        } catch (IllegalArgumentException e) {
            accent = Color.parseColor("#6366f1");
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0b0f14"));
        Bitmap art = Notifier.art(this, f.art);
        if (art != null) {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(art);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            iv.setAlpha(0.55f);
            root.addView(iv, new FrameLayout.LayoutParams(-1, -1));
        }
        View shade = new View(this);
        shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] {Color.argb(80, 8, 11, 15), Color.argb(245, 8, 11, 15)}));
        root.addView(shade, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        col.setPadding(dp(28), 0, dp(28), dp(64));

        TextView kicker = new TextView(this);
        kicker.setText("ODAK ZAMANI");
        kicker.setTextColor(accent);
        kicker.setLetterSpacing(0.15f);
        kicker.setTypeface(Typeface.DEFAULT_BOLD);
        kicker.setTextSize(14);
        col.addView(kicker);

        overlayLabel = new TextView(this);
        overlayLabel.setText(f.label);
        overlayLabel.setTextColor(Color.WHITE);
        overlayLabel.setTypeface(Typeface.DEFAULT_BOLD);
        overlayLabel.setTextSize(42);
        overlayLabel.setGravity(Gravity.CENTER);
        overlayLabel.setPadding(0, dp(8), 0, dp(8));
        col.addView(overlayLabel);

        overlayUntil = new TextView(this);
        overlayUntil.setText(until + "'e kadar bu uygulama kapalı.");
        overlayUntil.setTextColor(Color.parseColor("#a9b6c2"));
        overlayUntil.setTextSize(17);
        overlayUntil.setGravity(Gravity.CENTER);
        col.addView(overlayUntil);

        Button back = new Button(this);
        back.setText("Plana dön");
        back.setAllCaps(false);
        back.setTextSize(19);
        back.setTypeface(Typeface.DEFAULT_BOLD);
        back.setTextColor(Color.parseColor("#0b0f14"));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(accent);
        bg.setCornerRadius(dp(20));
        back.setBackground(bg);
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(-1, dp(64));
        blp.topMargin = dp(28);
        back.setOnClickListener(v -> {
            Intent i = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            startActivity(i);
            hideOverlay();
        });
        col.addView(back, blp);

        TextView hint = new TextView(this);
        hint.setText("Aramalar gelmeye devam eder. Acil durumda Plan → Ayarlar → kilidi aç.");
        hint.setTextColor(Color.parseColor("#74828f"));
        hint.setTextSize(13);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(0, dp(16), 0, 0);
        col.addView(hint);

        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM);
        root.addView(col, clp);

        @SuppressWarnings("deprecation")
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        try {
            wm.addView(root, lp);
            overlay = root;
        } catch (RuntimeException e) {
            overlay = null;
        }
    }

    private void hideOverlay() {
        if (overlay == null) return;
        try {
            wm.removeView(overlay);
        } catch (RuntimeException ignored) {
        }
        overlay = null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(loop);
        hideOverlay();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
