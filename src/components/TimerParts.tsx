import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { t } from '../i18n';
import { Button, Chip, IconButton, T, color, font } from '../ui';

const TONES = { work: color.brand, rest: color.blue, ready: color.muted } as const;

/** The big countdown: a progress ring, the time, the phase and a sub line. */
export function TimerDisplay({ time, phase, sub, progress, tone, final, paused }: { time: string; phase: string; sub?: string; progress: number; tone: 'work' | 'rest' | 'ready'; final?: boolean; paused?: boolean }) {
  const size = 300;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tint = final ? color.danger : TONES[tone];
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size, alignSelf: 'center' }} accessible accessibilityLabel={`${phase}, ${time}`} accessibilityLiveRegion="polite">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <T variant="eyebrow" style={{ color: tint, textTransform: 'uppercase', opacity: paused ? 0.5 : 1 }}>
        {phase}
      </T>
      <T style={{ fontFamily: font.displayBold, fontSize: 72, lineHeight: 80, letterSpacing: -2, opacity: paused ? 0.5 : 1 }}>{time}</T>
      {sub ? (
        <T variant="label" tone="muted">
          {sub}
        </T>
      ) : null}
    </View>
  );
}

export function RoundCounter({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.counter} accessibilityRole="adjustable" accessibilityLabel={t('timer.rounds')} accessibilityValue={{ text: String(count) }}>
      <IconButton icon="minus" label={t('common.moveDown')} onPress={() => onChange(Math.max(0, count - 1))} />
      <View style={{ alignItems: 'center', minWidth: 96 }}>
        <T variant="title">{count}</T>
        <T variant="caption" tone="muted">
          {t('timer.rounds')}
        </T>
      </View>
      <IconButton icon="plus" label={t('common.add')} onPress={() => onChange(count + 1)} />
    </View>
  );
}

/** A number with minus and plus, for small whole-number inputs. */
export function Stepper({ label, value, min = 0, max = 999, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (n: number) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <T variant="label" tone="muted">
        {label}
      </T>
      <View style={styles.counter}>
        <IconButton icon="minus" label={`${label} -`} onPress={() => onChange(Math.max(min, value - 1))} />
        <T variant="title" style={{ minWidth: 72, textAlign: 'center' }}>
          {value}
        </T>
        <IconButton icon="plus" label={`${label} +`} onPress={() => onChange(Math.min(max, value + 1))} />
      </View>
    </View>
  );
}

interface ControlsProps {
  state: 'ready' | 'running' | 'paused' | 'finished';
  sound: boolean;
  voice: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSound: () => void;
  onVoice: () => void;
}

export function TimerControls({ state, sound, voice, onStart, onPause, onResume, onStop, onSound, onVoice }: ControlsProps) {
  return (
    <View style={{ gap: 12 }}>
      {state === 'ready' ? (
        <Button icon="play" onPress={onStart}>
          {t('timer.start')}
        </Button>
      ) : state === 'running' ? (
        <View style={{ gap: 8 }}>
          <Button icon="pause" onPress={onPause}>
            {t('timer.pause')}
          </Button>
          <Button size="md" variant="secondary" onPress={onStop}>
            {t('timer.stop')}
          </Button>
        </View>
      ) : state === 'paused' ? (
        <View style={{ gap: 8 }}>
          <Button icon="play" onPress={onResume}>
            {t('timer.resume')}
          </Button>
          <Button size="md" variant="secondary" onPress={onStop}>
            {t('timer.stop')}
          </Button>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        <Chip label={t('timer.sound')} selected={sound} onPress={onSound} />
        <Chip label={t('timer.voice')} selected={voice} onPress={onVoice} />
      </View>
    </View>
  );
}

/** Rest between sets: the remaining time, nudge buttons and skip. */
export function RestTimer({ remaining, total, next, onAdd, onSub, onSkip }: { remaining: number; total: number; next?: string; onAdd: () => void; onSub: () => void; onSkip: () => void }) {
  const mm = Math.floor(remaining / 60);
  const ss = String(Math.max(0, Math.ceil(remaining) % 60)).padStart(2, '0');
  return (
    <View style={{ gap: 24, alignItems: 'center' }}>
      <TimerDisplay time={`${mm}:${ss}`} phase={t('timer.rest.title')} progress={total ? 1 - remaining / total : 0} tone="rest" sub={next ? t('timer.rest.next', { name: next }) : undefined} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={onSub} accessibilityRole="button" style={styles.nudge}>
          <T variant="button">{t('timer.rest.sub')}</T>
        </Pressable>
        <Pressable onPress={onAdd} accessibilityRole="button" style={styles.nudge}>
          <T variant="button">{t('timer.rest.add')}</T>
        </Pressable>
      </View>
      <Button size="md" variant="secondary" fullWidth={false} onPress={onSkip}>
        {t('timer.rest.skip')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  nudge: { height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: color.surfaceControl, justifyContent: 'center' },
});
