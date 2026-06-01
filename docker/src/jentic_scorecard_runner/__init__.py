"""Container runner for jentic-api-scorecard.

Stdout is reserved for the engine-verbatim scorecard JSON. The engine's
``jentic.apitools.common.utils.logging.get_module_logger`` lazily attaches
a stdout INFO handler when the root logger has none, and pipelines'
import chain triggers ``datadog.initialize`` at INFO level. Attaching a
NullHandler short-circuits that "no handlers exist" branch, and pinning
the root level to WARNING swallows the INFO records the import path
emits while still letting real warnings/errors through to stderr if a
handler ever is added downstream.
"""

import logging


logging.getLogger().addHandler(logging.NullHandler())
logging.getLogger().setLevel(logging.WARNING)
