import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv } from 'ajv';
import { expect } from 'chai';

const HELPER = fileURLToPath(new URL('../../../../action/postprocess.mjs', import.meta.url));
const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = readFileSync(fixturePath, 'utf8');
const schemaPath = fileURLToPath(new URL('../fixtures/sarif-2.1.0.schema.json', import.meta.url));
const sarifSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

interface SarifResult {
  level: string;
  locations?: { physicalLocation?: { artifactLocation: { uri: string } } }[];
}
interface SarifLog {
  runs: { results: SarifResult[] }[];
}

interface RunResult {
  status: number | null;
  stdout: string;
  sarif: SarifLog;
  html: string;
  markdown: string;
  outputs: Record<string, string>;
}

// Drive the action helper exactly as action.yml does: a subprocess fed env vars
// and a captured report.json, asserting on the files and GITHUB_OUTPUT it writes.
// This black-boxes the whole pipeline (gate + SARIF filter/cap + physical
// locations + HTML/Markdown) rather than its internal functions; the helper's
// imported formatters resolve from the built workspace, so the suite runs after
// `npm run build` (as CI does).
function runPostprocess(env: Record<string, string>, reportJson = fixture): RunResult {
  const dir = mkdtempSync(join(tmpdir(), 'postprocess-'));
  try {
    writeFileSync(join(dir, 'report.json'), reportJson);
    const outputPath = join(dir, 'gh_output');
    writeFileSync(outputPath, '');
    const summaryPath = join(dir, 'step_summary');
    writeFileSync(summaryPath, '');

    const result = spawnSync(process.execPath, [HELPER], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        REPORT_JSON: join(dir, 'report.json'),
        SARIF_PATH: join(dir, 'report.sarif'),
        HTML_PATH: join(dir, 'scorecard.html'),
        MARKDOWN_PATH: join(dir, 'scorecard.md'),
        GITHUB_OUTPUT: outputPath,
        GITHUB_STEP_SUMMARY: summaryPath,
        ...env,
      },
    });

    const outputs: Record<string, string> = {};
    for (const line of readFileSync(outputPath, 'utf8').split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) outputs[line.slice(0, eq)] = line.slice(eq + 1);
    }

    return {
      status: result.status,
      stdout: result.stdout,
      sarif: JSON.parse(readFileSync(join(dir, 'report.sarif'), 'utf8')) as SarifLog,
      html: readFileSync(join(dir, 'scorecard.html'), 'utf8'),
      markdown: readFileSync(join(dir, 'scorecard.md'), 'utf8'),
      outputs,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function allResults(sarif: SarifLog): SarifResult[] {
  return sarif.runs.flatMap((run) => run.results);
}

describe('postprocess helper (black-box)', function () {
  // Subprocess + ESM formatter imports per case; generous headroom over the 2s default.
  this.timeout(30_000);

  describe('outputs', function () {
    let run: RunResult;

    before(function () {
      run = runPostprocess({ INPUT: './openapi.yaml', SEVERITY: 'note' });
    });

    it('exits 0 — the helper never fails the build itself', function () {
      expect(run.status).to.equal(0);
    });

    it('writes SARIF, HTML, and Markdown from the single capture', function () {
      expect(run.sarif.runs).to.be.an('array').that.is.not.empty;
      expect(run.html).to.contain('<html');
      expect(run.markdown).to.contain('# API Readiness Scorecard');
    });

    it('emits SARIF that validates against the SARIF 2.1.0 schema', function () {
      const ajv = new Ajv({ strict: false, allErrors: true, logger: false });
      const validate = ajv.compile(sarifSchema);
      expect(validate(run.sarif), JSON.stringify(validate.errors?.slice(0, 3))).to.equal(true);
    });

    it('gives every SARIF result a physical location so code-scanning ingests it', function () {
      const results = allResults(run.sarif);
      expect(results).to.not.be.empty;
      for (const result of results) {
        expect(result.locations?.[0]?.physicalLocation?.artifactLocation.uri).to.equal(
          'openapi.yaml',
        );
      }
    });
  });

  describe('gate decision (via GITHUB_OUTPUT)', function () {
    // The fixture scores 66.52 with 2 error-level (severity 1) and 8 warning-level
    // (severity 2) diagnostics.
    it('passes when no gate inputs are set', function () {
      expect(runPostprocess({}).outputs['gate-passed']).to.equal('true');
    });

    it('fails when the score is strictly below min-score', function () {
      const run = runPostprocess({ MIN_SCORE: '67' });
      expect(run.outputs['gate-passed']).to.equal('false');
      expect(run.outputs['gate-reasons']).to.contain('below min-score 67');
    });

    it('passes when the score equals min-score (guards against <=)', function () {
      const exact = JSON.stringify({
        summary: { score: 70, level: 'x', grade: 'C' },
        diagnostics: [],
      });
      expect(runPostprocess({ MIN_SCORE: '70' }, exact).outputs['gate-passed']).to.equal('true');
    });

    it('passes when the score is above min-score', function () {
      expect(runPostprocess({ MIN_SCORE: '50' }).outputs['gate-passed']).to.equal('true');
    });

    it('fails when error-level findings exceed max-errors, counting the full diagnostics', function () {
      // max-errors: 0 must trip — the real engine capture carries severity-1
      // diagnostics, so this is a gate that can actually fire, not a no-op.
      const run = runPostprocess({ MAX_ERRORS: '0' });
      expect(run.outputs['gate-passed']).to.equal('false');
      expect(run.outputs['gate-reasons']).to.contain('max-errors 0');
    });

    it('fails when warning-level findings exceed max-warnings', function () {
      const run = runPostprocess({ MAX_WARNINGS: '5' });
      expect(run.outputs['gate-passed']).to.equal('false');
      expect(run.outputs['gate-reasons']).to.contain('max-warnings 5');
    });

    it('counts max-errors/max-warnings against the full diagnostics, not the filtered SARIF', function () {
      // severity=error hides warnings from the SARIF, but they must still gate.
      const run = runPostprocess({ SEVERITY: 'error', MAX_WARNINGS: '5' });
      expect(run.outputs['gate-passed']).to.equal('false');
      expect(run.outputs['gate-reasons']).to.contain('max-warnings 5');
    });

    it('passes when counts are within limits', function () {
      expect(
        runPostprocess({ MAX_ERRORS: '2', MAX_WARNINGS: '8' }).outputs['gate-passed'],
      ).to.equal('true');
    });

    it('fails closed on a malformed numeric input rather than silently skipping the gate', function () {
      // A typo'd threshold must not pass — it would otherwise null out and disable
      // the gate the author thought they set.
      const run = runPostprocess({ MIN_SCORE: '70x' });
      expect(run.outputs['gate-passed']).to.equal('false');
      expect(run.outputs['gate-reasons']).to.contain('min-score is not a number');
    });

    it('still produces SARIF/HTML/Markdown when an input is malformed', function () {
      const run = runPostprocess({ MIN_SCORE: '70x', SEVERITY: 'note' });
      expect(run.sarif.runs).to.be.an('array').that.is.not.empty;
      expect(run.html).to.contain('<html');
      expect(run.markdown).to.contain('# API Readiness Scorecard');
    });
  });

  describe('SARIF severity filter', function () {
    it('keeps only error-level results when severity is error', function () {
      const levels = new Set(
        allResults(runPostprocess({ SEVERITY: 'error' }).sarif).map((r) => r.level),
      );
      expect([...levels]).to.deep.equal(['error']);
    });

    it('keeps error and warning when severity is warning', function () {
      const levels = new Set(
        allResults(runPostprocess({ SEVERITY: 'warning' }).sarif).map((r) => r.level),
      );
      expect([...levels].sort()).to.deep.equal(['error', 'warning']);
    });

    it('keeps notes too when severity is note', function () {
      const levels = new Set(
        allResults(runPostprocess({ SEVERITY: 'note' }).sarif).map((r) => r.level),
      );
      expect(levels.has('note')).to.equal(true);
    });
  });

  describe('max-findings cap', function () {
    it('caps the SARIF results and reports the dropped count', function () {
      const run = runPostprocess({ SEVERITY: 'note', MAX_FINDINGS: '5' });
      expect(allResults(run.sarif)).to.have.lengthOf(5);
      expect(run.stdout).to.contain('capped at max-findings 5');
    });

    it('drops lowest-severity-first, keeping errors and warnings', function () {
      // The fixture has 2 error + 8 warning + 24 note (34 total). Capping to 5
      // drops notes first, so only errors/warnings survive.
      const levels = allResults(runPostprocess({ SEVERITY: 'note', MAX_FINDINGS: '5' }).sarif).map(
        (r) => r.level,
      );
      expect(levels.filter((l) => l === 'note')).to.have.lengthOf(0);
      expect(levels.filter((l) => l === 'error')).to.have.lengthOf(2);
    });
  });

  describe('summary-detail', function () {
    // summary-detail controls only the Markdown run-summary depth; the capture is
    // always --detail diagnostics so SARIF/HTML are never starved.
    it('omits the per-signal section at the default dimensions depth', function () {
      const md = runPostprocess({ SUMMARY_DETAIL: 'dimensions' }).markdown;
      expect(md).to.contain('## Dimensions');
      expect(md).to.not.contain('## Signals');
    });

    it('includes the per-signal section at signals depth', function () {
      const md = runPostprocess({ SUMMARY_DETAIL: 'signals' }).markdown;
      expect(md).to.contain('## Signals');
    });
  });
});
