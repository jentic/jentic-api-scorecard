# OpenAPI Overlay Specification v1.1.0

**Version:** 1.1.0  
**Released:** 2026-01-14  
**Source:** https://spec.openapis.org/overlay/v1.1.0
**License:** Apache 2.0

---

## Introduction

The Overlay Specification defines a document format for information that augments an existing OpenAPI description yet remains separate from the OpenAPI description's source document(s).

The main purpose is to provide a way to repeatably apply transformations to one or many OpenAPI descriptions. Use cases include:
- Updating descriptions
- Adding metadata to be consumed by another tool
- Removing certain elements before sharing with partners

An Overlay is a JSON or YAML structure containing an ordered list of [Action Objects](#action-object) that are to be applied to the target document. 
Each [Action Object](#action-object) has a `target` property and a modifier type (`update`, `remove`, or `copy`). 
The `target` property is an [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535) JSONPath query expression that identifies the elements of the target document to be updated and the modifier determines the change.

---

## Schema

### Overlay Object (root)

| Field | Type | Required | Description                                                              |
|-------|------|----------|--------------------------------------------------------------------------|
| `overlay` | string | ✅ | MUST be the version number of the Overlay Specification (e.g. `"1.1.0"`) |
| `info` | Info Object | ✅ | Metadata about the overlay                                               |
| `extends` | string | — | URI reference to the target OpenAPI document this overlay applies to     |
| `actions` | [Action Object] | ✅ | Ordered list of actions. MUST contain at least one value.                |

Actions are applied in sequential order. Later actions override earlier ones.

### Info Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | ✅ | Human-readable description of the overlay's purpose |
| `version` | string | ✅ | Version identifier for the overlay document |

### Action Object

| Field         | Type | Required | Description |
|---------------|------|----------|-------------|
| `target`      | string | ✅ | JSONPath expression selecting nodes in the target document |
| `description` | string | — | Human-readable description of the action |
| `update`      | Any | — | Merged into a selected object, concatenated/appended to a selected array, or used to replace a selected primitive (see below) |
| `copy`        | string | — | A JSONPath expression selecting a single node to copy into the target nodes |
| `remove`      | boolean | — | If true, the selected node is removed. Default: false |

**Important:** The `target` JSONPath expression may select zero or more nodes; when it matches more than one node they MUST all be the same kind (all objects, all arrays, or all primitives). How `update` is applied depends on that kind:

- **Object target:** `update` MUST be an object; its properties are merged recursively into each selected object.
- **Array target:** `update` is concatenated (if it is an array) or appended (if it is an object or primitive) to each selected array.
- **Primitive target:** `update` MUST be a primitive value, which replaces each selected node.

When merging an `update` object into an object target, a property present only in `update` is inserted; a property present in both is merged recursively for objects, concatenated for arrays, and replaced for primitives. Incompatible combinations result in an error. If `target` matches zero nodes the action succeeds without changing the document.

---

## Examples

### Structured overlay (mirror document structure)

```yaml
overlay: 1.1.0
info:
  title: Structured Overlay
  version: 1.0.0
actions:
  - target: '$' # Root of document
    update:
      info:
        x-overlay-applied: structured-overlay
      paths:
        '/':
          summary: 'The root resource'
          get:
            summary: 'Retrieve the root resource'
            x-rate-limit: 100
        '/pets':
          get:
            summary: 'Retrieve a list of pets'
            x-rate-limit: 100
```

### Targeted overlay (precise updates)

```yaml
overlay: 1.1.0
info:
  title: Targeted Overlay
  version: 1.0.0
actions:
  - target: $.paths['/foo'].get.description
    update: This is the new description
  - target: $.paths['/bar'].get.description
    update: This is the updated description
  - target: $.paths['/bar']
    update:
      post:
        description: This is an updated description of a child object
        x-safe: false
```

### Wildcard overlay (update many nodes at once)

```yaml
overlay: 1.1.0
info:
  title: Update many objects at once
  version: 1.0.0
actions:
  - target: $.paths.*.get
    update:
      x-safe: true
  - target: $.paths.*.get.parameters[?@.name=='filter' && @.in=='query']
    update:
      schema:
        $ref: '#/components/schemas/filterSchema'
```

### Array modification (add/remove elements)

```yaml
# Add an array element
overlay: 1.1.0
info:
  title: Add an array element
  version: 1.0.0
actions:
  - target: $.paths.*.get.parameters
    update:
      name: newParam
      in: query

# Remove an array element
overlay: 1.1.0
info:
  title: Remove an array element
  version: 1.0.0
actions:
  - target: $.paths.*.get.parameters[?@.name == 'dummy']
    remove: true
```

### Copy / Move

```yaml
# Simple copy
overlay: 1.1.0
info:
  title: Copy contents of an existing path to a new location
  version: 1.0.0
actions:
  - target: '$.paths["/some-items"]'
    copy: '$.paths["/items"]'
    description: 'copies recursively all elements from the "items" path item to the new "some-items" path item without ensuring the node exists before the copy'

# Ensure the target exists and copy
overlay: 1.1.0
info:
  title: Create a path and copy the contents of an existing path to the new path
  version: 1.0.0
actions:
  - target: '$.paths'
    update: { "/other-items": {} }
  - target: '$.paths["/other-items"]'
    copy: '$.paths["/items"]'
    description: 'copies recursively all elements from the "items" path item to the new "other-items" path item while ensuring the node exists before the copy'

# Move
overlay: 1.1.0
info:
  title: Update the path for an API endpoint
  version: 1.0.0
actions:
  - target: '$.paths'
    update: { "/new-items": {} }
  - target: '$.paths["/new-items"]'
    copy: '$.paths["/items"]'
  - target: '$.paths["/items"]'
    remove: true
    description: 'moves (renames) the "items" path item to "new-items"'
```


### Pointing at a specific target document

```yaml
overlay: 1.1.0
info:
  title: Overlay for My API
  version: 1.0.0
extends: './openapi.yaml'   # relative path
actions:
  - target: $.paths['/users'].get
    update:
      summary: List all users
```

---

## Key Rules

1. **Sequential application** — actions are applied in order; each action sees the result of the previous
2. **Recursive merge** — when the target is an object, `update` properties are recursively merged; new properties are added, existing ones overwritten
3. **Array append** — when the target is an array, the `update` value is concatenated (if it is an array) or appended (if it is an object or primitive), not merged
4. **Primitive replace** — when the target is a primitive, `update` MUST be a primitive value and replaces the selected node (e.g. `target: $.paths['/foo'].get.description`, `update: "New description"`). You may also select the containing object and set the property via `update` — both work
5. **Same-kind matches** — when a `target` matches more than one node they MUST all be the same kind (all objects, all arrays, or all primitives)
6. **`remove: true`** — removes the selected node from its containing map or array
7. **`extends`** is optional — if omitted, tooling decides which document to apply the overlay to

---

## JSONPath Quick Reference (RFC 9535)

| Expression | Selects |
|-----------|---------|
| `$` | Root of the document |
| `$.paths` | The `paths` object |
| `$.paths['/users']` | A specific path item |
| `$.paths['/users'].get` | The GET operation on `/users` |
| `$.paths.*.get` | All GET operations |
| `$.paths.*.*.parameters` | All parameters on all operations |
| `$.paths.*.get.parameters[?@.name=='q']` | Parameter named `q` on all GET operations |
| `$.components.schemas.*` | All schemas in components |

---

## Common AI-Readiness Improvement Patterns

These are the most common overlay actions when improving OpenAPI specs for JAIRF scoring:

```yaml
overlay: 1.1.0
info:
  title: AI-readiness improvements
  version: 1.0.0
extends: ./openapi.yaml
actions:
  # Add summary to an operation
  - target: $.paths['/users'].get
    update:
      summary: List all users in the organisation

  # Add description to a parameter
  - target: $.paths['/users'].get.parameters[?@.name=='limit']
    update:
      description: Maximum number of users to return. Defaults to 20, maximum 100.

  # Add operationId
  - target: $.paths['/users'].get
    update:
      operationId: listUsers

  # Add example to a response schema property (via containing object)
  - target: $.components.schemas.User.properties.email
    update:
      description: The user's email address
      example: user@example.com

  # Add a 404 response to an operation
  - target: $.paths['/users/{id}'].get
    update:
      responses:
        '404':
          description: User not found

  # Add tags to an operation
  - target: $.paths['/users'].get
    update:
      tags:
        - Users
```
