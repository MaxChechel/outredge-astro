/**
 * The MDX vocabulary, in one place (§4.5).
 *
 * The approved list is CLOSED per project: a new component appearing in a body
 * requires a ruling, and this file is where that ruling becomes real. Passing
 * this object to <Content components={...} /> is what makes a body able to use
 * them without importing anything.
 */
export { default as Figure } from './Figure.astro';
export { default as Clip } from './Clip.astro';
export { default as Lede } from './Lede.astro';
