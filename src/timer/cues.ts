import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import type { Cue } from './engine';

/**
 * Feedback for timer cues on a phone: haptic taps in place of beeps (they work with the ringer off
 * and on a locked screen), and optional spoken phase names.
 */
export class CuePlayer {
  sound = true;
  voice = false;

  /** Kept so the timer hook reads the same way as on the web; nothing needs unlocking on a phone. */
  unlock(): void {}

  private async pulse(times: number, style: Haptics.ImpactFeedbackStyle, gapMs = 140): Promise<void> {
    for (let i = 0; i < times; i++) {
      await Haptics.impactAsync(style).catch(() => undefined);
      if (i < times - 1) await new Promise((r) => setTimeout(r, gapMs));
    }
  }

  speak(text: string): void {
    if (!this.voice) return;
    Speech.stop();
    Speech.speak(text, { rate: 1.05 });
  }

  play(cue: Cue, spoken?: string): void {
    if (this.sound) {
      switch (cue.type) {
        case 'tick':
          void this.pulse(1, Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'segment_start':
          void this.pulse(1, Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'halfway':
          void this.pulse(2, Haptics.ImpactFeedbackStyle.Medium, 200);
          break;
        case 'finish':
          void this.pulse(3, Haptics.ImpactFeedbackStyle.Heavy, 220);
          break;
      }
    }
    if (spoken) this.speak(spoken);
  }

  dispose(): void {
    Speech.stop();
  }
}
