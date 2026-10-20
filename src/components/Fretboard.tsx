import { useMemo } from 'react';
import { Note } from 'tonal';
import { pitchClassAtFret, SINGLE_DOT_FRETS, DOUBLE_DOT_FRETS } from '../utils/notes';
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
}

const CELL_W = 56;
const STRING_GAP = 36;
const PAD_L = 56; // gutter for string labels / open notes
const PAD_R = 24;
const PAD_T = 36; // gutter for fret numbers
const PAD_B = 24;
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
}: FretboardProps) {
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

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        role="img"
        aria-label={description}
        className="max-w-full"
      >
        {/* Fretboard background */}
        {(() => {
          const boardLeft = showOpen ? nutX : PAD_L;
          const boardW = gridRight - boardLeft;
          const rectX = leftHanded ? totalWidth - (boardLeft + boardW) : boardLeft;
          return (
            <rect
              x={rectX}
              y={boardTop - STRING_GAP / 2}
              width={boardW}
              height={(numStrings - 1) * STRING_GAP + STRING_GAP}
              className="fill-amber-50 dark:fill-stone-800"
            />
          );
        })()}

        {/* Position dots */}
        {fingerFrets.map((f) => {
          const col = columns.find((c) => c.fret === f);
          if (!col) return null;
          const cx = fx(col.cx);
          if (DOUBLE_DOT_FRETS.has(f)) {
            return (
              <g key={`dot-${f}`}>
                <circle cx={cx} cy={boardMidY - STRING_GAP * 0.9} r={6} className="fill-stone-300 dark:fill-stone-600" />
                <circle cx={cx} cy={boardMidY + STRING_GAP * 0.9} r={6} className="fill-stone-300 dark:fill-stone-600" />
              </g>
            );
          }
          if (SINGLE_DOT_FRETS.has(f)) {
            return <circle key={`dot-${f}`} cx={cx} cy={boardMidY} r={6} className="fill-stone-300 dark:fill-stone-600" />;
          }
          return null;
        })}

        {/* Fret wires */}
        {fretLineXs.map((fl, idx) => (
          <line
            key={`fret-${idx}`}
            x1={fx(fl.x)}
            y1={boardTop - STRING_GAP / 2}
            x2={fx(fl.x)}
            y2={boardBottom + STRING_GAP / 2}
            className={fl.isNut ? 'stroke-stone-800 dark:stroke-stone-200' : 'stroke-stone-400 dark:stroke-stone-500'}
            strokeWidth={fl.isNut ? 6 : 2}
          />
        ))}

        {/* Strings */}
        {tuning.map((_, i) => (
          <line
            key={`string-${i}`}
            x1={fx(showOpen ? PAD_L : nutX)}
            y1={stringY(i)}
            x2={fx(gridRight)}
            y2={stringY(i)}
            className="stroke-stone-500 dark:stroke-stone-400"
            strokeWidth={1 + (numStrings - 1 - i) * 0.4}
          />
        ))}

        {/* Fret number labels */}
        {fingerFrets.map((f) => {
          const col = columns.find((c) => c.fret === f);
          if (!col) return null;
          return (
            <text
              key={`fnum-${f}`}
              x={fx(col.cx)}
              y={PAD_T - 16}
              textAnchor="middle"
              className="fill-stone-500 dark:fill-stone-400 text-xs"
            >
              {f}
            </text>
          );
        })}

        {/* String labels in the left gutter. A muted string shows ✕ instead of its open note. */}
        {tuning.map((open, i) => {
          const isMuted = muted.has(i);
          return (
            <text
              key={`open-${i}`}
              x={fx(PAD_L / 2)}
              y={stringY(i) + (isMuted ? 5 : 4)}
              textAnchor="middle"
              fontSize={isMuted ? 16 : undefined}
              fontWeight={isMuted ? 700 : undefined}
              className={
                isMuted
                  ? 'fill-stone-400 dark:fill-stone-500'
                  : 'fill-stone-700 dark:fill-stone-300 text-sm font-medium'
              }
            >
              {isMuted ? '✕' : Note.pitchClass(open)}
            </text>
          );
        })}

        {/* Note markers */}
        {tuning.map((open, i) =>
          columns.map((col) => {
            const pc = pitchClassAtFret(open, col.fret);
            const c = Note.chroma(pc);
            const hl = c != null ? highlights.get(c) : undefined;
            const cx = fx(col.cx);
            const cy = stringY(i);

            if (hl) {
              return (
                <g key={`m-${i}-${col.fret}`}>
                  <circle cx={cx} cy={cy} r={MARKER_R} fill={hl.color} stroke="#00000033" />
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fontSize={hl.label && hl.label.length > 1 ? 11 : 13}
                    fontWeight={600}
                    fill={contrastText(hl.color)}
                  >
                    {hl.label ?? pc}
                  </text>
                </g>
              );
            }

            if (!showAllNotes) return null;

            return (
              <g key={`m-${i}-${col.fret}`} opacity={0.55}>
                <circle cx={cx} cy={cy} r={MARKER_R - 2} className="fill-white dark:fill-stone-700 stroke-stone-300 dark:stroke-stone-600" />
                <text x={cx} y={cy + 4} textAnchor="middle" className="fill-stone-600 dark:fill-stone-300" fontSize={12}>
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
          return (
            <g key={`pos-${m.string}-${m.fret}`}>
              <circle cx={cx} cy={cy} r={MARKER_R} fill={m.color} stroke="#000000" strokeWidth={1.5} />
              {m.label && (
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize={m.label.length > 1 ? 11 : 13}
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
