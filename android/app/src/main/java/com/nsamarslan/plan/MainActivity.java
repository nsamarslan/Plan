package com.nsamarslan.plan;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final String EXTRA_FROM_ALARM = "fromAlarm";
    static final String EXTRA_TAB = "openTab";
    /** A tab a notification asked for, until the page picks it up (takeLaunchTab). */
    static volatile String pendingTab;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlanNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Background music and spoken cues start without an extra tap.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        showOverLockScreen(getIntent());
        openTab(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        showOverLockScreen(intent);
        openTab(intent);
    }

    /** Cold start: the page asks for the tab once it loads. Warm start: tell it now. */
    private void openTab(Intent intent) {
        String tab = intent == null ? null : intent.getStringExtra(EXTRA_TAB);
        if (tab == null) return;
        // Not again when the activity is recreated with the same intent.
        intent.removeExtra(EXTRA_TAB);
        pendingTab = tab;
        if (getBridge() != null) getBridge().triggerWindowJSEvent("planOpenTab");
    }

    @Override
    public void onPause() {
        super.onPause();
        // Shown over the lock screen for an alarm only; don't stay that way.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(false);
            setTurnScreenOn(false);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-arm alarms and focus state whenever the app comes to the front.
        new Thread(() -> Scheduler.run(this)).start();
    }

    /**
     * A block's notification opens the "Şimdi" screen, over the lock screen.
     * Any other launch puts the normal lock-screen behaviour back.
     */
    @SuppressWarnings("deprecation")
    private void showOverLockScreen(Intent intent) {
        boolean fromAlarm = intent != null && intent.getBooleanExtra(EXTRA_FROM_ALARM, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(fromAlarm);
            setTurnScreenOn(fromAlarm);
        } else if (fromAlarm) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        } else {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        // Warm start: the page may be on another tab. (Cold start opens on "Şimdi" anyway.)
        if (fromAlarm && getBridge() != null) getBridge().triggerWindowJSEvent("planOpenNow");
    }
}
