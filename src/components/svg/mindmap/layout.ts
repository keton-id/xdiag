/**
 * layout.ts
 * Right-side tree layout for mindmaps: leaves stack, parents centre on their
 * children, subtrees get a depth-based colour index.
 */

import type { MindNode } from '../../../kinds/types';

const CHAR_W = 7.2;
const LEVEL_GAP = 72;
const SIBLING_GAP = 18;
const MARGIN = 40;
const NODE_H = 36;

export interface PlacedMind extends Omit<MindNode, 'children'> {
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  children: PlacedMind[];
}

export interface MindLink {
  d: string;
  depth: number;
}

export interface MindLayout {
  width: number;
  height: number;
  root: PlacedMind | null;
  links: MindLink[];
}

function measure(node: MindNode): { w: number; h: number } {
  const textW = node.label.length * CHAR_W;
  const w = Math.max(80, textW + (node.shape === 'circle' ? 40 : 40));
  return { w, h: node.shape === 'circle' ? w : NODE_H };
}

export function layoutMindmap(root: MindNode | null): MindLayout {
  if (!root) return { width: 0, height: 0, root: null, links: [] };

  const sizes = new Map<string, { w: number; h: number }>();
  const measureAll = (node: MindNode) => {
    sizes.set(node.id, measure(node));
    node.children.forEach(measureAll);
  };
  measureAll(root);

  const subtree = new Map<string, number>();
  const heightOf = (node: MindNode): number => {
    const size = sizes.get(node.id) ?? { w: 0, h: 0 };
    const kids = node.children;
    const childTotal = kids.reduce((sum, c) => sum + heightOf(c), 0) + SIBLING_GAP * Math.max(0, kids.length - 1);
    const h = Math.max(size.h, childTotal);
    subtree.set(node.id, h);
    return h;
  };
  heightOf(root);

  const depthWidth = new Map<number, number>();
  const collectDepthWidth = (node: MindNode, depth: number) => {
    const size = sizes.get(node.id) ?? { w: 0, h: 0 };
    depthWidth.set(depth, Math.max(depthWidth.get(depth) ?? 0, size.w));
    node.children.forEach(c => collectDepthWidth(c, depth + 1));
  };
  collectDepthWidth(root, 0);

  const columnX = new Map<number, number>();
  let cursorX = MARGIN;
  for (let depth = 0; depth < depthWidth.size; depth++) {
    columnX.set(depth, cursorX);
    cursorX += (depthWidth.get(depth) ?? 0) + LEVEL_GAP;
  }
  const width = cursorX - LEVEL_GAP + MARGIN;

  const links: MindLink[] = [];

  const place = (node: MindNode, depth: number, top: number): PlacedMind => {
    const lg = depth === 0 ? 0 : Math.min(LEVEL_GAP * 0.45, 40);
    const x = (columnX.get(depth) ?? MARGIN) - lg;
    const size = sizes.get(node.id) ?? { w: 0, h: 0 };
    const selfH = subtree.get(node.id) ?? size.h;
    const childH = node.children.reduce((sum, c) => sum + (subtree.get(c.id) ?? 0), 0) + SIBLING_GAP * Math.max(0, node.children.length - 1);

    const y = node.children.length === 0 ? top : top + (childH - size.h) / 2;
    const children: PlacedMind[] = [];
    let childTop = top + (selfH - childH) / 2;

    for (const child of node.children) {
      const placedChild = place(child, depth + 1, childTop);
      children.push(placedChild);
      const childSize = sizes.get(child.id) ?? { w: 0, h: 0 };
      const x1 = x + size.w;
      const y1 = y + size.h / 2;
      const x2 = placedChild.x;
      const y2 = placedChild.y + childSize.h / 2;
      const mid = x1 + (x2 - x1) * 0.55;
      links.push({ d: `M${x1},${y1} C${mid},${y1} ${x2 - (x2 - mid)},${y2} ${x2},${y2}`, depth });
      childTop += (subtree.get(child.id) ?? 0) + SIBLING_GAP;
    }

    return {
      id: node.id,
      label: node.label,
      shape: node.shape,
      x,
      y,
      w: size.w,
      h: size.h,
      depth,
      children,
    };
  };

  const placedRoot = place(root, 0, MARGIN);
  const height = subtree.get(root.id) ?? NODE_H;
  return { width, height: height + MARGIN * 2, root: placedRoot, links };
}
