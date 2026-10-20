import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { t } from '../i18n';
import { CuePlayer } from './cues';
import {
  cuesBetween,
  elapsedMs,
  finish as finishClock,
  idleClock,
  pause as pauseClock,
  resume as resumeClock,
  snapshot,
  start as startClock,
  type Clock,
  type TimerPlan,
  type TimerSnapshot,
} from './engine';
import { useWakeLock } from './wakeLock';

const TICK_MS = 200;
/** Cues older than this when the page wakes up are state, not sound: do not replay them. */
const STALE_CUE_MS = 1500;

export interface TimerApi {
  snap: TimerSnapshot;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  sound: boolean;
  voice: boolean;
  toggleSound: () => void;
  toggleVoice: () => void;
  keepAwake: 'on' | 'unavailable';
}

/** Runs a plan against the real clock. All timing lives in the engine; this only schedules reads. */
export function useTimer(plan: TimerPlan): TimerApi {
  const [clock, setClock] = useState<Clock>(idleClock);
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const [voice, setVoice] = useState(false);
  const player = useRef<CuePlayer | null>(null);
  const lastMs = useRef(0);
  player.current ??= new CuePlayer();

  const snap = useMemo(() => snapshot(plan, clock, now), [plan, clock, now]);
  const active = snap.status === 'running';
  const keepAwake = useWakeLock(active);

  useEffect(() => {
    if (!active) return;
    const read = () => setNow(Date.now());
    const id = setInterval(read, TICK_MS);
    // A backgrounded or locked app catches up from the clock the moment it is active again.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && read());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [active]);

  useEffect(() => {
    if (clock.startedAt === null) return;
    const to = elapsedMs(clock, now);
    const from = lastMs.current;
    lastMs.current = Math.max(from, to);
    for (const cue of cuesBetween(plan, from, to)) {
      if (to - cue.atMs > STALE_CUE_MS) continue;
      const seg = plan.segments[cue.segmentIndex];
      const spoken =
        cue.type === 'segment_start' ? seg && (seg.label || t(`timer.phase.${seg.kind}`)) : cue.type === 'halfway' ? t('timer.halfway') : cue.type === 'finish' ? t('timer.done') : undefined;
      player.current?.play(cue, spoken);
    }
  }, [plan, clock, now]);

  useEffect(() => {
    const p = player.current;
    return () => p?.dispose();
  }, []);

  useEffect(() => {
    if (player.current) {
      player.current.sound = sound;
      player.current.voice = voice;
    }
  }, [sound, voice]);

  const start = useCallback(() => {
    player.current?.unlock();
    lastMs.current = 0;
    const at = Date.now();
    setNow(at);
    setClock(startClock(idleClock(), at));
  }, []);
  const pause = useCallback(() => setClock((c) => pauseClock(c, Date.now())), []);
  const resume = useCallback(() => {
    player.current?.unlock();
    setClock((c) => resumeClock(c, Date.now()));
  }, []);
  const stop = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setClock((c) => finishClock(c, at));
  }, []);

  return {
    snap,
    start,
    pause,
    resume,
    stop,
    sound,
    voice,
    toggleSound: () => setSound((v) => !v),
    toggleVoice: () => setVoice((v) => !v),
    keepAwake,
  };
}
