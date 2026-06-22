"""Unit tests for the OpenAPI version guard."""

import json

from jentic_scorecard_runner.version_guard import (
    conversion_notice_message,
    detect_version,
    is_unsupported,
    scorecard_version,
)


class TestDetectVersion:
    def test_json_openapi(self):
        assert detect_version('{"openapi": "3.2.0"}') == "3.2.0"

    def test_json_swagger(self):
        assert detect_version('{"swagger": "2.0"}') == "2.0"

    def test_yaml_openapi(self):
        assert detect_version("openapi: 3.0.4\ninfo:\n  title: API") == "3.0.4"

    def test_yaml_quoted(self):
        assert detect_version('openapi: "3.1.1"\ninfo: {}') == "3.1.1"

    def test_yaml_swagger(self):
        assert detect_version("swagger: '2.0'\ninfo: {}") == "2.0"

    def test_missing_version(self):
        assert detect_version("info:\n  title: API") is None

    def test_not_a_version_value(self):
        assert detect_version('{"openapi": {"nested": true}}') is None


class TestIsUnsupported:
    def test_rejects_3_2_x(self):
        assert is_unsupported("3.2.0")
        assert is_unsupported("3.2.1")

    def test_rejects_bare_3_2(self):
        assert is_unsupported("3.2")

    def test_allows_supported(self):
        assert not is_unsupported("3.0.4")
        assert not is_unsupported("3.1.0")
        assert not is_unsupported("2.0")

    def test_does_not_match_3_20(self):
        # A hypothetical future 3.20.x must not be caught by a 3.2 prefix check.
        assert not is_unsupported("3.20.0")

    def test_none(self):
        assert not is_unsupported(None)


class TestScorecardVersion:
    def test_reads_specification_version(self):
        payload = json.dumps({"apiMetadata": {"specificationVersion": "3.2.0"}}).encode()
        assert scorecard_version(payload) == "3.2.0"

    def test_missing_metadata(self):
        assert scorecard_version(b"{}") is None

    def test_invalid_json(self):
        assert scorecard_version(b"not json") is None


class TestConversionNotice:
    def test_names_source_format(self):
        message = conversion_notice_message("Swagger/OpenAPI 2.0")
        assert "Swagger/OpenAPI 2.0" in message
        assert "auto-converted OpenAPI 3.0" in message

    def test_warns_about_locations(self):
        message = conversion_notice_message("Google Discovery")
        assert "Google Discovery" in message
        assert "line/column" in message
