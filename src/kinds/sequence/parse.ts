/**
 * parse.ts
 * Mermaid-compatible subset of sequence diagrams:
 *
 *   sequenceDiagram
 *     participant A as Alice
 *     actor B
 *     A->>B: hello
 *     A->>+B: request
 *     B-->>-A: response
 *     Note over A,B: shared
 *     loop every minute
 *       A->>B: ping
 *     end
 *     alt ok
 *       A->>B: yes
 *     else failed
 *       A->>B: no
 *     end
 *
 * Arrows: ->>, -->>, ->, -->, -x, --x, -), --). `+`/`-` after the arrow
 * activates or deactivates the receiver. Blocks: loop/alt/opt/par/critical/
 * break, their else/and dividers, closed by `end`.
 */

import {
  DiagramParseError,
  type SequenceModel,
  type SequenceParticipant,
  type SequenceStep,
} from '../types';

const BLOCK_TAGS = /^(loop|alt|opt|par|critical|break|rect|else|and|end)\b\s*(.*)$/;

const NOTE = /^Note\s+(over|left of|right of)\s+([^:]+):\s*(.*)$/;

const PARTICIPANT = /^(participant|actor)\s+([\w$]+)(?:\s+as\s+(.+))?$/;

const MESSAGE = /^([\w$]+)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-]?)\s*([\w$]+)\s*:\s*(.*)$/;

interface Builder {
  participants: SequenceParticipant[];
  steps: SequenceStep[];
  aliases: Map<string, string>;
  index: Map<string, SequenceParticipant>;
}

function declare(b: Builder, id: string, label: string, actor = false): SequenceParticipant {
  const existing = b.index.get(id);
  if (existing) {
    if (label !== id) existing.label = label;
    if (actor) existing.actor = true;
    return existing;
  }
  const participant: SequenceParticipant = { id, label, actor };
  b.participants.push(participant);
  b.index.set(id, participant);
  return participant;
}

/** Mermaid creates a participant on first mention, so users can skip declarations. */
function touch(b: Builder, raw: string): string {
  const id = b.aliases.get(raw) ?? raw;
  if (!b.index.has(id)) declare(b, id, id);
  return id;
}

export function parseSequence(source: string): SequenceModel {
  const b: Builder = { participants: [], steps: [], aliases: new Map(), index: new Map() };
  const lines = source.split('\n');
  let opened = false;
  const blocks: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (!opened) {
      if (trimmed !== 'sequenceDiagram') {
        throw new DiagramParseError('Sequence diagrams must start with "sequenceDiagram"', lineNo);
      }
      opened = true;
      continue;
    }

    if (trimmed === 'autonumber' || trimmed.startsWith('autonumber ')) continue;

    const decl = trimmed.match(PARTICIPANT);
    if (decl) {
      const id = decl[2];
      const label = decl[3]?.trim() || id;
      b.aliases.set(id, id);
      declare(b, id, label, decl[1] === 'actor');
      continue;
    }

    const block = trimmed.match(BLOCK_TAGS);
    if (block) {
      const tag = block[1];
      if (tag === 'end') {
        if (blocks.length === 0) {
          throw new DiagramParseError('"end" without an open block', lineNo);
        }
        blocks.pop();
        b.steps.push({ t: 'block', action: 'end', tag: '', label: '' });
      } else if (tag === 'else' || tag === 'and') {
        if (blocks.length === 0) {
          throw new DiagramParseError(`"${tag}" outside a block`, lineNo);
        }
        b.steps.push({ t: 'block', action: 'divider', tag, label: block[2].trim() });
      } else {
        blocks.push(lineNo);
        b.steps.push({ t: 'block', action: 'start', tag, label: block[2].trim() });
      }
      continue;
    }

    const note = trimmed.match(NOTE);
    if (note) {
      const placement = note[1];
      const ids = note[2].split(',').map(s => touch(b, s.trim()));
      b.steps.push({
        t: 'note',
        placement: placement === 'over' ? 'over' : placement === 'left of' ? 'left' : 'right',
        ids,
        text: note[3].trim(),
      });
      continue;
    }

    const activation = trimmed.match(/^(activate|deactivate)\s+([\w$]+)$/);
    if (activation) {
      b.steps.push({ t: 'activation', id: touch(b, activation[2]), on: activation[1] === 'activate' });
      continue;
    }

    const msg = trimmed.match(MESSAGE);
    if (msg) {
      const [, fromRaw, op, marker, toRaw, text] = msg;
      b.steps.push({
        t: 'message',
        from: touch(b, fromRaw),
        to: touch(b, toRaw),
        text: text.trim(),
        dashed: op.startsWith('--'),
        head: op.endsWith('x') ? 'cross' : op.endsWith(')') ? 'open' : 'filled',
        activate: marker === '+',
        deactivate: marker === '-',
      });
      continue;
    }

    throw new DiagramParseError(`Unrecognised sequence statement: ${trimmed}`, lineNo);
  }

  if (!opened) throw new DiagramParseError('Sequence diagrams must start with "sequenceDiagram"', 1);
  if (blocks.length > 0) {
    throw new DiagramParseError('Unclosed block: missing "end"', blocks[blocks.length - 1]);
  }

  return { participants: b.participants, steps: b.steps };
}
