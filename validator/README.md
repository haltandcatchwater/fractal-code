# Constitutional Validator

Enforces the Fractal Code constitution on every component in a project.

## Usage

```bash
# Build
npm install && npm run build

# Validate a directory
npx fractal-validate /path/to/project

# Or run directly
node dist/index.js /path/to/project
```

## Checks

The validator runs six checks against every cell it discovers:

| Check | Principle | Description |
|-------|-----------|-------------|
| **Cell Type** | I | Component must be one of the four defined cell types |
| **Contract** | II | Universal contract fully implemented (Identity, Input, Output, Health, Lineage, Signature) |
| **Composition** | III | All inter-cell communication passes through Channels |
| **Self-Similarity** | IV | Fractal structure maintained at all scales |
| **Context Map** | V, IX | Context map present and holographic principle satisfied |
| **Signature** | X | Structural Signatures valid and consistent |

## Exit Codes

- `0` — All checks pass
- `1` — One or more checks failed

## CI Integration

The validator runs automatically on every pull request via GitHub Actions. Non-compliant merges are blocked.
