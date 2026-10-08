package com.nsamarslan.plan;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final String EXTRA_FROM_ALARM = "fromAlarm";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlanNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Background music and spoken cues start without an extra tap.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        showOverLockScreen(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        showOverLockScreen(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-arm alarms and focus state whenever the app comes to the front.
        new Thread(() -> Scheduler.run(this)).start();
    }

    /** A block's full-screen notification opens the "Şimdi" screen over the lock screen. */
    @SuppressWarnings("deprecation")
    private void showOverLockScreen(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_FROM_ALARM, false)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
    }
}
