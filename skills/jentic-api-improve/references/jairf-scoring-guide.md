# Jentic API AI-Readiness Framework (JAIRF) - Specification Summary

**Spec Version:** 1.0.0 (as of March 2026 in the `api-ai-readiness-framework` repo)
**Repository:** https://github.com/jentic/api-ai-readiness-framework
**Published Docs:** https://docs.jentic.com/reference/api-readiness-framework/overview/
**License:** Apache 2.0

---

## Purpose

JAIRF defines a standardized methodology for evaluating how well an API serves AI agents, LLM-driven orchestration systems, and automated integrations. A syntactically valid OpenAPI spec doesn't guarantee AI-readiness — JAIRF measures the qualities that matter: interpretability, operability, discoverability, and governability.

The framework:
- Defines six scored dimensions, grouped into three pillars
- Specifies a unified scoring and weighting model producing an AI-Readiness Index (0–100)
- Is implementation-agnostic, vendor-neutral, and API-format-agnostic
- Supports OpenAPI 3.x and OpenAPI 2.x

---

## Three-Layer Scoring Architecture

```
Raw Measurements
      ↓
Normalised Signals [0–1]   ← Signal calculators per dimension
      ↓
Dimension Scores [0–100]   ← Arithmetic mean of normalised signals × 100
      ↓
Gating Rules               ← Override dimension scores if safety conditions violated
      ↓
Final Score [0–100]        ← Weighted harmonic mean of 6 dimensions
      ↓
Readiness Level (0–4)      ← Threshold classification
```

### Mandatory Conformance Requirements

A conformant implementation MUST:
- Compute each dimension exactly as defined
- Apply weights as defined (or disclose deviations)
- Use weighted harmonic aggregation
- Apply gating rules prior to readiness level classification
- Apply readiness classification and grading
- Be deterministic and reproducible for any API input

---

## Three Pillars & Six Dimensions

### Pillar 1: FDX — Foundational & Developer Experience

Structural soundness and developer usability: the prerequisite conditions for any automated interpretation.

#### FC — Foundational Compliance (Weight: 16%)

Evaluates structural validity, standards conformance, and parsability.

| Signal | Description | Normalisation |
|--------|-------------|---------------|
| `spec_validity` | Does the spec parse as valid OpenAPI? | Binary (0 or 1) |
| `resolution_completeness` | % of `$ref` references that resolve | Coverage |
| `lint_results` | Severity-weighted inverse of lint diagnostics | `max(0, 1 - sqrt((1.0×critical + 0.6×errors + 0.0025×warnings + 0.001×info) / 25))` |
| `structural_integrity` | Schema defect count (contradictory typing, impossible constraints, broken polymorphism, etc.) | Logarithmic dampening |

**Structural issues:** invalid model shapes, contradictory typing, impossible constraints (`min > max`), broken polymorphism, undefined request/response bodies, non-evaluable examples, circular/unresolvable schemas.

**Formula:** `FC = 100 × (spec_validity + resolution_completeness + lint_results + structural_integrity) / 4`

**Gating Rule:** FC < 40 → API classified as Level 0 (Non-Compliant), regardless of other dimension scores.

#### DXJ — Developer Experience & Tooling Compatibility (Weight: 18%)

Evaluates clarity, documentation quality, example coverage, and pipeline compatibility.

| Signal | Description | Normalisation |
|--------|-------------|---------------|
| `example_density` | Presence of examples across eligible locations (one per location, not quantity) | Coverage |
| `example_validity` | % of examples conforming to their declared schema | Coverage |
| `doc_clarity` | Linguistic clarity using readability score ∈ [8, 16] inverted | Min-max inverted: `1 - ((score - 8) / 8)` |
| `response_coverage` | Per-operation grading: +0.25 each for 2XX / 4XX / 5XX / default responses | Coverage (arithmetic mean) |
| `tooling_readiness` | Jentic ingestion health: `max(0, 1 - ingestion_errors / 15)` | Inverse error |

**Formula:** `DXJ = 100 × (example_density + example_validity + doc_clarity + response_coverage + tooling_readiness) / 5`

---

### Pillar 2: AIRU — AI-Readiness & Usability

Semantic clarity and operational composability for intelligent agents.

#### ARAX — AI-Readiness & Agent Experience (Weight: 24% — highest)

Whether the API is semantically interpretable by AI systems.

