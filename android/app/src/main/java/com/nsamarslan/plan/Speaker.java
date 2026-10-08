package com.nsamarslan.plan;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Text-to-speech for the spoken focus cues (Android WebView has no speechSynthesis). */
final class Speaker {
    interface Done {
        void run();
    }

    private TextToSpeech tts;
    private boolean ready;
    private final List<Runnable> pending = new ArrayList<>();
    private final Map<String, Done> callbacks = new HashMap<>();
    private int seq;

    Speaker(Context c) {
        tts = new TextToSpeech(c.getApplicationContext(), status -> {
            synchronized (Speaker.this) {
                ready = status == TextToSpeech.SUCCESS;
                for (Runnable r : pending) r.run();
                pending.clear();
            }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String id) {}

            @Override
            public void onDone(String id) {
                finish(id);
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onError(String id) {
                finish(id);
            }

            @Override
            public void onStop(String id, boolean interrupted) {
                finish(id);
            }
        });
    }

    private synchronized void finish(String id) {
        Done d = callbacks.remove(id);
        if (d != null) d.run();
    }

    private synchronized void whenReady(Runnable r) {
        if (ready || tts == null) r.run();
        else pending.add(r);
    }

    void speak(String text, String lang, float rate, float pitch, float volume, String voiceName, Done done) {
        whenReady(() -> {
            if (!ready) {
                done.run();
                return;
            }
            Locale loc = Locale.forLanguageTag(lang);
            tts.setLanguage(loc);
            if (voiceName != null && !voiceName.isEmpty()) {
                Set<Voice> voices = tts.getVoices();
                if (voices != null) for (Voice v : voices) if (v.getName().equals(voiceName)) tts.setVoice(v);
            }
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume);
            String id = "u" + (++seq);
            synchronized (Speaker.this) {
                callbacks.put(id, done);
            }
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id) != TextToSpeech.SUCCESS) finish(id);
        });
    }

    void stop() {
        if (tts != null) tts.stop();
    }

    List<String[]> voices() {
        List<String[]> out = new ArrayList<>();
        if (!ready) return out;
        Set<Voice> vs = tts.getVoices();
        if (vs == null) return out;
        for (Voice v : vs) {
            if (v.isNetworkConnectionRequired()) continue;
            out.add(new String[] {v.getName(), v.getLocale().toLanguageTag()});
        }
        return out;
    }

    void shutdown() {
        if (tts != null) tts.shutdown();
        tts = null;
    }
}
