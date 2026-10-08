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
        // The app consumes button taps before every push, so this plan is the truth:
        // blocks it still lists as waiting to start lose an old "Başladım/Atla" mark,
        // and blocks it still lists at all (e.g. a stale "Atla" it rejected) are not closed.
        Set<String> pending = new HashSet<>();
        Set<String> alive = new HashSet<>();
        for (int i = 0; i < events.length(); i++) {
            org.json.JSONObject e = events.optJSONObject(i);
            if (e == null) continue;
            String kind = e.optString("kind");
            alive.add(e.optString("itemKey"));
            if ("pre".equals(kind) || "start".equals(kind) || "remind".equals(kind)) pending.add(e.optString("itemKey"));
        }
        for (int i = 0; i < windows.length(); i++) {
            org.json.JSONObject w = windows.optJSONObject(i);
            if (w != null && w.has("itemKey")) alive.add(w.optString("itemKey"));
        }
        Store.reopen(getContext(), pending, alive);
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
        // Permanently denied: Android shows no prompt any more, so open the settings page.
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            Intent i = Permissions.settingsIntent(getContext(), "notifications");
            if (i != null) {
                try {
                    getContext().startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (RuntimeException ignored) {
                }
            }
        }
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

    /** Backup export: WebView can't download a blob, so write the file natively. */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name", "plan-yedek.json");
        String text = call.getString("text", "");
        byte[] bytes = text.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try {
            JSObject r = new JSObject();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                android.content.ContentResolver cr = getContext().getContentResolver();
                android.content.ContentValues v = new android.content.ContentValues();
                v.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/json");
                v.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                android.net.Uri uri = cr.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new java.io.IOException("MediaStore insert failed");
                try (java.io.OutputStream os = cr.openOutputStream(uri)) {
                    if (os == null) throw new java.io.IOException("no output stream");
                    os.write(bytes);
                }
                v.clear();
                v.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
                cr.update(uri, v, null, null);
                r.put("path", "İndirilenler/" + name);
            } else {
                java.io.File dir = getContext().getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) throw new java.io.IOException("no storage");
                java.io.File f = new java.io.File(dir, name);
                try (java.io.FileOutputStream os = new java.io.FileOutputStream(f)) {
                    os.write(bytes);
                }
                r.put("path", f.getAbsolutePath());
            }
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Kaydedilemedi: " + e.getMessage());
        }
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