| Signal | Description | Normalisation |
|--------|-------------|---------------|
| `summary_coverage` | % of `summary`-eligible objects with a summary | Coverage |
| `description_coverage` | % of `description`-eligible objects with a description | Coverage |
| `type_specificity` | Richness of datatype modeling: `(1.0×strong + 0.75×formatted_strings + 0.5×enums + 0.25×weak_strings) / total` | Weighted categorical |
| `policy_presence` | Operations with SLA/rate-limit/policy metadata | Coverage |
| `error_standardization` | Operations using RFC 9457 / RFC 7807 Problem Details | Coverage |
| `opid_quality` | `coverage × uniqueness × casing_consistency` | Composite |
| `ai_semantic_surface` | Bonus multiplier for x-intent, Arazzo links, AI hints: `1 + (0.05 × ai_hint_coverage)` | Bonus |

**OperationId quality detail:** Coverage = ops with operationId / total. Uniqueness = unambiguous IDs / total (case-insensitive collision detection). Casing consistency = count using dominant style / total with IDs. Detected styles: camelCase, PascalCase, snake_case, kebab-case, SCREAMING_SNAKE_CASE, lowercase, UPPERCASE.

**Formula:**
```
core_arax = (summary_coverage + description_coverage + type_specificity +
             policy_presence + error_standardization + opid_quality) / 6
ARAX = 100 × core_arax × (1 + 0.05 × ai_semantic_surface)
```

#### AU — Agent Usability (Weight: 20%)

Whether autonomous agents can operate the API reliably, safely, and efficiently.

| Signal | Description | Normalisation |
|--------|-------------|---------------|
| `complexity_comfort` | Logistic curve penalty for endpoint count and schema depth | Logistic shaping |
| `distinctiveness` | `1 - avg_semantic_similarity` across operations | Inverse semantic similarity |
| `navigation` | Composite: `(0.6 × pagination + 0.4 × hypermedia_support) × (1 + 0.03 × links_coverage)` | Composite |
| `intent_legibility` | Mean semantic alignment of operation names to canonical verb-object patterns | Semantic similarity (LLM) |
| `safety` | `(idempotent_correctness + sensitive_ops_protected) / (2 × total_operations)` | Heuristic penalty |
| `tool_calling_alignment` | Operations mappable to LLM tool-call schema / total | Coverage |

**Complexity comfort formula (v1.0.0 — updated March 2026):**
```
normalised_endpoint_count = max(0, min(1, (total_operations - 50) / 150))
  # Penalty begins at 50 ops, maxes at 200 ops. Callbacks/webhooks excluded.

normalised_schema_depth = min(1, (max_schema_depth / 18) × pct_schemas_exceeding)
  # Proportional to depth prevalence, not just max depth. Threshold = 18.

raw_complexity = 0.5 × normalised_endpoint_count + 0.5 × normalised_schema_depth
complexity_comfort = 1 / (1 + exp(6 × (raw_complexity - 0.45)))
```

> Note: An earlier spec version (v0.2.0) used `min(1, total_operations / 50)` and `min(1, max_schema_depth / 8)` without the exposure-proportional schema depth. The v1.0.0 formula is more nuanced.

**Semantic similarity formula for distinctiveness/intent_legibility:**
```
similarity(i, j) = 0.35 × embedding_similarity
                 + 0.25 × opId_similarity
                 + 0.20 × summary_similarity
                 + 0.20 × path_similarity
```

**Formula:** `AU = 100 × (complexity_comfort + distinctiveness + navigation + intent_legibility + safety + tool_calling_alignment) / 6`

---

### Pillar 3: TSD — Trust, Safety & Discoverability

Safe exposure and effective location in automated discovery environments.

#### SEC — Security (Weight: 12%)

Trustworthiness, authentication strength, and operational risk posture.

| Signal | Description | Normalisation |
|--------|-------------|---------------|
| `auth_coverage` | `protected_sensitive_ops / sensitive_ops_expected` | Coverage (intent-aware heuristics) |
| `auth_strength` | Average strength score of all declared security schemes | Weighted categorical (see table below) |
| `transport_security` | HTTPS usage on public/external endpoints | Coverage |
| `secret_hygiene` | No hardcoded credentials | Binary |
| `sensitive_handling` | `protected_pii_fields / detected_pii_fields` | Coverage |
| `owasp_posture` | `max(0, 1 - sqrt((1.0×critical + 0.6×errors + 0.025×warnings + 0.005×info)) / 5)` | Severity-weighted inverse |

**Auth strength scores (selected):**

