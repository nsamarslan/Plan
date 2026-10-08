package com.nsamarslan.plan;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Bridge between the web app and Android: schedule, permissions, focus mode, TTS. */
@CapacitorPlugin(
    name = "PlanNative",
    permissions = {@Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")})
public class PlanNativePlugin extends Plugin {
    private Speaker speaker;

    @Override
    public void load() {
        Notifier.ensureChannels(getContext());
        speaker = new Speaker(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (speaker != null) speaker.shutdown();
    }

    @PluginMethod
    public void setSchedule(PluginCall call) {
        JSArray events = call.getArray("events", new JSArray());
        JSArray windows = call.getArray("windows", new JSArray());
        Store.setSchedule(getContext(), events, windows);
        new Thread(() -> {
            Scheduler.run(getContext());
            call.resolve();
        }).start();
    }

    @PluginMethod
    public void consumeActions(PluginCall call) {
        JSONArray a = Store.takeActions(getContext());
        JSObject r = new JSObject();
        try {
            r.put("actions", new JSArray(a.toString()));
        } catch (JSONException e) {
            r.put("actions", new JSArray());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void getPermissions(PluginCall call) {
        call.resolve(Permissions.all(getContext()));
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String name = call.getString("name", "");
        if ("notifications".equals(name) && Build.VERSION.SDK_INT >= 33
            && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsResult");
            return;
        }
        Intent i = Permissions.settingsIntent(getContext(), name);
        if (i == null) {
            call.resolve();
            return;
        }
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (RuntimeException e) {
            // Some OEMs lack the exact screen; fall back to the app's details page.
            Intent d = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                android.net.Uri.parse("package:" + getContext().getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(d);
        }
        call.resolve();
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void getFocusState(PluginCall call) {
        long now = System.currentTimeMillis();
        FocusController.Focus f = FocusController.current(getContext(), now);
        JSObject r = new JSObject();
        r.put("active", f != null);
        r.put("silence", f != null && f.silence);
        r.put("lock", f != null && f.lock);
        if (f != null) {
            r.put("label", f.label);
            r.put("endsAt", f.end);
        }
        long sup = Store.suppressUntil(getContext());
        if (sup > now) r.put("suppressedUntil", sup);
        call.resolve(r);
    }

    @PluginMethod
    public void unlockFocus(PluginCall call) {
        FocusController.unlock(getContext());
        Scheduler.run(getContext());
        call.resolve();
    }

    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent main = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> list = pm.queryIntentActivities(main, 0);
        Set<String> seen = new HashSet<>();
        JSArray apps = new JSArray();
        for (ResolveInfo ri : list) {
            String pkg = ri.activityInfo.packageName;
            if (pkg.equals(getContext().getPackageName()) || !seen.add(pkg)) continue;
            JSObject o = new JSObject();
            o.put("packageName", pkg);
            o.put("label", ri.loadLabel(pm).toString());
            apps.put(o);
        }
        JSObject r = new JSObject();
        r.put("apps", apps);
        call.resolve(r);
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        String lang = call.getString("lang", "en-US");
        float rate = call.getFloat("rate", 1f);
        float pitch = call.getFloat("pitch", 1f);
        float volume = call.getFloat("volume", 1f);
        String voice = call.getString("voice", "");
        speaker.speak(text, lang, rate, pitch, volume, voice, call::resolve);
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        speaker.stop();
        call.resolve();
    }

    @PluginMethod
    public void listVoices(PluginCall call) {
        JSArray arr = new JSArray();
        for (String[] v : speaker.voices()) {
            JSObject o = new JSObject();
            o.put("name", v[0]);
            o.put("lang", v[1]);
            arr.put(o);
        }
        JSObject r = new JSObject();
        r.put("voices", arr);
        call.resolve(r);
    }
}
