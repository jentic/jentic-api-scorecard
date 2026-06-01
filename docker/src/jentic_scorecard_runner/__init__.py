"""Container runner for jentic-api-scorecard.

Stdout is reserved for the engine-verbatim scorecard JSON. The engine's
``jentic.apitools.common.utils.logging.get_module_logger`` lazily attaches
a stdout INFO handler when the root logger has none, and pipelines'
import chain triggers ``datadog.initialize`` at INFO level. Pre-attaching
a NullHandler and raising the root level here keeps that branch dormant
for every importer of this package.
"""

import logging


logging.getLogger().addHandler(logging.NullHandler())
logging.getLogger().setLevel(logging.CRITICAL + 1)