| Scheme | Strength | Notes |
|--------|----------|-------|
| No auth | 0.00 | Unsafe |
| HTTP Basic | 0.10 | Plaintext credentials |
| API key (query) | 0.15 | High leakage risk |
| API key (header/cookie) | 0.50 | Moderate security |
| Bearer token (opaque) | 0.60 | Distribution-dependent |
| Bearer JWT | 0.75 | Cryptographically verifiable |
| OAuth2 clientCredentials | 0.85 | Strong M2M |
| OAuth2 authorizationCode | 0.90 | Best OAuth2 flow |
| OpenID Connect | 1.00 | Gold standard |
| mutualTLS | 1.00 | Hardware-backed identity |

If no security schemes are defined, `auth_strength` returns 1.0 (not applicable). Gating rules handle security issues.

**Sensitive operations** are identified by: HTTP method (POST/PUT/PATCH/DELETE), intent inference from descriptions, PII access, privileged actions, system-level behaviors. LLM reasoning MAY be used.

**Context scaling:**
```
base_security = (auth_coverage + auth_strength + transport_security +
                 secret_hygiene + sensitive_handling + owasp_posture) / 6

security_scaled = base_security × sensitivity_factor × exposure_factor
  # sensitivity_factor: 1.00 (none/low), 0.90 (moderate), 0.75 (high)
  # exposure_factor: 1.00 (internal), 0.90 (partner), 0.80 (public)
```

**Security gating caps (applied after scaling):**

| Condition | Cap |
|-----------|-----|
| Hardcoded credentials detected | SEC ≤ 20 |
| Sensitive ops without auth (public) | SEC ≤ 20 |
| Sensitive ops without auth (partner) | SEC ≤ 30 |
| Sensitive ops without auth (internal) | SEC ≤ 40 |
| PII unprotected on partner/public APIs | SEC ≤ 50 |
| Public HTTP (not HTTPS) | SEC × 0.5 |

Most restrictive cap applies when multiple conditions hold. Gating does NOT alter raw signals or other dimensions.

**Formula:** `SEC = 100 × security_final`

#### AID — AI Discoverability (Weight: 10%)

How easily AI systems can locate, classify, and route to the API.

| Signal | Description | Normalisation |
|--------|-------------|---------------|
| `descriptive_richness` | Clarity + depth scoring per describable element | Coverage with semantic weights |
| `intent_phrasing` | Verb-object semantic clarity of summaries/descriptions (TBD in spec) | Semantic similarity (LLM) |
| `workflow_context` | `operations_with_workflow_refs / total_operations` | Coverage |
| `registry_signals` | Presence of llms.txt, APIs.json, MCP metadata, externalDocs, etc. | Multi-indicator coverage |
| `domain_tagging` | `ops_with_domain_tags / total_operations` | Coverage |

**Descriptive richness detail:**
Each describable element (`info.description`, operation summaries, parameter descriptions, schema descriptions, etc.) receives:
- **Clarity score** (0/0.5/1.0): High = clear, direct, purpose-first. Low = boilerplate, legalese, placeholders (score 0.0 for "Lorem ipsum" etc.)
- **Depth score** (0/0.5/1.0): High = domain cues + behavioral detail. Low = generic text or restated field name.

```
element_score = clarity_score + depth_score  # max 2 points
descriptive_richness = Σ(element_score) / (2 × describable_elements)
```

**Soft risk discount (AID does not hide unsafe APIs):**
```
risk_index = exposure_weight × sensitivity_weight × (1 - base_security)
risk_discount = 1 - (0.5 × risk_index)   # clamped to [0.6, 1.0]
AID_raw = 100 × (descriptive_richness + intent_phrasing + workflow_context +
                  registry_signals + domain_tagging) / 5
AID = AID_raw × risk_discount
```

---

## Final Score Calculation

### Weighted Harmonic Mean

```
FinalScore = (Σ weights) / (Σ (weight / (dimensionScore + ε)))
where ε = 0.000001
```

Harmonic mean is **normative** — weaknesses in one dimension cannot be offset by strengths in others.

### Dimension Weights

| Dimension | Weight |
|-----------|--------|
| FC | 0.16 |
| DXJ | 0.18 |
| ARAX | 0.24 |
| AU | 0.20 |
| SEC | 0.12 |
| AID | 0.10 |
| **Total** | **1.00** |

---

## Readiness Levels (Normative)

