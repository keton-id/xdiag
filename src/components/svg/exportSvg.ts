/**
 * exportSvg.ts
 * Turns the mounted SVG canvas into a standalone file. CSS custom properties
 * and `color-mix()` do not survive serialization, so computed paint values are
 * baked in as attributes while cloning.
 */

const PAINT_ATTRS = ['fill', 'stroke', 'stop-color', 'color'] as const;

export function canvasSvgMarkup(): string | null {
  const source = document.querySelector<SVGSVGElement>('svg[data-canvas-svg]');
  if (!source) return null;

  const width = Number(source.dataset.svgWidth);
  const height = Number(source.dataset.svgHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const clone = source.cloneNode(true) as SVGSVGElement;
  const sourceNodes = [source, ...source.querySelectorAll('*')];
  const cloneNodes = [clone, ...clone.querySelectorAll('*')];

  // Index 0 is the root: it carries layout, not paint.
  sourceNodes.forEach((node, i) => {
    const target = cloneNodes[i];
    if (!target) return;
    if (i > 0) {
      const computed = getComputedStyle(node);
      for (const attr of PAINT_ATTRS) {
        const value = computed.getPropertyValue(attr);
        if (value && value !== 'none') target.setAttribute(attr, value);
      }
    }
    target.removeAttribute('class');
  });

  for (const frame of clone.querySelectorAll('g[transform]')) frame.removeAttribute('transform');

  for (const attr of ['data-canvas-svg', 'data-svg-width', 'data-svg-height']) {
    clone.removeAttribute(attr);
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(Math.ceil(width)));
  clone.setAttribute('height', String(Math.ceil(height)));
  clone.setAttribute('viewBox', `0 0 ${Math.ceil(width)} ${Math.ceil(height)}`);

  return new XMLSerializer().serializeToString(clone);
}

export function downloadText(content: string, filename: string, mime = 'text/plain'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
