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

export default function App() {
  const [state, setState] = useState<AppState>(() => ({ ...DEFAULT_STATE, ...decodeState(window.location.hash) }));
  const [dark, setDark] = useState(() => localStorage.getItem('gt-dark') === '1');

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  // Keep the URL hash in sync with state (shareable links).
  useEffect(() => {
    window.history.replaceState(null, '', '#' + encodeState(state));
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('gt-dark', dark ? '1' : '0');
  }, [dark]);

  const selectChord = (symbol: string) => {
    const { root, quality } = splitChordSymbol(symbol);
    update({ mode: 'chord', root, quality });
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-stone-50 to-stone-100 text-stone-900 dark:from-stone-950 dark:to-stone-900 dark:text-stone-100">
      <div className="app-shell mx-auto max-w-6xl py-6 sm:py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="app-icon.svg" alt="" className="h-11 w-11 rounded-xl shadow-sm ring-1 ring-black/5" />
            <div>
              <h1 className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-violet-400 dark:to-fuchsia-400">
                Guitar Tool
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Chords, scales, voicings &amp; progressions for any tuning.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => update({ leftHanded: !state.leftHanded })}
              className="rounded-lg border border-stone-300 bg-white/70 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-white dark:border-stone-600 dark:bg-stone-800/70 dark:hover:bg-stone-800"
              aria-pressed={state.leftHanded}
              aria-label={`Handedness: ${state.leftHanded ? 'left-handed' : 'right-handed'}. Click to toggle.`}
            >
              {state.leftHanded ? '🎸 Left' : '🎸 Right'}
            </button>
            <button
              onClick={() => setDark((v) => !v)}
              className="rounded-lg border border-stone-300 bg-white/70 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-white dark:border-stone-600 dark:bg-stone-800/70 dark:hover:bg-stone-800"
              aria-pressed={dark}
              aria-label={`Theme: ${dark ? 'dark' : 'light'}. Click to toggle.`}
            >
              {dark ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </header>

        <div className="mb-4 rounded-xl border border-stone-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-stone-700/80 dark:bg-stone-800/50">
          <TuningSelector
            tuning={state.tuning}
            onChange={(tuning) => update({ tuning })}
            custom={state.custom}
            onCustomChange={(custom) => update({ custom })}
          />
        </div>

        <nav aria-label="Views" className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-stone-200/80 bg-stone-100/80 p-1 shadow-sm backdrop-blur dark:border-stone-700/80 dark:bg-stone-800/60">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => update({ view: t.id })}
              aria-current={state.view === t.id ? 'page' : undefined}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                state.view === t.id
                  ? 'bg-white text-violet-700 shadow-sm dark:bg-stone-700 dark:text-violet-300'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main>
        <Suspense fallback={<div className="py-12 text-center text-sm text-stone-400">Loading…</div>}>
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

        <footer className="mt-8 text-center text-xs text-stone-400">
          Open-source guitar learning tool · audio is generated locally · share this page's URL to share your view.
        </footer>
      </div>
    </div>
  );
}
