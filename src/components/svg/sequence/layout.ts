/**
 * layout.ts
 * Pure geometry for the sequence renderer: participant columns, message rows,
 * activation bars, notes and nested frames. No React, no DOM — unit-testable.
 */

import type { SequenceModel, SequenceParticipant } from '../../../kinds/types';

const MARGIN_X = 40;
const MARGIN_TOP = 24;
const HEADER_H = 44;
const ACTOR_H = 58;
const ROW_H = 46;
const SELF_ROW_H = 62;
const DIVIDER_H = 34;
const NOTE_H = 38;
const COL_GAP = 48;
const CHAR_W = 7.1;

export interface Lifeline {
  id: string;
  label: string;
  actor: boolean;
  centerX: number;
  boxW: number;
  boxTop: number;
  boxH: number;
  bottom: number;
}

export interface MessageLine {
  kind: 'message';
  x1: number;
  x2: number;
  y: number;
  text: string;
  dashed: boolean;
  head: 'filled' | 'open' | 'cross';
}

export interface SelfMessageLine {
  kind: 'self';
  x: number;
  y: number;
  text: string;
  dashed: boolean;
  head: 'filled' | 'open' | 'cross';
}

export interface NoteBox {
  kind: 'note';
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

export interface FrameBox {
  kind: 'frame';
  x: number;
  y: number;
  w: number;
  h: number;
  tag: string;
  label: string;
  depth: number;
  dividers: { y: number; tag: string; label: string }[];
}

export type Shape = MessageLine | SelfMessageLine | NoteBox | FrameBox;

export interface ActivationBar {
  x: number;
  y: number;
  h: number;
}

export interface SequenceLayout {
  width: number;
  height: number;
  lifelines: Lifeline[];
  shapes: Shape[];
  activations: ActivationBar[];
}

function textWidth(text: string): number {
  return text.length * CHAR_W;
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function columns(participants: SequenceParticipant[]): { lifelines: Lifeline[]; width: number } {
  const lifelines: Lifeline[] = [];
  let cursor = MARGIN_X;

  for (const p of participants) {
    const boxW = Math.min(240, Math.max(120, textWidth(p.label) + 36));
    lifelines.push({
      id: p.id,
      label: p.label,
      actor: p.actor,
      centerX: cursor + boxW / 2,
      boxW,
      boxTop: MARGIN_TOP,
      boxH: p.actor ? ACTOR_H : HEADER_H,
      bottom: 0,
    });
    cursor += boxW + COL_GAP;
  }

  return { lifelines, width: cursor - COL_GAP + MARGIN_X };
}

export function layoutSequence(model: SequenceModel): SequenceLayout {
  if (model.participants.length === 0) return { width: 0, height: 0, lifelines: [], shapes: [], activations: [] };

  const { lifelines, width } = columns(model.participants);
  const byId = new Map(lifelines.map(l => [l.id, l]));
  const shapes: Shape[] = [];
  const activations: ActivationBar[] = [];
  const openBars = new Map<string, number>();

  const frames: Array<{ tag: string; label: string; y: number; depth: number; dividers: FrameBox['dividers'] }> = [];
  const left = Math.min(...lifelines.map(l => l.centerX - l.boxW / 2));
  const right = Math.max(...lifelines.map(l => l.centerX + l.boxW / 2));

  let y = MARGIN_TOP + Math.max(...lifelines.map(l => l.boxH)) + 40;
  let depth = 0;

  const activate = (id: string) => {
    const line = byId.get(id);
    if (!line || openBars.has(id)) return;
    openBars.set(id, y);
  };

  const deactivate = (id: string) => {
    const line = byId.get(id);
    const start = openBars.get(id);
    if (!line || start === undefined) return;
    openBars.delete(id);
    activations.push({ x: line.centerX - 5, y: start - 6, h: Math.max(18, y - start + 12) });
  };

  for (const step of model.steps) {
    if (step.t === 'block') {
      if (step.action === 'start') {
        frames.push({ tag: step.tag, label: step.label, y: y - 14, depth, dividers: [] });
        depth += 1;
        y += ROW_H;
      } else if (step.action === 'divider') {
        const frame = frames[frames.length - 1];
        if (frame) frame.dividers.push({ y: y - 14, tag: step.tag, label: step.label });
        y += DIVIDER_H;
      } else {
        const frame = frames.pop();
        depth = Math.max(0, depth - 1);
        y += 18;
        if (frame) {
          const x = left - 34 + frame.depth * 8;
          const w = right - left + 68;
          shapes.push({
            kind: 'frame',
            x,
            y: frame.y,
            w,
            h: y - frame.y,
            tag: frame.tag,
            label: frame.label,
            depth: frame.depth,
            dividers: frame.dividers,
          });
        }
      }
      continue;
    }

    if (step.t === 'note') {
      const targets = step.ids.map(id => byId.get(id)).filter((l): l is Lifeline => Boolean(l));
      if (targets.length === 0) continue;
      const spanLeft = Math.min(...targets.map(t => t.centerX - t.boxW / 2));
      const spanRight = Math.max(...targets.map(t => t.centerX + t.boxW / 2));
      const w = Math.max(150, spanRight - spanLeft);
      const center = (spanLeft + spanRight) / 2;
      const lines = wrap(step.text, Math.max(18, Math.floor((w - 20) / CHAR_W)));
      shapes.push({
        kind: 'note',
        x: center - w / 2,
        y: y - NOTE_H + 6,
        w,
        h: NOTE_H + (lines.length - 1) * 16,
        lines,
      });
      y += NOTE_H + (lines.length - 1) * 16 + 8;
      continue;
    }

    if (step.t === 'activation') {
      if (step.on) activate(step.id);
      else deactivate(step.id);
      continue;
    }

    const from = byId.get(step.from);
    const to = byId.get(step.to);
    if (!from || !to) continue;

    if (step.activate) activate(step.to);
    if (step.deactivate) deactivate(step.to);

    if (from.id === to.id) {
      shapes.push({ kind: 'self', x: from.centerX, y, text: step.text, dashed: step.dashed, head: step.head });
      y += SELF_ROW_H;
    } else {
      shapes.push({
        kind: 'message',
        x1: from.centerX,
        x2: to.centerX,
        y,
        text: step.text,
        dashed: step.dashed,
        head: step.head,
      });
      y += ROW_H;
    }
  }

  // Close anything left open so a truncated document still renders sensibly.
  for (const id of [...openBars.keys()]) deactivate(id);

  const bottom = y + 20;
  for (const line of lifelines) line.bottom = bottom;

  return { width, height: bottom + 24, lifelines, shapes, activations };
}
