/**
 * fit.ts
 * The toolbar's "zoom to fit" reaches whichever canvas is mounted through this
 * callback contract, so ERD (React Flow) and the SVG canvases share one button.
 */

export type FitHandler = () => void;

export type FitRegistrar = (handler: FitHandler) => void;
