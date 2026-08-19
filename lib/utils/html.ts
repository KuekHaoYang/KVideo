const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  hellip: '…',
  lt: '<',
  mdash: '—',
  middot: '·',
  nbsp: ' ',
  ndash: '–',
  gt: '>',
  quot: '"',
};

const HTML_ENTITY_PATTERN = /&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi;
const BLOCK_END_TAG_PATTERN = /<\/(?:p|div|li|h[1-6]|tr)>/gi;

function decodeHtmlEntity(match: string, entity: string): string {
  if (!entity.startsWith('#')) {
    return NAMED_HTML_ENTITIES[entity.toLowerCase()] ?? match;
  }

  const isHex = entity[1].toLowerCase() === 'x';
  const numberText = entity.slice(isHex ? 2 : 1);
  const codePoint = Number.parseInt(numberText, isHex ? 16 : 10);

  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return match;
  }

  return String.fromCodePoint(codePoint);
}

/**
 * Convert source-provided HTML descriptions or remarks to safe display text.
 * Tags are removed, common/numeric entities are decoded, and layout whitespace
 * is normalized without ever injecting markup into the React tree.
 */
export function htmlToText(value?: string | null): string {
  if (!value) return '';

  const withLineBreaks = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(BLOCK_END_TAG_PATTERN, '\n');
  const withoutTags = withLineBreaks.replace(/<[^>]*>/g, '');
  const decoded = withoutTags.replace(HTML_ENTITY_PATTERN, decodeHtmlEntity);

  return decoded
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
