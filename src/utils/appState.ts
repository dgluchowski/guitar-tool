import { canonicalRoot } from './catalog';
import { DEFAULT_TUNING } from './notes';
import type { KeyMode } from './keys';

export type View = 'explore' | 'dictionary' | 'progressions' | 'genres' | 'practice';
export type SelectionMode = 'chord' | 'scale';

export interface AppState {
  view: View;
  tuning: string[];
  custom: boolean;
  leftHanded: boolean;
  mode: SelectionMode;
  root: string;
  quality: string;
  scaleType: string;
  keyTonic: string;
  keyMode: KeyMode;
  /** Roman numerals, e.g. ["I","V","vi","IV"]. */
  progression: string[];
}

export const DEFAULT_STATE: AppState = {
  view: 'explore',
  tuning: [...DEFAULT_TUNING.strings],
  custom: false,
  leftHanded: false,
  mode: 'chord',
  root: 'C',
  quality: '',
  scaleType: 'major',
  keyTonic: 'C',
  keyMode: 'major',
  progression: ['I', 'V', 'vi', 'IV'],
};

/** Serialize state into a URL hash query string. */
export function encodeState(s: AppState): string {
  const p = new URLSearchParams();
  p.set('v', s.view);
  p.set('t', s.tuning.join(','));
  if (s.leftHanded) p.set('lh', '1');
  p.set('m', s.mode);
  p.set('r', s.root);
  p.set('q', s.quality);
  p.set('sc', s.scaleType);
  p.set('kt', s.keyTonic);
  p.set('km', s.keyMode);
  p.set('p', s.progression.join('-'));
  return p.toString();
}

/** Parse a URL hash query string into a partial state (tolerant of missing keys). */
export function decodeState(hash: string): Partial<AppState> {
  const q = hash.startsWith('#') ? hash.slice(1) : hash;
  const p = new URLSearchParams(q);
  const out: Partial<AppState> = {};
  const v = p.get('v');
  if (v === 'explore' || v === 'dictionary' || v === 'progressions' || v === 'genres' || v === 'practice')
    out.view = v;
  const t = p.get('t');
  if (t) {
    const strings = t.split(',').filter(Boolean);
    if (strings.length >= 2) {
      out.tuning = strings;
      // leave `custom` unset — TuningSelector auto-detects presets vs custom
    }
  }
  if (p.get('lh') === '1') out.leftHanded = true;
  const m = p.get('m');
  if (m === 'chord' || m === 'scale') out.mode = m;
  const root = p.get('r');
  if (root) {
    const spelled = canonicalRoot(root);
    if (spelled) out.root = spelled;
  }
  if (p.get('q') != null) out.quality = p.get('q')!;
  if (p.get('sc')) out.scaleType = p.get('sc')!;
  const keyTonic = p.get('kt');
  if (keyTonic) {
    const spelled = canonicalRoot(keyTonic);
    if (spelled) out.keyTonic = spelled;
  }
  const km = p.get('km');
  if (km === 'major' || km === 'minor') out.keyMode = km;
  const prog = p.get('p');
  if (prog) out.progression = prog.split('-').filter(Boolean);
  return out;
}
