// Window lanes: bars along a time axis showing when the Sun, Earth, or both are in view.
// State is carried by fill as well as colour: solid = whole disc in view,
// hatched = partly hidden by terrain, empty = out of view.

import { longestGap, type Series } from '../astro/windows';

export type LaneKind = 'sun' | 'earth' | 'both';

type State = 0 | 1 | 2; // hidden, partial, full

const FULL = 0.999;
const NONE = 0.001;

function stateAt(s: Series, kind: LaneKind, i: number): State {
  const one = (f: number): State => (f >= FULL ? 2 : f > NONE ? 1 : 0);
  if (kind === 'sun') return one(s.sunFraction[i]);
  if (kind === 'earth') return one(s.earthFraction[i]);
  return Math.min(one(s.sunFraction[i]), one(s.earthFraction[i])) as State;
}

export interface LaneOptions {
  width: number;
  /** Height of one lane. */
  lane: number;
  /** Space between lanes. */
  gap: number;
  kinds: LaneKind[];
  /** Clip the series to this time range (defaults to the whole series). */
  fromMs?: number;
  toMs?: number;
  /** Bracket the longest stretch without the Sun and without Earth. */
  markGaps?: boolean;
}

/** SVG markup (no outer <svg>) for the lanes of one series. */
export function lanesMarkup(s: Series, o: LaneOptions): string {
  const from = o.fromMs ?? s.startMs;
  const to = o.toMs ?? s.startMs + (s.count - 1) * s.stepMs;
  const span = to - from;
  const xOf = (ms: number) => Math.max(0, Math.min(o.width, ((ms - from) / span) * o.width));
  let out = '';
  o.kinds.forEach((kind, row) => {
    const y = row * (o.lane + o.gap);
    out += `<rect class="lane-bed" x="0.5" y="${y + 0.5}" width="${o.width - 1}" height="${o.lane - 1}"/>`;
    let runState: State = 0;
    let runStart = 0;
    const flush = (endIndex: number) => {
      if (runState === 0) return;
      // Each sample stands for the half-step either side of it.
      const x0 = xOf(s.startMs + (runStart - 0.5) * s.stepMs);
      const x1 = xOf(s.startMs + (endIndex - 0.5) * s.stepMs);
      if (x1 - x0 < 0.05) return;
      out += `<rect class="lane-${kind}${runState === 1 ? ' part' : ''}" x="${x0.toFixed(2)}" y="${y}" width="${(x1 - x0).toFixed(2)}" height="${o.lane}"/>`;
    };
    for (let i = 0; i < s.count; i++) {
      const st = stateAt(s, kind, i);
      if (st !== runState) {
        flush(i);
        runState = st;
        runStart = i;
      }
    }
    flush(s.count);

    // The longest stretch without this body: a vermilion bracket under the lane.
    const gap = o.markGaps && kind !== 'both' ? longestGap(s, kind) : null;
    if (gap) {
      const x0 = xOf(s.startMs + (gap.start - 0.5) * s.stepMs);
      const x1 = xOf(s.startMs + (gap.end - 0.5) * s.stepMs);
      if (x1 - x0 >= 3) {
        const yb = y + o.lane + 2.5;
        out += `<path class="lane-gap" d="M${x0.toFixed(1)} ${yb - 4}V${yb}H${x1.toFixed(1)}V${yb - 4}"/>`;
      }
    }
  });
  return out;
}

export const lanesHeight = (o: Pick<LaneOptions, 'lane' | 'gap' | 'kinds'>) =>
  o.kinds.length * o.lane + (o.kinds.length - 1) * o.gap;
