import type { ImageMetadata } from 'astro';
import styles from '../../scripts/cover-styles.json';
import { AMBASSADOR } from './site';

// Every rendered expression in src/assets/ambassador[-female]/<name>.jpg (from scripts/generate-ambassador.mjs).
const male = import.meta.glob<{ default: ImageMetadata }>('../assets/ambassador/*.jpg', { eager: true });
const female = import.meta.glob<{ default: ImageMetadata }>('../assets/ambassador-female/*.jpg', { eager: true });
const dir = AMBASSADOR.variant === 'female' ? 'ambassador-female' : 'ambassador';
const files = AMBASSADOR.variant === 'female' ? female : male;

// Alt text describing what the female renders actually show.
const FEMALE_ALT: Record<string, string> = {
  proud: 'a warm, proud smile, her robotic hand resting on her chest',
  explaining: 'a friendly smile as she raises one chrome robotic finger to make a point',
  eager: 'a wide, eager smile',
  concerned: 'a worried, serious look',
  sceptical: 'a sceptical raised-brow look, unconvinced',
  surprised: 'wide-eyed surprise',
  apologetic: 'a sheepish, apologetic smile, her chrome hand raised to her head',
  thinking: 'looking up, deep in thought',
  alert: 'a serious look, her robotic hand raised in a stop gesture',
  amused: 'laughing warmly, her chrome robotic hand raised',
};

type Expressions = Record<string, { prompt: string; alt: string }>;
const library = styles.expressions as Expressions;

export interface Portrait {
  name: string;
  src: ImageMetadata;
  alt: string;
}

/** All expressions that have an image, in library order. */
export function getPortraits(): Portrait[] {
  return Object.keys(library).flatMap((name) => {
    const file = files[`../assets/${dir}/${name}.jpg`];
    const alt = AMBASSADOR.variant === 'female' ? `AI illustration: Art, our AI host, ${FEMALE_ALT[name] ?? library[name].alt}.` : `AI illustration: our butler, ${library[name].alt}.`;
    return file ? [{ name, src: file.default, alt }] : [];
  });
}

/** One expression, or undefined if it has not been rendered yet. */
export function getPortrait(name: string): Portrait | undefined {
  return getPortraits().find((p) => p.name === name);
}
