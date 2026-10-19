import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { msAt } from '../lib/time';
import { DEFAULT_TYPES, defaultSettings, defaultTemplate } from './legacy.fixture';
import { buildEvents, buildFocusWindows, buildSlots, type PlanInput } from './notify';
import { emptyDay, extendItem, resolveDay, snoozeItem, startItem } from './schedule';
import type { DayDoc } from './types';

// The phone shifts its stored plan by itself when "+10 dk" is tapped on a
// notification (PlanShift.java); the app later redoes it with the real model.
// Both must land on the same times. Runs where a JDK and org.json are around.

const ROOT = resolve(__dirname, '../..');
const JAVA_SRC = join(ROOT, 'android/app/src/main/java/com/nsamarslan/plan/PlanShift.java');

function findOrgJson(): string | null {
  const base = join(homedir(), '.gradle/caches/modules-2/files-2.1/org.json/json');
  if (!existsSync(base)) return null;
  for (const v of readdirSync(base)) {
    for (const h of readdirSync(join(base, v))) {
      const jar = readdirSync(join(base, v, h)).find((f) => /^json-[\d.]+\.jar$/.test(f));
      if (jar) return join(base, v, h, jar);
    }
  }
  return null;
}

function hasJdk(): boolean {
  try {
    execFileSync('javac', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const JAR = findOrgJson();
const READY = !!JAR && hasJdk();

const MAIN = `package com.nsamarslan.plan;
import org.json.*;
import java.nio.file.*;
public class ParityMain {
  public static void main(String[] a) throws Exception {
    JSONArray cases = new JSONArray(new String(Files.readAllBytes(Paths.get(a[0])), "UTF-8"));
    JSONArray out = new JSONArray();
    for (int i = 0; i < cases.length(); i++) {
      JSONObject c = cases.getJSONObject(i);
      JSONArray e = c.getJSONArray("events"), w = c.getJSONArray("windows"), s = c.getJSONArray("slots");
      boolean ok = "snooze".equals(c.getString("op"))
        ? PlanShift.snooze(e, w, s, c.getString("key"), c.getLong("tap"))
        : PlanShift.extend(e, w, s, c.getString("key"), c.getLong("tap"));
      out.put(new JSONObject().put("ok", ok).put("events", e).put("windows", w).put("slots", s));
    }
    System.out.print(out.toString());
  }
}
`;

const types = Object.fromEntries(DEFAULT_TYPES.map((t) => [t.id, t]));
const tpl = defaultTemplate();
const MON = '2026-10-05';
const at = (h: number, m = 0, s = 0) => msAt(MON, h * 60 + m) + s * 1000;
const input = (nowMs: number, doc: DayDoc): PlanInput => ({
  today: MON,
  nowMs,
  days: 2,
  template: tpl,
  types,
  dayDocs: { [MON]: doc },
  settings: defaultSettings(),
});
const started = (id: string, ms: number) => {
  const d = emptyDay(MON);
  return startItem(d, resolveDay(MON, tpl, types, d), id, ms);
};

interface Case {
  name: string;
  op: 'snooze' | 'extend';
  id: string;
  tap: number;
  doc: DayDoc;
}

const CASES: Case[] = [
  { name: 'snooze a late block, cascade stops at a gap', op: 'snooze', id: 't6', tap: at(11, 16, 30), doc: emptyDay(MON) },
  { name: 'snooze from the 5-minute warning', op: 'snooze', id: 't6', tap: at(11, 10, 5), doc: emptyDay(MON) },
  { name: 'snooze while the block before is running', op: 'snooze', id: 't3', tap: at(8, 0, 20), doc: started('t2', at(7, 45)) },
  { name: 'extend a running pomodoro block', op: 'extend', id: 't5', tap: at(11, 0, 30), doc: started('t5', at(9, 30)) },
  { name: 'extend a block never started, after its end', op: 'extend', id: 't6', tap: at(12, 50), doc: emptyDay(MON) },
  { name: 'extend mid-block', op: 'extend', id: 't8', tap: at(14, 0), doc: started('t8', at(13, 30)) },
];

describe.skipIf(!READY)('"+10 dk" on the phone matches the app', () => {
  it('lands on the same times for every case', () => {
    const dir = mkdtempSync(join(tmpdir(), 'plan-shift-'));
    copyFileSync(JAVA_SRC, join(dir, 'PlanShift.java'));
    writeFileSync(join(dir, 'ParityMain.java'), MAIN);
    execFileSync('javac', ['-cp', JAR!, '-d', join(dir, 'out'), join(dir, 'PlanShift.java'), join(dir, 'ParityMain.java')]);

    // What the phone has: the plan pushed earlier that day.
    const before = CASES.map((c) => {
      const inp = input(at(0), c.doc);
      return { op: c.op, key: `${MON}|${c.id}`, tap: c.tap, events: buildEvents(inp), windows: buildFocusWindows(inp), slots: buildSlots(inp) };
    });
    const file = join(dir, 'cases.json');
    writeFileSync(file, JSON.stringify(before));
    const sep = process.platform === 'win32' ? ';' : ':';
    const out = JSON.parse(
      execFileSync('java', ['-cp', `${join(dir, 'out')}${sep}${JAR}`, 'com.nsamarslan.plan.ParityMain', file], { encoding: 'utf8' }),
    ) as { ok: boolean; events: { id: string; at: number }[]; windows: { itemKey?: string; start: number; end: number }[]; slots: unknown[] }[];

    CASES.forEach((c, i) => {
      const items = resolveDay(MON, tpl, types, c.doc);
      const doc = c.op === 'snooze' ? snoozeItem(c.doc, items, c.id, c.tap) : extendItem(c.doc, items, c.id, c.tap);
      const inp = input(c.tap, doc);
      const js = { events: buildEvents(inp), windows: buildFocusWindows(inp), slots: buildSlots(inp) };
      const phone = out[i];
      expect(phone.ok, c.name).toBe(true);
      expect(phone.slots, c.name).toEqual(js.slots);
      // Every notification still ahead on the phone fires when the app would fire it.
      // (The app may add an end notice the phone can't know about; that's fine.)
      const jsAt = new Map(js.events.map((e) => [e.id, e.at]));
      for (const e of phone.events.filter((x) => x.at > c.tap - 30_000)) {
        expect(jsAt.get(e.id), `${c.name}: ${e.id}`).toBe(e.at);
      }
      const win = (w: { itemKey?: string; start: number; end: number }[]) =>
        w.filter((x) => x.end > c.tap).map((x) => `${x.itemKey ?? '-'} ${x.start} ${x.end}`).sort();
      expect(win(phone.windows), c.name).toEqual(win(js.windows));
    });
  });
});
