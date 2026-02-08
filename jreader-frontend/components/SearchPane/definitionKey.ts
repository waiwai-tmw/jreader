/**
 * DefinitionKey: A branded string type for dictionary definition selection keys.
 *
 * Always includes: dictionaryTitle#revision#termGroupIndex#layerIndex
 * This ensures the key is consistent across initialization, checkbox handling, mining creation, and spoiler state.
 * The layerIndex makes each key unique to its search layer/recursive search level.
 */

export type DefinitionKey = string & { readonly __brand: 'DefinitionKey' };

export type DefinitionKeyParts = {
  dictionaryTitle: string;
  revision: string;
  termGroupIndex: number;
  layerIndex: number;
};

const SEP = '#';

/**
 * Create a DefinitionKey from its components.
 * This is the single source of truth for the key format.
 */
export function makeDefinitionKey(parts: DefinitionKeyParts): DefinitionKey {
  return `${parts.dictionaryTitle}${SEP}${parts.revision}${SEP}${parts.termGroupIndex}${SEP}${parts.layerIndex}` as DefinitionKey;
}

/**
 * Parse a DefinitionKey back into its components.
 */
export function parseDefinitionKey(key: string): DefinitionKeyParts {
  const parts = key.split(SEP);

  if (parts.length !== 4) {
    throw new Error(`Invalid DefinitionKey format: ${key}. Expected 4 parts separated by '${SEP}'`);
  }

  const [dictionaryTitle, revision, termGroupIndexStr, layerIndexStr] = parts;
  const termGroupIndex = Number(termGroupIndexStr);
  const layerIndex = Number(layerIndexStr);

  if (!dictionaryTitle || !revision || !Number.isInteger(termGroupIndex) || !Number.isInteger(layerIndex)) {
    throw new Error(`Invalid DefinitionKey components: dictionaryTitle=${dictionaryTitle}, revision=${revision}, termGroupIndex=${termGroupIndex}, layerIndex=${layerIndex}`);
  }

  return { dictionaryTitle, revision, termGroupIndex, layerIndex };
}

/**
 * Compare two DefinitionKeys for equality.
 */
export function equalDefinitionKey(a: DefinitionKey, b: DefinitionKey): boolean {
  return a === b;
}

export const definitionKey = {
  make: makeDefinitionKey,
  parse: parseDefinitionKey,
  equals: equalDefinitionKey,
};

/**
 * AudioSelectionKey: A branded string type for audio source selection keys.
 * Format: termGroupIndex#layerIndex
 * This identifies which audio source is selected for a specific term group in a search layer.
 */
export type AudioSelectionKey = string & { readonly __brand: 'AudioSelectionKey' };

export type AudioSelectionKeyParts = {
  termGroupIndex: number;
  layerIndex: number;
};

export function makeAudioSelectionKey(parts: AudioSelectionKeyParts): AudioSelectionKey {
  return `${parts.termGroupIndex}${SEP}${parts.layerIndex}` as AudioSelectionKey;
}

export function parseAudioSelectionKey(key: string): AudioSelectionKeyParts {
  const parts = key.split(SEP);

  if (parts.length !== 2) {
    throw new Error(`Invalid AudioSelectionKey format: ${key}. Expected 2 parts separated by '${SEP}'`);
  }

  const [termGroupIndexStr, layerIndexStr] = parts;
  const termGroupIndex = Number(termGroupIndexStr);
  const layerIndex = Number(layerIndexStr);

  if (!Number.isInteger(termGroupIndex) || !Number.isInteger(layerIndex)) {
    throw new Error(`Invalid AudioSelectionKey components: termGroupIndex=${termGroupIndex}, layerIndex=${layerIndex}`);
  }

  return { termGroupIndex, layerIndex };
}

export const audioSelectionKey = {
  make: makeAudioSelectionKey,
  parse: parseAudioSelectionKey,
};