| Score | Level | Name | Meaning |
|-------|-------|------|---------|
| < 40 | 0 | Not Ready | Fundamentally unsuitable for AI or agents |
| 40–60 | 1 | Foundational | Developer-ready, partially AI-usable |
| 60–75 | 2 | AI-Aware | Semantically interpretable, safe for guided use |
| 75–90 | 3 | AI-Ready | Structurally rich, semantically clear, agent-friendly |
| ≥ 90 | 4 | Agent-Optimized | Highly composable, predictable, automation-ready |

Scoring libraries MUST return both numeric score and readiness level.

---

## Letter Grades (Optional UX)

| Grade | Range |
|-------|-------|
| A+ | 90–100 |
| A | 80–89 |
| A- | 70–79 |
| B+ | 67–69 |
| B | 63–66 |
| B- | 60–62 |
| C+ | 57–59 |
| C | 53–56 |
| C- | 50–52 |
| D+ | 47–49 |
| D | 43–46 |
| D- | 40–42 |
| F | < 40 |

Grades SHOULD NOT substitute for readiness levels.

---

## Normalization Rules Reference

| Rule | Use Case | Formula |
|------|----------|---------|
| Binary | presence/absence (secret_hygiene, spec_validity) | `1 if pass else 0` |
| Coverage | presence ratios | `present / expected`; if expected=0, value=1.0 |
| Inverse Error | error counting | `max(0, 1 - issues / threshold)` |
| Min-Max Inverted | lower input = better (doc_clarity) | `1 - (x - min) / (max - min)` |
| Weighted Categorical | discrete quality levels (auth_strength) | `category_weight / max_weight` |
| Composite | multi-sub-signal (opid_quality) | weighted product/mean of sub-signals |
| Severity-Weighted Inverse | lint/OWASP findings | `max(0, 1 - weighted_cost / max_cost)` |
| Logarithmic Dampening | structural complexity | `1 - log10(1+issues) / log10(1+threshold)` |
| Logistic Shaping | complexity (complexity_comfort) | `1 / (1 + exp(k × (value - midpoint)))` |
| Semantic Similarity | LLM embedding comparison | cosine similarity (0–1) |
| Bonus Multipliers | optional metadata (ai_semantic_surface) | `base × (1 + bonus_factor × coverage)` |
| Context Scaling | sensitivity/exposure (SEC) | `base × sensitivity_factor × exposure_factor` |
| Heuristic Penalty | rule-based deductions (safety) | `1.0 - Σ(penalty × severity_weight)` |
| Soft Risk Discount | security-aware discoverability (AID) | `1 - (0.5 × risk_index)`, clamped [0.6, 1.0] |

---

## Scoring Pipeline Order (Normative)

1. Raw measurements collected
2. Signals normalized to [0,1]
3. Dimension scores computed (arithmetic mean × 100)
4. Gating rules applied (override dimension scores)
5. Final score computed (weighted harmonic mean)
6. Readiness level classified
7. (Optional) Letter grade assigned

---

## Scope Boundaries

**What JAIRF defines:**
- Conceptual model for API AI-readiness
- Scoring dimensions and required signals
- Weighting and aggregation model
- Readiness levels and classification thresholds
- Normative behaviors for conformant scoring engines

**What JAIRF does NOT define:**
- How API providers must design their APIs
- A proprietary algorithm inaccessible to auditors
- Enforcement or certification processes

---

## Key Design Principles

1. **Harmonic Mean** — Cannot game the system by excelling in one area while failing in others
2. **Security-First** — Gating rules prevent unsafe APIs from achieving high scores
3. **Observable & Auditable** — All scoring logic is transparent and reproducible
4. **Vendor-Neutral** — Works with any OpenAPI 2.x/3.x spec, any agent platform
5. **Agent-Centric** — Criteria explicitly designed for LLM and autonomous agent consumption
6. **Open Standard** — Apache 2.0 licensed, designed for community adoption and future standardization

---

## Repository Structure

```
api-ai-readiness-framework/
├── docs/
│   ├── specification/
│   │   └── spec.md              # Complete normative specification (v1.0.0)
│   └── publishing/              # GitHub Actions for auto-publishing to jentic-docs
├── assets/                      # Scorecard preview images
├── package.json                 # Node.js tooling (linting)
├── .cspell.json                 # Spell-check config
└── spec.markdownlint.yaml       # Markdown linting rules
```

Changes to `docs/specification/spec.md` on `main` automatically publish to [jentic-docs](https://github.com/jentic/jentic-docs) via GitHub Actions.

---

*Source: the JAIRF specification (`docs/specification/spec.md`) in the [api-ai-readiness-framework](https://github.com/jentic/api-ai-readiness-framework) repo, March 2026.*
