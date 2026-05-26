import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { tryParseEngineOutput } from '../../src/commands/score.ts';
import { ExitCode } from '../../src/exit-codes.ts';
import { Format } from '../../src/format.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixtureRaw = readFileSync(fixturePath, 'utf8');

describe('tryParseEngineOutput', function () {
  describe('valid JSON', function () {
    it('parses successfully under Format.JSON', function () {
      const result = tryParseEngineOutput(fixtureRaw, Format.JSON);
      expect(result.ok).to.equal(true);
      if (result.ok) {
        expect(result.parsed.summary).to.be.an('object');
      }
    });

    it('parses successfully under Format.PRETTY', function () {
      const result = tryParseEngineOutput(fixtureRaw, Format.PRETTY);
      expect(result.ok).to.equal(true);
    });
  });

  describe('invalid JSON under Format.JSON', function () {
    it('returns ENGINE_FAILURE with a stderr message and no stdout passthrough', function () {
      const result = tryParseEngineOutput('not json', Format.JSON);
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.exitCode).to.equal(ExitCode.ENGINE_FAILURE);
        expect(result.stderr).to.match(/^error:/);
        expect(result.stderr).to.include('engine output was not a valid scorecard');
        expect(result.stdout).to.equal('');
      }
    });

    it('escalates even when the bad output looks superficially structured', function () {
      const result = tryParseEngineOutput('{ "summary": ', Format.JSON);
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.exitCode).to.equal(ExitCode.ENGINE_FAILURE);
      }
    });
  });

  describe('invalid JSON under Format.PRETTY', function () {
    it('returns SUCCESS with a warning and the raw stdout passthrough', function () {
      const raw = 'engine emitted a plain-text traceback instead of JSON';
      const result = tryParseEngineOutput(raw, Format.PRETTY);
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.exitCode).to.equal(ExitCode.SUCCESS);
        expect(result.stderr).to.match(/^warning:/);
        expect(result.stderr).to.include('passing through raw output');
        expect(result.stdout).to.equal(raw);
      }
    });
  });

  describe('syntactically valid JSON that is not a scorecard', function () {
    const nonScorecards = [
      ['number', '42'],
      ['string', '"hi"'],
      ['boolean', 'true'],
      ['null', 'null'],
      ['array', '[1,2,3]'],
      ['object missing summary', '{"summary_typo":{}}'],
      ['object with non-object summary', '{"summary":"oops"}'],
      ['object with array summary', '{"summary":[]}'],
      ['object with empty summary', '{"summary":{}}'],
      ['summary missing score', '{"summary":{"level":"AI-AWARE","grade":"B"}}'],
      ['summary missing level', '{"summary":{"score":67,"grade":"B"}}'],
      ['summary missing grade', '{"summary":{"score":67,"level":"AI-AWARE"}}'],
      ['summary score wrong type', '{"summary":{"score":"67","level":"AI-AWARE","grade":"B"}}'],
      ['summary level wrong type', '{"summary":{"score":67,"level":1,"grade":"B"}}'],
      ['summary grade wrong type', '{"summary":{"score":67,"level":"AI-AWARE","grade":null}}'],
    ] as const;

    for (const [label, raw] of nonScorecards) {
      it(`escalates ${label} to ENGINE_FAILURE under Format.JSON`, function () {
        const result = tryParseEngineOutput(raw, Format.JSON);
        expect(result.ok).to.equal(false);
        if (!result.ok) {
          expect(result.exitCode).to.equal(ExitCode.ENGINE_FAILURE);
          expect(result.stdout).to.equal('');
        }
      });

      it(`falls back ${label} to raw passthrough under Format.PRETTY`, function () {
        const result = tryParseEngineOutput(raw, Format.PRETTY);
        expect(result.ok).to.equal(false);
        if (!result.ok) {
          expect(result.exitCode).to.equal(ExitCode.SUCCESS);
          expect(result.stdout).to.equal(raw);
        }
      });
    }
  });
});
