import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { t } from '../i18n';
import type { Exercise } from '../types';
import { Icon, StatusChip, T, color, radius } from '../ui';

const PROVIDER_NAME = { youtube: 'YouTube', vimeo: 'Vimeo' } as const;

function embedUrl(e: Pick<Exercise, 'videoProvider' | 'videoId'>): string {
  return e.videoProvider === 'vimeo'
    ? `https://player.vimeo.com/video/${e.videoId}?playsinline=1&autoplay=1&muted=1`
    : `https://www.youtube-nocookie.com/embed/${e.videoId}?playsinline=1&rel=0&autoplay=1&mute=1`;
}

interface Props {
  exercise: Pick<Exercise, 'name' | 'videoUrl' | 'videoProvider' | 'videoId' | 'thumbnailUrl' | 'linkStatus' | 'cues'>;
  hideCues?: boolean;
}

/**
 * Inline preview through the official player only. Nothing loads until the person taps, playback
 * stays inline, and it never starts with sound.
 */
export function VideoEmbed({ exercise, hideCues }: Props) {
  const [playing, setPlaying] = useState(false);
  const provider = exercise.videoProvider ? PROVIDER_NAME[exercise.videoProvider] : undefined;
  const unavailable = exercise.linkStatus === 'unavailable';

  return (
    <View style={{ gap: 8 }}>
      {!exercise.videoId || !exercise.videoProvider ? null : unavailable ? (
        <View style={[styles.frame, { alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
          <Icon name="alert" size={28} tint={color.danger} />
          <T variant="label" tone="muted">
            {exercise.name}
          </T>
          <Pressable accessibilityRole="link" onPress={() => exercise.videoUrl && void Linking.openURL(exercise.videoUrl)}>
            <T variant="bodyStrong" tone="brand">
              {t('video.open', { provider: provider ?? '' })}
            </T>
          </Pressable>
          <StatusChip kind="link" value="unavailable" />
        </View>
      ) : playing ? (
        <View style={styles.frame}>
          <WebView
            source={{ uri: embedUrl(exercise) }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            javaScriptEnabled
            originWhitelist={['https://*']}
            setSupportMultipleWindows={false}
            style={{ backgroundColor: '#000' }}
            accessibilityLabel={exercise.name}
          />
        </View>
      ) : (
        <Pressable style={styles.frame} onPress={() => setPlaying(true)} accessibilityRole="button" accessibilityLabel={t('video.play', { name: exercise.name })}>
          {exercise.thumbnailUrl ? <Image source={{ uri: exercise.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={styles.play}>
            <Icon name="play" size={30} tint={color.onBrand} />
          </View>
          {provider ? (
            <View style={styles.prov}>
              <T variant="chip">{provider}</T>
            </View>
          ) : null}
        </Pressable>
      )}
      {!hideCues && exercise.cues ? <T tone="muted">{exercise.cues}</T> : null}
    </View>
  );
}

/** Small square thumbnail for lists. */
export function Thumb({ url, status }: { url?: string; status?: Exercise['linkStatus'] }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={styles.thumb}>
      {url && !failed ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} /> : <Icon name={status === 'unavailable' ? 'alert' : 'play'} size={18} tint={color.muted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: '#000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  prov: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: color.surfaceControl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
