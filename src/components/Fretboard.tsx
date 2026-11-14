import { useId, useMemo } from 'react';
import { Note } from 'tonal';
import { noteAtFret, pitchClassAtFret, spellPitchClass, SINGLE_DOT_FRETS, DOUBLE_DOT_FRETS } from '../utils/notes';
import { contrastText } from '../utils/colors';

export type Highlight = {
  /** Fill color for the marker. */
  color: string;
  /** Optional label drawn inside the marker (e.g. a degree like "R", "3"). */
  label?: string;
};

/** Map of note name / pitch class -> highlight. Matched by pitch class (enharmonic-aware). */
export type HighlightMap = Record<string, Highlight>;

/** A specific cell highlight (used to show one chord voicing). */
export type CellMarker = {
  string: number;
  fret: number;
  color: string;
  label?: string;
};

export interface FretboardProps {
  /** Open-string notes (with octave), low to high. */
  tuning: string[];
  /** Total number of frets the instrument has (used for dot logic / labels). */
  numFrets?: number;
  /** Inclusive [low, high] fret range to display. 0 includes open strings. */
  fretRange?: [number, number];
  /** Highlights keyed by note name or pitch class. */
  highlightedNotes?: HighlightMap;
  /** Mirror horizontally for left-handed players. */
  leftHanded?: boolean;
  /** Show the note name in every cell (default true). */
  showAllNotes?: boolean;
  /** Specific cells to mark on top (e.g. a single chord voicing). */
  positions?: CellMarker[];
  /** Strings to mark as muted with an "✕" at the nut. */
  mutedStrings?: number[];
  /** Spell note names with flats (Bb, Eb) instead of sharps. */
  spellFlats?: boolean;
  /** Called when a note marker is clicked. `note` includes the octave. */
  onCellClick?: (stringIndex: number, fret: number, note: string) => void;
}

const CELL_W = 52;
const STRING_GAP = 40;
const PAD_L = 68; // gutter for string labels / open notes
const PAD_R = 22;
const PAD_T = 40; // gutter for fret numbers
const PAD_B = 26;
const MARKER_R = 15;

/** Build a chroma-keyed lookup from a note/pitch-class-keyed highlight map. */
function buildChromaMap(map: HighlightMap | undefined): Map<number, Highlight> {
  const out = new Map<number, Highlight>();
  if (!map) return out;
  for (const [key, h] of Object.entries(map)) {
    const c = Note.chroma(key);
    if (c != null) out.set(c, h);
  }
  return out;
}

