"""Container exit codes per architecture doc §6."""

from enum import IntEnum


class ExitCode(IntEnum):
    SUCCESS = 0
    GENERIC_ERROR = 1
    AUTH_INVALID_KEY = 2
    GATE_REJECTED = 3
    SPEC_FAILURE = 5
    ENGINE_FAILURE = 6
