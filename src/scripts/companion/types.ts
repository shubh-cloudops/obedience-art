/** Expressions every version of Art understands (page elements use them in data-art="..."). */
export type Expression =
  | 'neutral' | 'explaining' | 'proud' | 'eager' | 'concerned' | 'sceptical'
  | 'surprised' | 'apologetic' | 'thinking' | 'alert' | 'amused';

/** What the controller needs from a character, whatever it is drawn with. */
export interface Character {
  express(e: Expression): void;
  wave(seconds?: number): void;
  talk(seconds: number): void;
  setWalking(dir: -1 | 0 | 1): void;
  lookAt(x: number, y: number): void;
  resize(w: number, h: number): void;
  tick(): void;
  readonly renderer: { setAnimationLoop(fn: (() => void) | null): void };
}
