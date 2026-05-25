import { expect } from 'chai';

import { ExitCode } from '../src/exit-codes.ts';

// Public CLI contract per docs/architecture.md §6. Changing these breaks
// downstream automation, so the test asserts on exact numeric values.
describe('ExitCode', function () {
  it('locks the documented numeric mapping', function () {
    expect(ExitCode).to.deep.equal({
      SUCCESS: 0,
      GENERIC_ERROR: 1,
      AUTH_INVALID_KEY: 2,
      GATE_REJECTED: 3,
      DOCKER_MISSING: 4,
      SPEC_FAILURE: 5,
      ENGINE_FAILURE: 6,
    });
  });
});
