// Stage 1: semantic Blueprint construction only. Create node/pin records and
// reciprocal links; do not call arrangement or decoration from this module.
export { mkPin, linkPins } from './generator.js';
export {
  createCallFunction, createOperator, createMacroInstance, createStructNode,
  createSequence, createSwitch, createVariableGet, createBranch, createKnot,
  createGeneric, createCast, createFromEntry, createComment,
} from './generator.js';
export * from './modules.js';
