import { expect } from 'chai';

import { DEFAULT_FORMAT, FORMATS, Format } from '../src/format.ts';

// The set of --format choices is public CLI surface; locking it guards against
// accidental removal/rename of a documented encoding.
describe('Format', function () {
  it('exposes pretty, json, and html', function () {
    expect(Format).to.deep.equal({ PRETTY: 'pretty', JSON: 'json', HTML: 'html' });
  });

  it('lists every format as a selectable choice', function () {
    expect([...FORMATS]).to.have.members(['pretty', 'json', 'html']);
  });

  it('defaults to pretty', function () {
    expect(DEFAULT_FORMAT).to.equal('pretty');
  });
});