export function Fretboard({
  tuning,
  numFrets = 15,
  fretRange,
  highlightedNotes,
  leftHanded = false,
  showAllNotes = true,
  positions,
  mutedStrings,
  spellFlats = false,
  onCellClick,
}: FretboardProps) {
  const uid = useId().replace(/:/g, '');
  const numStrings = tuning.length;
  const [lo, hi] = fretRange ?? [0, numFrets];
  const showOpen = lo <= 0;
  const firstFinger = Math.max(lo, 1);
  const lastFinger = Math.max(hi, firstFinger);

  const highlights = useMemo(() => buildChromaMap(highlightedNotes), [highlightedNotes]);
  const muted = useMemo(() => new Set(mutedStrings ?? []), [mutedStrings]);
  const description = useMemo(() => {
    const parts = [`Guitar fretboard, ${numStrings} strings, frets ${lo} to ${hi}`];
    if (positions?.length) {
      const placed = positions
        .map((p) => {
          const open = Note.pitchClass(tuning[p.string] ?? '');
          const who = open ? `${open} string` : `string ${p.string + 1}`;
          return `${who}, fret ${p.fret}${p.label ? ` (${p.label})` : ''}`;
        })
        .join('; ');
      parts.push(`Voicing: ${placed}`);
    } else if (highlightedNotes && Object.keys(highlightedNotes).length > 0) {
      const notes = Object.entries(highlightedNotes)
        .map(([name, h]) => (h.label ? `${name} (${h.label})` : name))
        .join(', ');
      parts.push(`Highlighted notes: ${notes}`);
    }
    if (mutedStrings?.length) {
      const names = mutedStrings.map((s) => Note.pitchClass(tuning[s] ?? '') || `string ${s + 1}`);
      parts.push(`Muted: ${names.join(', ')}`);
    }
    return parts.join('. ');
  }, [hi, highlightedNotes, lo, mutedStrings, numStrings, positions, tuning]);

  // Build columns: optional open column, then a column per finger fret.
  const fingerFrets: number[] = [];
  for (let f = firstFinger; f <= lastFinger; f++) fingerFrets.push(f);

  let cursorX = PAD_L;
  const columns: { fret: number; cx: number; isOpen: boolean }[] = [];
  if (showOpen) {
    columns.push({ fret: 0, cx: cursorX + CELL_W / 2, isOpen: true });
    cursorX += CELL_W;
  }
  const nutX = cursorX; // boundary between open column and first finger cell
  for (const f of fingerFrets) {
    columns.push({ fret: f, cx: cursorX + CELL_W / 2, isOpen: false });
    cursorX += CELL_W;
  }
  const gridRight = cursorX;
  const totalWidth = gridRight + PAD_R;
  const totalHeight = PAD_T + (numStrings - 1) * STRING_GAP + PAD_B;

  // Logical -> actual x (mirror for left-handed, keeping text upright).
  const fx = (x: number) => (leftHanded ? totalWidth - x : x);

  const stringY = (i: number) => PAD_T + (numStrings - 1 - i) * STRING_GAP;

  // Vertical fret wire x positions (nut + one per finger cell right edge).
  const fretLineXs: { x: number; isNut: boolean }[] = [];
  fretLineXs.push({ x: nutX, isNut: showOpen });
  for (let k = 1; k <= fingerFrets.length; k++) {
    fretLineXs.push({ x: nutX + k * CELL_W, isNut: false });
  }

  const boardTop = stringY(numStrings - 1);
  const boardBottom = stringY(0);
  const boardMidY = (boardTop + boardBottom) / 2;
  const boardY = boardTop - STRING_GAP / 2;
  const boardH = (numStrings - 1) * STRING_GAP + STRING_GAP;
  const boardLeft = showOpen ? nutX : PAD_L;
  const boardW = gridRight - boardLeft;
  const boardRectX = leftHanded ? totalWidth - (boardLeft + boardW) : boardLeft;
  const readableMin = Math.min(totalWidth, 720);

  return (
    <div className="fretboard-scroll">
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role={onCellClick ? 'group' : 'img'}
        aria-label={description}
        fontFamily="var(--font-sans)"
        style={{ width: '100%', minWidth: `${readableMin}px`, height: 'auto' }}
      >
        <defs>
          <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wood-hi)" />
            <stop offset="100%" stopColor="var(--wood-lo)" />
          </linearGradient>
          <pattern id={`${uid}-grain`} width="7" height="8" patternUnits="userSpaceOnUse">
            <line x1="1" y1="0" x2="1" y2="8" stroke="var(--wood-grain)" strokeWidth="1.4" />
          </pattern>
          <radialGradient id={`${uid}-pearl`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fffdf8" />
            <stop offset="55%" stopColor="var(--inlay)" />
            <stop offset="100%" stopColor="#cbb892" />
          </radialGradient>
          <filter id={`${uid}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#000" floodOpacity="0.35" />
          </filter>
          <filter id={`${uid}-board`} x="-4%" y="-12%" width="108%" height="130%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.22" />
          </filter>
          <clipPath id={`${uid}-clip`}>
            <rect x={boardRectX} y={boardY} width={boardW} height={boardH} rx="12" />
          </clipPath>
        </defs>

        <rect
          x={boardRectX}
          y={boardY}
          width={boardW}
          height={boardH}
          rx="12"
          fill={`url(#${uid}-wood)`}
          filter={`url(#${uid}-board)`}
        />
        <g clipPath={`url(#${uid}-clip)`}>
          <rect x={boardRectX} y={boardY} width={boardW} height={boardH} fill={`url(#${uid}-grain)`} />

          {/* Binding along the fingerboard edges */}
          <line
            x1={boardRectX}
            y1={boardY + 2}
            x2={boardRectX + boardW}
            y2={boardY + 2}
            stroke="var(--binding)"
            strokeWidth="2"
          />
          <line
            x1={boardRectX}
            y1={boardY + boardH - 2}
            x2={boardRectX + boardW}
            y2={boardY + boardH - 2}
            stroke="var(--binding)"
            strokeWidth="2"
          />

          {/* Position dots */}
          {fingerFrets.map((f) => {
            const col = columns.find((c) => c.fret === f);
            if (!col) return null;
            const cx = fx(col.cx);
            if (DOUBLE_DOT_FRETS.has(f)) {
              return (
                <g key={`dot-${f}`}>
                  <circle cx={cx} cy={boardMidY - STRING_GAP * 0.85} r={5.5} fill={`url(#${uid}-pearl)`} />
                  <circle cx={cx} cy={boardMidY + STRING_GAP * 0.85} r={5.5} fill={`url(#${uid}-pearl)`} />
                </g>
              );
            }
            if (SINGLE_DOT_FRETS.has(f)) {
              return <circle key={`dot-${f}`} cx={cx} cy={boardMidY} r={5.5} fill={`url(#${uid}-pearl)`} />;
            }
            return null;
          })}

          {/* Fret wires */}
          {fretLineXs.map((fl, idx) =>
            fl.isNut ? null : (
              <g key={`fret-${idx}`}>
                <line
                  x1={fx(fl.x)}
                  y1={boardY}
                  x2={fx(fl.x)}
                  y2={boardY + boardH}
                  stroke="rgba(0,0,0,0.35)"
                  strokeWidth={3}
                />
                <line
                  x1={fx(fl.x) + (leftHanded ? 0.7 : -0.7)}
                  y1={boardY}
                  x2={fx(fl.x) + (leftHanded ? 0.7 : -0.7)}
                  y2={boardY + boardH}
                  stroke="var(--fret-wire)"
                  strokeWidth={1.6}
                />
              </g>
            ),
          )}
        </g>

        {/* Nut */}
        {showOpen && (
          <line
            x1={fx(nutX)}
            y1={boardY - 1}
            x2={fx(nutX)}
            y2={boardY + boardH + 1}
            stroke="var(--nut)"
            strokeWidth={8}
            strokeLinecap="round"
          />
        )}

        {/* Strings, low to high getting thinner, with a shadow underneath */}
        {tuning.map((_, i) => {
          const y = stringY(i);
          const x1 = fx(showOpen ? PAD_L : nutX);
          const x2 = fx(gridRight);
          const thickness = 1.15 + (numStrings - 1 - i) * 0.42;
          return (
            <g key={`string-${i}`}>
              <line x1={x1} y1={y + 1} x2={x2} y2={y + 1} stroke="rgba(0,0,0,0.35)" strokeWidth={thickness} strokeLinecap="round" />
              <line x1={x1} y1={y} x2={x2} y2={y} stroke="var(--string)" strokeWidth={thickness} strokeLinecap="round" />
            </g>
          );
        })}

        {/* Fret number labels. Marker frets are a touch stronger. */}
        {fingerFrets.map((f) => {
          const col = columns.find((c) => c.fret === f);
          if (!col) return null;
          const marker = SINGLE_DOT_FRETS.has(f) || DOUBLE_DOT_FRETS.has(f);
          return (
            <text
              key={`fnum-${f}`}
              x={fx(col.cx)}
              y={18}
              textAnchor="middle"
              fontSize={marker ? 13 : 12}
              fontWeight={marker ? 700 : 500}
              fill={marker ? 'var(--ink-secondary)' : 'var(--ink-tertiary)'}
            >
              {f}
            </text>
          );
        })}

        {/* String labels in the left gutter. A muted string shows ✕ instead of its open note. */}
        {tuning.map((open, i) => {
          const isMuted = muted.has(i);
          const label = isMuted ? '✕' : spellPitchClass(open, spellFlats);
          const cx = fx(PAD_L / 2);
          const cy = stringY(i);
          return (
            <g key={`open-${i}`}>
              <rect x={cx - 18} y={cy - 12} width={36} height={24} rx={12} fill="var(--surface)" stroke="var(--line)" />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isMuted ? 15 : 13}
                fontWeight={700}
                fill={isMuted ? 'var(--ink-tertiary)' : 'var(--ink)'}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Note markers */}
        {tuning.map((open, i) =>
          columns.map((col) => {
            const pc = spellPitchClass(pitchClassAtFret(open, col.fret), spellFlats);
            const c = Note.chroma(pc);
            const click = onCellClick
              ? () => onCellClick(i, col.fret, noteAtFret(open, col.fret))
              : undefined;
            const hl = c != null ? highlights.get(c) : undefined;
            const cx = fx(col.cx);
            const cy = stringY(i);

            if (hl) {
              const label = hl.label ?? pc;
              return (
                <g
                  key={`m-${i}-${col.fret}`}
                  filter={`url(#${uid}-shadow)`}
                  onClick={click}
                  style={click ? { cursor: 'pointer' } : undefined}
                >
                  <circle cx={cx} cy={cy} r={MARKER_R} fill={hl.color} />
                  <circle cx={cx} cy={cy} r={MARKER_R - 1.2} fill="none" stroke="var(--marker-ring)" strokeWidth="1.6" />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={label.length > 1 ? 10 : 12}
                    fontWeight={700}
                    fill={contrastText(hl.color)}
                  >
                    {label}
                  </text>
                </g>
              );
            }

            if (!showAllNotes) {
              if (!click) return null;
              return (
                <g key={`hit-${i}-${col.fret}`} onClick={click} style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={MARKER_R} fill="transparent" />
                </g>
              );
            }

            return (
              <g key={`m-${i}-${col.fret}`} onClick={click} style={click ? { cursor: 'pointer' } : undefined}>
                <circle cx={cx} cy={cy} r={MARKER_R - 2} fill="var(--ghost-fill)" stroke="var(--ghost-stroke)" strokeWidth="1" />
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--ghost-ink)"
                >
                  {pc}
                </text>
              </g>
            );
          }),
        )}

        {/* Specific cell markers (a single chord voicing), drawn on top */}
        {positions?.map((m) => {
          const col = columns.find((c) => c.fret === m.fret);
          if (!col) return null;
          const cx = fx(col.cx);
          const cy = stringY(m.string);
          const open = tuning[m.string];
          const click = onCellClick && open
            ? () => onCellClick(m.string, m.fret, noteAtFret(open, m.fret))
            : undefined;
          return (
            <g
              key={`pos-${m.string}-${m.fret}`}
              filter={`url(#${uid}-shadow)`}
              onClick={click}
              style={click ? { cursor: 'pointer' } : undefined}
            >
              <circle cx={cx} cy={cy} r={MARKER_R} fill={m.color} />
              <circle cx={cx} cy={cy} r={MARKER_R - 1.2} fill="none" stroke="var(--marker-ring)" strokeWidth="1.6" />
              {m.label && (
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={m.label.length > 1 ? 10 : 12}
                  fontWeight={700}
                  fill={contrastText(m.color)}
                >
                  {m.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default Fretboard;
