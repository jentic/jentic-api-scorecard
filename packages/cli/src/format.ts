export const Format = {
  PRETTY: 'pretty',
  JSON: 'json',
  HTML: 'html',
  MARKDOWN: 'markdown',
} as const;

export type Format = (typeof Format)[keyof typeof Format];

export const FORMATS: readonly Format[] = [
  Format.PRETTY,
  Format.JSON,
  Format.HTML,
  Format.MARKDOWN,
];

export const DEFAULT_FORMAT: Format = Format.PRETTY;
