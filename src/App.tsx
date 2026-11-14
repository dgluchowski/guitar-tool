import { Suspense, lazy, useEffect, useState } from 'react';
import TuningSelector from './components/TuningSelector';
import { splitChordSymbol } from './utils/catalog';

// Lazy-load tab views so each is a separate chunk and the initial load stays small.
const Explore = lazy(() => import('./components/Explore'));
const Dictionary = lazy(() => import('./components/Dictionary'));
const Progressions = lazy(() => import('./components/Progressions'));
const Genres = lazy(() => import('./components/Genres'));
const Practice = lazy(() => import('./components/Practice'));
import { DEFAULT_STATE, decodeState, encodeState } from './utils/appState';
import type { AppState, View } from './utils/appState';

const MAX_FRETS = 15;
const TABS: { id: View; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'dictionary', label: 'Dictionary' },
  { id: 'progressions', label: 'Progressions' },
  { id: 'genres', label: 'Genres' },
  { id: 'practice', label: 'Practice' },
];

const THEME_COLOR = { dark: '#121110', light: '#f4f1eb' };

type ThemeChoice = 'light' | 'dark' | null;

function readStoredTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem('gt-dark');
    if (saved === '1') return 'dark';
    if (saved === '0') return 'light';
  } catch {
    // Private mode can block storage; fall through to the system preference.
  }
  return null;
}

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => ({ ...DEFAULT_STATE, ...decodeState(window.location.hash) }));
  // null means "no explicit choice yet" — follow the system, and only persist after a toggle.
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(readStoredTheme);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const dark = themeChoice === null ? systemDark : themeChoice === 'dark';

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  // Keep the URL hash in sync with state (shareable links).
  useEffect(() => {
    window.history.replaceState(null, '', '#' + encodeState(state));
  }, [state]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
  }, [dark]);

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    setThemeChoice(next);
    try {
      localStorage.setItem('gt-dark', next === 'dark' ? '1' : '0');
    } catch {
      // Ignore storage failures; the in-memory choice still applies this session.
    }
  };

  const selectChord = (symbol: string) => {
    const { root, quality } = splitChordSymbol(symbol);
    update({ mode: 'chord', root, quality });
  };

  return (
    <div className="app-bg">
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <img src="app-icon.svg" alt="" className="brand-mark" />
            <div>
              <h1>Guitar Tool</h1>
              <p>Chords, scales, voicings &amp; progressions for any tuning.</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              onClick={() => update({ leftHanded: !state.leftHanded })}
              className="btn"
              aria-pressed={state.leftHanded}
              aria-label={`Handedness: ${state.leftHanded ? 'left-handed' : 'right-handed'}. Click to toggle.`}
            >
              {state.leftHanded ? '🎸 Left' : '🎸 Right'}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="btn"
              aria-pressed={dark}
              aria-label={`Theme: ${dark ? 'dark' : 'light'}. Click to toggle.`}
            >
              {dark ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </header>

        <div className="panel mb">
          <TuningSelector
            tuning={state.tuning}
            onChange={(tuning) => update({ tuning })}
            custom={state.custom}
            onCustomChange={(custom) => update({ custom })}
          />
        </div>

        <nav aria-label="Views" className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => update({ view: t.id })}
              aria-current={state.view === t.id ? 'page' : undefined}
              className="tab"
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main>
        <Suspense fallback={<div className="loading">Loading…</div>}>
        {state.view === 'explore' && (
          <Explore
            mode={state.mode}
            root={state.root}
            quality={state.quality}
            scaleType={state.scaleType}
            tuning={state.tuning}
            leftHanded={state.leftHanded}
            numFrets={MAX_FRETS}
            onChange={update}
          />
        )}

        {state.view === 'dictionary' && (
          <Dictionary
            root={state.root}
            quality={state.quality}
            tuning={state.tuning}
            leftHanded={state.leftHanded}
            numFrets={MAX_FRETS}
            keyTonic={state.keyTonic}
            keyMode={state.keyMode}
            onSelectChord={selectChord}
            onKeyChange={(patch) => update(patch as Partial<AppState>)}
          />
        )}

        {state.view === 'genres' && (
          <Genres
            tuning={state.tuning}
            leftHanded={state.leftHanded}
            numFrets={MAX_FRETS}
            onUseTuning={(strings) => update({ tuning: strings, custom: false })}
          />
        )}

        {state.view === 'practice' && <Practice tuning={state.tuning} />}

        {state.view === 'progressions' && (
          <Progressions
            tuning={state.tuning}
            leftHanded={state.leftHanded}
            numFrets={MAX_FRETS}
            keyTonic={state.keyTonic}
            keyMode={state.keyMode}
            progression={state.progression}
            selectedChord={`${state.root}${state.quality}`}
            onSelectChord={selectChord}
            onKeyChange={(patch) => update(patch as Partial<AppState>)}
            onProgressionChange={(progression) => update({ progression })}
          />
        )}
        </Suspense>
        </main>

        <footer className="app-footer">
          Open-source guitar learning tool · audio is generated locally · share this page's URL to share your view.
        </footer>
      </div>
    </div>
  );
}
