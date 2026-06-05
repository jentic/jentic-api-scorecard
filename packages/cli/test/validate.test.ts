import { expect } from 'chai';

import { Format } from '../src/format.ts';
import { validateScoreOptions } from '../src/validate.ts';

describe('validateScoreOptions', function () {
  it('rejects --format html to a TTY without -o', function () {
    const error = validateScoreOptions({ format: Format.HTML }, true);
    expect(error).to.be.a('string');
    expect(error).to.contain('--format html');
  });

  it('allows --format html when stdout is piped (not a TTY)', function () {
    expect(validateScoreOptions({ format: Format.HTML }, false)).to.equal(null);
  });

  it('allows --format html to a TTY when -o is set', function () {
    expect(validateScoreOptions({ format: Format.HTML, output: 'out.html' }, true)).to.equal(null);
  });

  it('never blocks pretty or json, even to a TTY', function () {
    expect(validateScoreOptions({ format: Format.PRETTY }, true)).to.equal(null);
    expect(validateScoreOptions({ format: Format.JSON }, true)).to.equal(null);
  });
});
