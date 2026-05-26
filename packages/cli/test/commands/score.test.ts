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
        expect(result.stderr).to.include('engine output was not valid JSON');
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
});
