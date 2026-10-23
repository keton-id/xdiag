/**
 * usePanZoom.ts
 * Pan/zoom state shared by the SVG canvases (sequence, flowchart, mindmap).
 * Keeps the content in a <g transform="translate(x,y) scale(k)">.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewTransform {
  x: number;
  y: number;
  k: number;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

export interface PanZoom {
  hostRef: React.RefObject<HTMLDivElement | null>;
  view: ViewTransform;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Frame a content box of `width`×`height` inside the host. */
  fit: (width: number, height: number) => void;
}

function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));
}

export function usePanZoom(): PanZoom {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const content = useRef({ width: 0, height: 0 });

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView(v => {
      const k = clampZoom(v.k * factor);
      const scale = k / v.k;
      return { k, x: px - (px - v.x) * scale, y: py - (py - v.y) * scale };
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const fit = useCallback((width: number, height: number) => {
    content.current = { width, height };
    const host = hostRef.current;
    if (!host || width <= 0 || height <= 0) return;
    const rect = host.getBoundingClientRect();
    const k = clampZoom(Math.min((rect.width - 64) / width, (rect.height - 64) / height));
    setView({
      k,
      x: (rect.width - width * k) / 2,
      y: (rect.height - height * k) / 2,
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
  }, [view.x, view.y]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const start = origin.current;
    if (!start) return;
    setView(v => ({ ...v, x: start.vx + (e.clientX - start.x), y: start.vy + (e.clientY - start.y) }));
  }, []);

  const onPointerUp = useCallback(() => {
    origin.current = null;
    setDragging(false);
  }, []);

  const hostCenter = useCallback(() => {
    const host = hostRef.current;
    if (!host) return { x: 0, y: 0 };
    const rect = host.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }, []);

  const zoomIn = useCallback(() => {
    const c = hostCenter();
    zoomAt(1.2, c.x, c.y);
  }, [hostCenter, zoomAt]);

  const zoomOut = useCallback(() => {
    const c = hostCenter();
    zoomAt(1 / 1.2, c.x, c.y);
  }, [hostCenter, zoomAt]);

  const reset = useCallback(() => {
    const { width, height } = content.current;
    if (width > 0) fit(width, height);
    else setView({ x: 0, y: 0, k: 1 });
  }, [fit]);

  return { hostRef, view, dragging, onPointerDown, onPointerMove, onPointerUp, zoomIn, zoomOut, reset, fit };
}
