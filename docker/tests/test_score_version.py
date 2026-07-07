"""Unit tests for detect_openapi_version() in score/runner.py."""

import json

from jentic_scorecard_runner.score.runner import detect_openapi_version


class TestDetectOpenapiVersion:
    def test_detects_32_from_json_file(self, tmp_path):
        spec = {"openapi": "3.2.0", "info": {"title": "T", "version": "1"}, "paths": {}}
        f = tmp_path / "spec.json"
        f.write_text(json.dumps(spec))
        assert detect_openapi_version(f.as_uri()) == "3.2.0"

    def test_detects_31_from_json_file(self, tmp_path):
        spec = {"openapi": "3.1.0", "info": {"title": "T", "version": "1"}, "paths": {}}
        f = tmp_path / "spec.json"
        f.write_text(json.dumps(spec))
        assert detect_openapi_version(f.as_uri()) == "3.1.0"

    def test_detects_30_from_json_file(self, tmp_path):
        spec = {"openapi": "3.0.3", "info": {"title": "T", "version": "1"}, "paths": {}}
        f = tmp_path / "spec.json"
        f.write_text(json.dumps(spec))
        assert detect_openapi_version(f.as_uri()) == "3.0.3"

    def test_detects_32_from_yaml_file(self, tmp_path):
        f = tmp_path / "spec.yaml"
        f.write_text("openapi: 3.2.0\ninfo:\n  title: T\n  version: '1'\npaths: {}")
        assert detect_openapi_version(f.as_uri()) == "3.2.0"

    def test_detects_31_from_yaml_file(self, tmp_path):
        f = tmp_path / "spec.yaml"
        f.write_text("openapi: 3.1.0\ninfo:\n  title: T\n  version: '1'\npaths: {}")
        assert detect_openapi_version(f.as_uri()) == "3.1.0"

    def test_returns_none_for_empty_object(self, tmp_path):
        f = tmp_path / "spec.json"
        f.write_text("{}")
        assert detect_openapi_version(f.as_uri()) is None

    def test_returns_none_for_nonexistent_file(self, tmp_path):
        assert detect_openapi_version((tmp_path / "missing.json").as_uri()) is None

    def test_returns_none_for_non_file_non_http_url(self):
        assert detect_openapi_version("ftp://example.com/spec.json") is None

    def test_detects_321_patch(self, tmp_path):
        spec = {"openapi": "3.2.1", "info": {"title": "T", "version": "1"}, "paths": {}}
        f = tmp_path / "spec.json"
        f.write_text(json.dumps(spec))
        assert detect_openapi_version(f.as_uri()) == "3.2.1"
