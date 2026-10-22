/**
 * fieldHover.ts
 * Hover plumbing between table field rows (TableNode) and relation edges.
 *
 * Split into a stable setter context and a value context so hovering does not
 * re-render every field row in the canvas.
 */

import { createContext, useContext } from 'react';

export type SetHoveredField = (fieldId: string | null) => void;

/** Field id (`${tableId}.${fieldName}`) currently under the pointer. */
export const HoveredFieldContext = createContext<string | null>(null);

/** Setter for the hovered field; identity is stable across renders. */
export const SetHoveredFieldContext = createContext<SetHoveredField>(() => {});

/**
 * Ids of the relations touching the hovered field, or `null` when no field is
 * hovered (or the hovered field has no relations). Edges use this to decide
 * between idle, active and dimmed rendering.
 */
export const ActiveEdgesContext = createContext<ReadonlySet<string> | null>(null);

export const useHoveredField = () => useContext(HoveredFieldContext);
export const useSetHoveredField = () => useContext(SetHoveredFieldContext);
export const useActiveEdges = () => useContext(ActiveEdgesContext);
