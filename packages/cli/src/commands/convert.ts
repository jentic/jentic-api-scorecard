import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DEFAULT_DETAIL, DetailLevel, filterByDetail } from '../detail.ts';
import { ExitCode } from '../exit-codes.ts';
import { DEFAULT_FORMAT, Format } from '../format.ts';
import { formatHtml } from '../formatters/html.ts';
import { formatJson } from '../formatters/json.ts';
import { formatMarkdown } from '../formatters/markdown.ts';
import { formatPretty } from '../formatters/pretty.ts';
import { formatSarif } from '../formatters/sarif.ts';
import { writeReport } from '../output.ts';
import { ScorecardResult } from '../result.ts';

export interface ConvertOptions {
  from: string;
  detail?: DetailLevel;
  format?: Format;
  output?: string;
  ignoreCodes?: string;
}

function isScorecardShape(value: unknown): value is ScorecardResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (!('summary' in value)) return false;
  const summary = (value as { summary: unknown }).summary;
  if (typeof summary !== 'object' || summary === null || Array.isArray(summary)) return false;
  const s = summary as { score?: unknown; level?: unknown; grade?: unknown };
  return typeof s.score === 'number' && typeof s.level === 'string' && typeof s.grade === 'string';
}

export function runConvert(options: ConvertOptions): number {
  const absPath = resolve(options.from);

  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: cannot read '${options.from}': ${message}\n`);
    return ExitCode.GENERIC_ERROR;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    process.stderr.write(`error: '${options.from}' is not valid JSON.\n`);
    return ExitCode.GENERIC_ERROR;
  }

  if (!isScorecardShape(value)) {
    process.stderr.write(
      `error: '${options.from}' does not look like a scorecard JSON file.\n` +
        `  Produce one with: jentic-api-scorecard score … --format json --detail diagnostics -o report.json\n`,
    );
    return ExitCode.GENERIC_ERROR;
  }

  const parsed: ScorecardResult = { ...value };

  if (options.ignoreCodes) {
    const ignored = new Set(
      options.ignoreCodes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (ignored.size > 0 && parsed.diagnostics) {
      parsed.diagnostics = parsed.diagnostics.filter((d) => !ignored.has(d.code ?? ''));
    }
  }

  const detail = options.detail ?? DEFAULT_DETAIL;
  const format = options.format ?? DEFAULT_FORMAT;

  const filtered = filterByDetail(parsed, detail);
  const output =
    format === Format.HTML
      ? formatHtml(filtered)
      : format === Format.JSON
        ? formatJson(filtered)
        : format === Format.MARKDOWN
          ? formatMarkdown(filtered, { detail })
          : format === Format.SARIF
            ? formatSarif(parsed)
            : formatPretty(filtered, options.from, { detail });

  if (options.output !== undefined) {
    try {
      writeReport(output, options.output, format);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: ${message}\n`);
      return ExitCode.GENERIC_ERROR;
    }
  } else {
    process.stdout.write(output);
  }

  return ExitCode.SUCCESS;
}
