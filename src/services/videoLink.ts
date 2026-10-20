import type { LinkPreview, VideoProvider } from '../types';
import { ServiceError } from './DataService';

export interface ParsedVideo {
  provider: VideoProvider;
  videoId: string;
}

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

const INVALID = 'Only YouTube and Vimeo links are supported. Paste a link such as youtube.com/watch?v=… or vimeo.com/….';

/** Parses a YouTube (watch, shorts, embed, youtu.be) or Vimeo link. Anything else is rejected. */
export function parseVideoUrl(input: string): ParsedVideo {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new ServiceError('invalid_link', INVALID);
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    const id = parts[0];
    if (id && YT_ID.test(id)) return { provider: 'youtube', videoId: id };
  } else if (YT_HOSTS.has(host)) {
    const id =
      parts[0] === 'watch' ? url.searchParams.get('v') : parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' ? parts[1] : null;
    if (id && YT_ID.test(id)) return { provider: 'youtube', videoId: id };
  } else if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    const id = parts.find((p) => VIMEO_ID.test(p));
    if (id) return { provider: 'vimeo', videoId: id };
  }
  throw new ServiceError('invalid_link', INVALID);
}

export function videoUrlFor(v: ParsedVideo): string {
  return v.provider === 'youtube' ? `https://www.youtube.com/watch?v=${v.videoId}` : `https://vimeo.com/${v.videoId}`;
}

export function thumbnailFor(v: ParsedVideo): string {
  return v.provider === 'youtube' ? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` : `https://vumbnail.com/${v.videoId}.jpg`;
}

/** Stands in for the provider's oEmbed lookup that the real service performs server-side. */
export function mockOembed(v: ParsedVideo, titles: Record<string, string>): LinkPreview {
  if (v.videoId.toLowerCase().includes('private') || v.videoId.startsWith('UNAVAIL')) {
    throw new ServiceError('not_found', 'This video could not be found. It may be private or removed.');
  }
  return {
    provider: v.provider,
    videoId: v.videoId,
    title: titles[v.videoId] ?? `${v.provider === 'youtube' ? 'YouTube' : 'Vimeo'} video ${v.videoId}`,
    thumbnailUrl: thumbnailFor(v),
    embeddable: !v.videoId.startsWith('NOEMBED'),
  };
}
