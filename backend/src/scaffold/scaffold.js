import { STACKS, resolveStackLabel } from '../domain/stacks.js';
import { PROJECT_TYPES } from '../domain/types.js';
import { parseCustomStack, CATEGORY_LABELS, starterLanguageFor } from '../domain/techs.js';

export function slugify(str) {
  return String(str || 'project').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'project';
}

function filePurpose(path) {
  const name = path.split('/').pop();
  const map = {
    'package.json': 'scripts, dev deps, module config',
    'tsconfig.json': 'strict TypeScript config',
    'pyproject.toml': 'project metadata, deps, pytest + ruff config',
    'go.mod': 'module definition',
    'Cargo.toml': 'crate metadata and deps',
    'index.ts': 'entry point — parse input, run core, print output',
    'main.py': 'entry point — Typer CLI over the core',
    'main.go': 'entry point — parse args, run core',
    'main.rs': 'entry point — parse args, run core',
    'core.ts': 'pure deterministic core — implement the real transform here',
    'core.py': 'pure deterministic core — implement the real transform here',
    'core.go': 'pure deterministic core — implement the real transform here',
    'core.rs': 'pure deterministic core — implement the real transform here',
    'core.test.ts': 'first unit test for the core',
    'test_core.py': 'first unit test for the core',
    'core_test.go': 'first unit test for the core',
    '__init__.py': 'package marker',
    'index.html': 'visual project overview — open it after extracting the zip',
    'README.md': 'idea, why, architecture, stack rationale, dependencies, quick start',
    'PLAN.md': 'feasibility summary + implementation milestones',
    'sample-input.txt': 'sample fixture of the real input this tool must handle',
    '.gitignore': 'ignore build artifacts',
  };
  return map[name] || 'project file';
}

// ── Stack-specific setup docs (commands, deps) ─────────────────────────────
const STACK_DOCS = {
  typescript: {
    depsHeader: 'package.json (devDependencies)',
    deps: ['typescript ^5.5 — compiler', 'vitest ^2.1 — unit tests', 'biome ^1.9 — lint + format', '@types/node ^22 — Node typings'],
    commands: { install: 'npm install', build: 'npm run build', run: 'npm run build && node dist/index.js "<input>"', test: 'npm test', lint: 'npm run lint' },
  },
  python: {
    depsHeader: 'pyproject.toml',
    deps: ['typer >=0.12 — CLI framework', 'pytest — unit tests', 'ruff — lint + format'],
    commands: { install: 'uv sync', build: '', run: '<slug> "<input>"', test: 'uv run pytest', lint: 'uv run ruff check' },
  },
  go: {
    depsHeader: 'go.mod (stdlib only)',
    deps: ['testing (stdlib) — unit tests', 'gofmt — formatting'],
    commands: { install: 'go mod tidy', build: 'go build .', run: 'go run . "<input>"', test: 'go test ./...', lint: 'gofmt -l .' },
  },
  rust: {
    depsHeader: 'Cargo.toml',
    deps: ['cargo clippy — lint', 'cargo fmt — formatting'],
    commands: { install: 'cargo build', build: 'cargo build', run: 'cargo run -- "<input>"', test: 'cargo test', lint: 'cargo clippy' },
  },
};

function docFor(stackKey, slug) {
  const d = STACK_DOCS[stackKey] || STACK_DOCS.typescript;
  return { ...d, deps: d.deps.slice(), run: d.commands.run.replace('<slug>', slug) };
}

// ── Small ASCII flow diagram built from the architecture shape ─────────────
function flowDiagram(shapeSteps) {
  const steps = (Array.isArray(shapeSteps) && shapeSteps.length ? shapeSteps : ['input', 'parse', 'transform', 'output']).slice(0, 7);
  const lines = ['```text'];
  steps.forEach((s, i) => {
    lines.push(`  ▸ ${s}`);
    if (i < steps.length - 1) lines.push('    │');
    if (i < steps.length - 1) lines.push('    ▼');
  });
  lines.push('```');
  return lines.join('\n');
}

function archFrom(ctx) {
  const r = ctx?.results || {};
  const arch = r.architecture || {};
  const shape = arch.shape || 'input → parse → transform → output';
  const steps = shape.split(/\s*(?:->|→|=>)\s*/).map(s => String(s).trim()).filter(Boolean);
  return { arch, shape, steps };
}

function stackLabelFor(input, stackKey) {
  const meta = STACKS[stackKey] || STACKS.typescript;
  return input.customStack || resolveStackLabel(input) || meta.label || 'TypeScript / JavaScript';
}

function milestonesFor(ctx, fallback) {
  const r = ctx?.results || {};
  const m = Array.isArray(r.builder?.milestones) && r.builder.milestones.length ? r.builder.milestones : fallback;
  return m.slice(0, 6);
}

function fallbackMilestones(shape) {
  const core = 'the core module';
  return [
    { week: 1, title: 'Foundation', tasks: ['Scaffold the repo from the starter files.', 'Wire build, test, and lint scripts.', 'Add fixtures for the first input sample.'], accept: 'the repo builds and the placeholder test passes.' },
    { week: 2, title: 'Core slice', tasks: [`Implement the main ${shape} flow in ${core}.`, 'Connect the entry point to the core.'], accept: 'running the entry point on the sample input produces the expected output.' },
    { week: 3, title: 'Harden', tasks: ['Add error taxonomy and edge-case handling.', 'Unit-test every module with fixed fixtures.'], accept: 'all tests are green and failures are clear and actionable.' },
    { week: 4, title: 'Ship', tasks: ['Write docs and a README quick start.', 'Tag a release.'], accept: 'a fresh clone builds and runs straight from the README.' },
  ];
}

// ── README.md — proper project readme, generated from the pipeline ─────────
// ── Native toolchains for custom stacks (C/C++/Rust/C# etc.) ───────────────
const NATIVE_TOOLCHAINS = {
  c:      { label: 'C',         req: 'C17 compiler + CMake >= 3.16' },
  cpp:    { label: 'C++',       req: 'C++17 compiler + CMake >= 3.16' },
  cxx:    { label: 'C++',       req: 'C++17 compiler + CMake >= 3.16' },
  csharp: { label: 'C# / .NET', req: '.NET SDK 8+ (LTS)' },
  dotnet: { label: 'C# / .NET', req: '.NET SDK 8+ (LTS)' },
  rust:   { label: 'Rust',      req: 'Rust toolchain (rustup)' },
};

function nativeDepLines(components) {
  const seen = new Set();
  const lines = [];
  for (const c of components) {
    const t = NATIVE_TOOLCHAINS[c.token];
    if (!t || seen.has(t.label)) continue;
    seen.add(t.label);
    lines.push(
      `- \`${t.req}\` — the planned **${t.label}** component. The scaffold seeds a ` +
      'free-standing slice that runs without it; call the native piece as a ' +
      'subprocess from the CLI (or bind it in a later milestone).'
    );
  }
  return lines;
}

function stackTableRows(input, stackKey) {
  if (input.customStack) {
    const { components } = parseCustomStack(input.customStack);
    const byCategory = new Map();
    components.forEach(c => {
      if (!byCategory.has(c.category)) byCategory.set(c.category, []);
      byCategory.get(c.category).push(c.label);
    });
    if (byCategory.size) {
      const rows = [...byCategory.entries()]
        .map(([cat, labels]) => `| ${CATEGORY_LABELS[cat] || cat} | ${labels.join(', ')} |`);
      rows.push(`| Note | Custom combination — pin versions and verify compatibility manually |`);
      return rows.join('\n');
    }
  }
  const stackMeta = STACKS[stackKey] || STACKS.typescript;
  return [
    ['Runtime / app', stackMeta.app],
    ['UI', stackMeta.ui],
    ['API', stackMeta.api],
    ['Data', stackMeta.data],
    ['Tests', stackMeta.test],
    ['Lint', stackMeta.lint],
  ].map(([k, v]) => `| ${k} | ${v} |`).join('\n');
}

function readmeMarkdown({ input, ctx, stackKey, slug }) {
  const r = ctx?.results || {};
  const feas = r.feasibility || {};
  const stackMeta = STACKS[stackKey] || STACKS.typescript;
  const { shape, steps } = archFrom(ctx);
  const stackLabel = stackLabelFor(input, stackKey);
  const typeLabel = PROJECT_TYPES[input.type] || input.type || 'Web app';
  const name = input.name || slug;
  const idea = input.idea || '—';
  const docs = docFor(stackKey, slug);
  const milestones = milestonesFor(ctx, fallbackMilestones(shape));

  const stackTable = stackTableRows(input, stackKey);
  const customWhy = input.customStack
    ? `You specified a custom combination: **${stackLabel}**.`
    : `**${stackLabel}** was chosen because: *${stackMeta.why}*`;

  const { components } = input.customStack ? parseCustomStack(input.customStack) : { components: [] };
  const baseLabel = STACKS[stackKey]?.label || stackKey;
  const nativeLines = nativeDepLines(components);
  const otherRuntimes = components
    .filter(c => c.category === 'runtime' && c.label !== baseLabel)
    .map(c => c.label);
  const runtimeNote = input.customStack
    ? `The generated files wire the **${baseLabel}** slice so the project runs locally today.`
      + (otherRuntimes.length
        ? ` Components planned but not yet scaffolded — **${otherRuntimes.join(' + ')}** — need their own toolchain below.`
        : '')
    : 'No runtime dependencies are required for the MVP; everything runs on the\nstandard library/toolchain beyond these dev tools.';
  const nativeBlock = nativeLines.length
    ? ['', 'Planned native components:', '', ...nativeLines].join('\n')
    : '';
  const fixturePath = stackKey === 'typescript' ? 'test/fixtures/sample-input.txt' : 'fixtures/sample-input.txt';

  const milestoneBlock = milestones
    .map((m, i) => `- **Milestone ${i + 1} — ${m.slot || `Week ${m.week}`}: ${m.title}** — ${(m.tasks || []).join(' · ')}`)
    .join('\n');

  const modList = (Array.isArray(r.architecture?.modules) && r.architecture.modules.length
    ? r.architecture.modules : ['entry', 'core', 'output'])
    .map((m, i) => `${i + 1}. **${m}**`).join('\n');

  const principles = (Array.isArray(r.architecture?.principles) && r.architecture.principles.length
    ? r.architecture.principles : ['Keep the core pure and deterministic.', 'Thin adapters around the core.'])
    .map(p => `- ${p}`).join('\n');

  const buildRow = docs.commands.build ? `| Build | \`${docs.commands.build}\` |\n` : '';

  return `# ${name}

> ${idea}

AbridgeAI generated this repository from its planning pipeline. It is a
**starting scaffold**, not production-ready software — structure, tests, and
build are wired; the real logic is yours to implement (follow PLAN.md).

---

## 1. What is this?

**${name}** is a **${typeLabel}** built with **${stackLabel}**.

${idea}

Data-flow spine: \`${shape}\`.

---

## 2. Why build it?

| Signal | Value |
|---|---|
| Feasibility | ${feas.score != null ? `${feas.score}/100 — ${feas.verdict}` : 'run the plan to compute'} |
| Effort | ${feas.estimate || 'run the plan to compute'} |
| Architecture | \`${shape}\` |
| Immediate goal | Prove the input → output path end-to-end first |

Every module is deliberately small and deterministic; adapters (CLI, server,
UI) stay thin wrappers around the core.

---

## 3. Architecture

### Data flow

${flowDiagram(steps)}

### Modules

${modList}

### Design principles

${principles}

---

## 4. Why this stack?

${customWhy}

| Layer | Choice |
|-------|--------|
${stackTable}

**Trade-offs**

- Fast to iterate, with first-class tooling.
- Each layer (app/api/data) can be swapped independently as the project grows.

---

## 5. Dependencies to install

The project uses ${docs.depsHeader}:

${docs.deps.map(d => `- \`${d}\``).join('\n')}

${runtimeNote}
${nativeBlock}

---

## 6. Getting started

| Step | Command |
|------|---------|
| Install | \`${docs.commands.install}\` |
${buildRow}| Run | \`${docs.commands.run}\` |
| Test | \`${docs.commands.test}\` |
| Lint | \`${docs.commands.lint}\` |

Example:

\`\`\`bash
${docs.commands.run}
\`\`\`

---

## 7. What's in here?

- \`src/core\` — the pure, deterministic core (implement the real logic here).
- \`src/index\` (or \`main\`) — the CLI entry point.
- \`test/\` — the first unit tests. Run them before writing anything new.
- \`${fixturePath}\` — one sample of the input this tool must handle.
- \`index.html\` — open it: a visual overview of this project's plan, architecture, and milestones.
- \`PLAN.md\` — feasibility summary, architecture, and milestones.

---

## 8. Implementation plan

${milestoneBlock}

See **PLAN.md** for the full plan with tasks, acceptance criteria, and
feasibility notes.

---

*Built with [AbridgeAI](https://github.com/suzannet-menon/AbridgeAI) — from
rough idea to build-ready plan.*
`;
}

// ── PLAN.md — the full pipeline plan, embedded in the scaffold ─────────────
function planMarkdown({ input, ctx, stackKey, slug }) {
  const r = ctx?.results || {};
  const feas = r.feasibility || {};
  const builder = r.builder || {};
  const { shape, steps } = archFrom(ctx);
  const stackLabel = stackLabelFor(input, stackKey);
  const typeLabel = PROJECT_TYPES[input.type] || input.type || 'Web app';
  const idea = input.idea || '—';
  const name = input.name || slug;
  const milestones = milestonesFor(ctx, fallbackMilestones(shape));
  const axes = Array.isArray(feas.axes) ? feas.axes : [];

  const lines = [
    `# ${name} — Build Plan`,
    '',
    `> **Idea:** ${idea}`,
    '',
    '## 1. Feasibility',
    '',
    feas.score != null
      ? `- **Score:** ${feas.score}/100 — **${feas.verdict}**`
      : '- **Score:** _not computed in this run_',
    feas.estimate ? `- **Effort:** ${feas.estimate}` : null,
    '',
    ...(axes.length
      ? ['| Axes | Score |', '|------|-------|', ...axes.map(a => `| ${a.label} | ${a.value}/${a.max} |`), '']
      : []),
    '',
    builder.overview ? `**Overview:** ${builder.overview}` : null,
    '',
    '## 2. Architecture',
    '',
    '### Data flow',
    '',
    `\`${shape}\``,
    '',
    flowDiagram(steps),
    '',
    '### Modules',
    '',
    ...(Array.isArray(r.architecture?.modules) && r.architecture.modules.length
      ? r.architecture.modules.map((m, i) => `${i + 1}. ${m}`)
      : ['1. entry', '2. core', '3. output']),
    '',
    ...((Array.isArray(r.architecture?.principles) && r.architecture.principles.length)
      ? ['### Design principles', '', ...r.architecture.principles.map(p => `- ${p}`), '']
      : []),
    '## 3. Milestones',
    '',
    ...milestones.flatMap((m, i) => [
      `### Milestone ${i + 1} — ${m.slot || `Week ${m.week}`}: ${m.title}`,
      '',
      ...(Array.isArray(m.tasks) ? m.tasks.map(t => `- [ ] ${t}`) : []),
      '',
      `- **Done when:** ${m.accept || 'this milestone is verifiably complete.'}`,
      '',
    ]),
    '## 4. Getting started',
    '',
    `- **Type:** ${typeLabel} (${stackLabel}).`,
    '- Follow README.md for install / run / test instructions.',
    '- Start with the core module and the first unit test.',
    '- Re-run this plan in AbridgeAI whenever the idea changes.',
    '',
  ].filter(l => l != null);

  return lines.join('\n');
}

// ── Project plan context embedded into starter files ────────────────────────
function planContext(input, ctx, slug) {
  const r = ctx?.results || {};
  const arch = r.architecture || {};
  const { shape } = archFrom(ctx);
  const modules = Array.isArray(arch.modules) && arch.modules.length
    ? arch.modules : ['entry', 'core', 'output'];
  const principles = Array.isArray(arch.principles) && arch.principles.length
    ? arch.principles : ['Keep the core pure and deterministic.', 'Thin adapters around the core.'];
  return {
    name: input.name || slug,
    idea: input.idea || 'A deterministic tool.',
    shape,
    modules,
    principles,
  };
}

function fixtureSample() {
  return `<one real sample of the raw input this tool must handle>

This fixture is the contract your core must consume. Replace it with a real
example from your own use case before implementing the transform.`;
}

function planHeaderBlock(p) {
  return [
    `// ${p.name} — ${p.idea}`,
    '// Pure, deterministic core. No I/O, no side effects — everything the tool',
    '// prints flows through this module.',
    '//',
    '// Pipeline planned for this project:',
    `//   ${p.shape}`,
    '//',
    '// Modules to build (from the architecture stage):',
    ...p.modules.map((m, i) => `//   ${i + 1}. ${m}`),
    '//',
    '// Principles:',
    ...p.principles.map(x => `//   • ${x}`),
    '//',
    '// Start at the first step of the spine and keep each step pure and tested.',
  ].join('\n');
}

function tsStarter(slug, name, desc, p) {
  const pkg = {
    name: slug, version: '0.1.0', private: true, type: 'module', description: desc,
    scripts: { build: 'tsc', test: 'vitest run', 'test:watch': 'vitest', lint: 'biome check src' },
    devDependencies: { typescript: '^5.5.0', vitest: '^2.1.0', '@types/node': '^22.0.0', '@biomejs/biome': '^1.9.0' },
  };
  const tsconfig = {
    compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
      strict: true, outDir: 'dist', rootDir: 'src',
      declaration: true, sourceMap: true, esModuleInterop: true, skipLibCheck: true,
    },
    include: ['src'],
  };
  return [
    { path: 'package.json', content: JSON.stringify(pkg, null, 2) + '\n' },
    { path: 'tsconfig.json', content: JSON.stringify(tsconfig, null, 2) + '\n' },
    {
      path: 'src/core.ts',
      content: `${planHeaderBlock(p)}\n\nexport function run(input: string): string {\n  // First slice of "${p.shape}": normalize raw input so downstream steps\n  // parse one consistent contract. Replace with the real transform.\n  return normalize(input);\n}\n\nfunction normalize(raw: string): string {\n  return raw.trim();\n}\n`,
    },
    {
      path: 'src/index.ts',
      content: `// ${name} — ${p.idea}\n// Entry point: read raw input from argv, run the deterministic core, print.\n// Usage: node dist/index.js "<raw input>"\n\nimport { run } from './core.js';\n\nfunction main() {\n  const input = process.argv.slice(2).join(' ');\n  process.stdout.write(run(input) + '\\n');\n}\n\nmain();\n`,
    },
    {
      path: 'test/core.test.ts',
      content: `import { describe, expect, it } from 'vitest';\nimport { run } from '../src/core.js';\n\ndescribe('core', () => {\n  it('normalizes the raw input', () => {\n    expect(run('  hello  ')).toBe('hello');\n  });\n\n  it('does not damage already-trimmed input', () => {\n    expect(run('hello')).toBe('hello');\n  });\n\n  it('collapses empty input to an empty result', () => {\n    expect(run('   ')).toBe('');\n  });\n});\n`,
    },
    { path: 'test/fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: 'node_modules/\ndist/\n*.log\n' },
  ];
}

function pyStarter(slug, name, desc, p) {
  return [
    {
      path: 'pyproject.toml',
      content: `[project]\nname = "${slug}"\nversion = "0.1.0"\ndescription = "${desc}"\nrequires-python = ">=3.12"\ndependencies = ["typer>=0.12"]\n\n[project.scripts]\n${slug} = "src.main:cli"\n\n[tool.pytest.ini_options]\naddopts = "-q"\npythonpath = ["."]\n\n[tool.ruff]\nline-length = 100\n`,
    },
    { path: 'src/__init__.py', content: '' },
    {
      path: 'src/main.py',
      content: `"""Entry point — Typer CLI over the deterministic core."""\n\nfrom src.core import run\n\ndef cli():\n    import typer\n    app = typer.Typer()\n\n    @app.command()\n    def go(input_text: str):\n        """Run the pipeline over INPUT_TEXT."""\n        typer.echo(run(input_text))\n\n    app()\n\nif __name__ == "__main__":\n    cli()\n`,
    },
    {
      path: 'src/core.py',
      content: `"""${name} — ${p.idea}

Pure, deterministic core. No I/O, no side effects — everything the CLI prints
flows through this module.

Pipeline planned for this project:
    ${p.shape}

Modules to build (from the architecture stage):
    ${p.modules.map((m, i) => `${i + 1}. ${m}`).join('\n    ')}

Principles:
    ${p.principles.map(x => `• ${x}`).join('\n    ')}
"""

def run(input_text: str) -> str:
    """First slice of "${p.shape}": normalize the raw input.

    Replace with the real transform, keeping every step pure and tested.
    """
    return input_text.strip()
`,
    },
    {
      path: 'tests/test_core.py',
      content: `from src.core import run

def test_normalizes_whitespace():
    assert run("  x  ") == "x"

def test_keeps_clean_input_unchanged():
    assert run("x") == "x"

def test_collapses_blank_input():
    assert run("   ") == ""
`,
    },
    { path: 'fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: '__pycache__/\n.venv/\n*.pyc\n' },
  ];
}

function goStarter(slug, name, desc, p) {
  const header = [
    `// Package core — ${name} (${p.idea})`,
    '//',
    '// Pure, deterministic core: no I/O, no side effects. Everything main',
    '// prints flows through Run.',
    '//',
    '// Pipeline planned for this project:',
    `//   ${p.shape}`,
    '//',
    '// Modules to build (from the architecture stage):',
    ...p.modules.map((m, i) => `//   ${i + 1}. ${m}`),
    '//',
  ].join('\n');
  return [
    { path: 'go.mod', content: `module ${slug}\n\ngo 1.22\n` },
    {
      path: 'main.go',
      content: `package main\n\nimport (\n  "fmt"\n  "os"\n  "strings"\n  "${slug}/core"\n)\n\nfunc main() {\n  input := strings.Join(os.Args[1:], " ")\n  fmt.Println(core.Run(input))\n}\n`,
    },
    {
      path: 'core/core.go',
      content: `${header}\n\npackage core\n\nimport "strings"\n\n// Run is the first slice of the planned spine: normalize the raw input.\n// Replace with the real transform, keeping every step pure and tested.\nfunc Run(input string) string {\n  return strings.TrimSpace(input)\n}\n`,
    },
    {
      path: 'core/core_test.go',
      content: `package core\n\nimport "testing"\n\nfunc TestRunTrimsWhitespace(t *testing.T) {\n  if got := Run("  x  "); got != "x" {\n    t.Fatalf("Run() = %q, want %q", got, "x")\n  }\n}\n\nfunc TestRunKeepsCleanInput(t *testing.T) {\n  if got := Run("x"); got != "x" {\n    t.Fatalf("Run() = %q, want %q", got, "x")\n  }\n}\n`,
    },
    { path: 'fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: 'bin/\n*.exe\n' },
  ];
}

function rustStarter(slug, name, desc, p) {
  const header = [
    `//! ${name} — ${p.idea}`,
    '//! Pure, deterministic core: no I/O, no side effects. Everything main',
    '//! prints flows through this module.',
    '//!',
    '//! Pipeline planned for this project:',
    `//!   ${p.shape}`,
    '//!',
    '//! Modules to build (from the architecture stage):',
    ...p.modules.map((m, i) => `//!   ${i + 1}. ${m}`),
    '//!',
  ].join('\n');
  return [
    {
      path: 'Cargo.toml',
      content: `[package]\nname = "${slug}"\nversion = "0.1.0"\nedition = "2021"\n\ndescription = "${desc}"\n\n[dependencies]\n`,
    },
    {
      path: 'src/main.rs',
      content: `mod core;\n\nfn main() {\n  let input: Vec<String> = std::env::args().skip(1).collect();\n  println!("{}", core::run(&input.join(" ")));\n}\n`,
    },
    {
      path: 'src/core.rs',
      content: `${header}\npub fn run(input: &str) -> String {\n  // First slice of the planned spine: normalize the raw input.\n  input.trim().to_string()\n}\n\n#[cfg(test)]\nmod tests {\n  use super::*;\n\n  #[test]\n  fn run_trims_whitespace() {\n    assert_eq!(run("  x  "), "x");\n  }\n\n  #[test]\n  fn run_keeps_clean_input() {\n    assert_eq!(run("x"), "x");\n  }\n}\n`,
    },
    { path: 'fixtures/sample-input.txt', content: fixtureSample() },
    { path: '.gitignore', content: '/target\n' },
  ];
}

// ── index.html — a visual, self-contained "understand this project" page ────
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function overviewHtml({ input, ctx, stackKey, slug }) {
  const r = ctx?.results || {};
  const feas = r.feasibility || {};
  const { shape, steps: rawSteps } = archFrom(ctx);
  const steps = (rawSteps.length ? rawSteps : ['input', 'parse', 'transform', 'output']).slice(0, 7);
  const modules = Array.isArray(r.architecture?.modules) && r.architecture.modules.length
    ? r.architecture.modules : ['entry', 'core', 'output'];
  const principles = Array.isArray(r.architecture?.principles) && r.architecture.principles.length
    ? r.architecture.principles : ['Keep the core pure and deterministic.', 'Thin adapters around the core.'];
  const milestones = milestonesFor(ctx, fallbackMilestones(shape));
  const axes = Array.isArray(feas.axes) ? feas.axes : [];
  const name = input.name || slug;
  const idea = input.idea || '—';
  const typeLabel = PROJECT_TYPES[input.type] || input.type || 'Web app';
  const stackLabel = stackLabelFor(input, stackKey);
  const docs = docFor(stackKey, slug);
  const score = feas.score != null ? Math.max(0, Math.min(100, feas.score)) : null;
  const tone = feas.verdictClass === 'bad' ? 'bad' : feas.verdictClass === 'warn' ? 'warn' : 'good';
  const commandRows = [
    docs.commands.install && ['Install', docs.commands.install],
    docs.commands.build && ['Build', docs.commands.build],
    ['Run', docs.commands.run],
    ['Test', docs.commands.test],
  ].filter(Boolean);

  const axesHtml = axes.length
    ? axes.map(a => {
        const pct = Math.max(0, Math.min(100, (a.value / a.max) * 100));
        return `<div class="axis"><span class="axis-label">${escapeHtml(a.label)}</span>` +
          `<span class="axis-track"><span class="axis-fill" style="width:${pct.toFixed(0)}%"></span></span>` +
          `<span class="axis-val">${a.value}/${a.max}</span></div>`;
      }).join('\n')
    : '<p class="muted">Run the full pipeline in AbridgeAI to score the axes.</p>';

  const modulesHtml = modules
    .map((m, i) => `<div class="module"><span class="module-idx">${i + 1}</span><span>${escapeHtml(m)}</span></div>`)
    .join('\n');

  const flowHtml = steps
    .map((s, i) => `<span class="flow-step">${escapeHtml(s)}</span>${i < steps.length - 1 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}`)
    .join('\n');

  const milestonesHtml = milestones
    .map((m) => `<div class="milestone"><div class="ms-head"><span class="ms-slot">${escapeHtml(m.slot || `Week ${m.week}`)}</span>` +
      `<span class="ms-title">${escapeHtml(m.title)}</span></div>` +
      `<ul class="ms-tasks">${(m.tasks || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` +
      `<p class="ms-accept">${m.accept ? `<strong>Done when:</strong> ${escapeHtml(m.accept)}` : ''}</p></div>`)
    .join('\n');

  const commandsHtml = commandRows
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td><code>${escapeHtml(v)}</code></td></tr>`)
    .join('\n');

  // Every bundled starter's placeholder core is the same slice: trim() the
  // input. The demo below mirrors it in plain JS so the page runs standalone,
  // and tells the builder exactly where to swap in the real transform.
  const coreEntry = stackKey === 'go' ? 'core.Run()' : stackKey === 'rust' ? 'core::run()' : stackKey === 'python' ? 'src.core.run()' : 'src/core.ts run()';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)} — project overview</title>
<style>
  :root {
    --bg: #f6f6f2; --panel: #ffffff; --ink: #171713; --ink-soft: #5c5c54; --ink-faint: #8b8b80;
    --line: #e4e4dc; --accent: #4f46e5; --good: #166534; --warn: #92500c; --bad: #b91c1c;
    --radius: 14px; --mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--ink); font: 15px/1.55 "Segoe UI", system-ui, sans-serif; padding: 0 20px 60px; }
  .wrap { max-width: 980px; margin: 0 auto; }
  header { padding: 42px 0 26px; border-bottom: 1px solid var(--line); }
  .kicker { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); font-weight: 700; }
  h1 { font-size: clamp(26px, 4vw, 40px); line-height: 1.15; margin-top: 8px; letter-spacing: -0.02em; }
  .idea { color: var(--ink-soft); max-width: 64ch; margin-top: 10px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
  .chip { border: 1px solid var(--line); background: var(--panel); border-radius: 999px; padding: 5px 14px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
  .chip.good { color: var(--good); border-color: color-mix(in srgb, var(--good) 35%, transparent); }
  .chip.warn { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 35%, transparent); }
  .chip.bad { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 35%, transparent); }
  section { margin-top: 34px; }
  h2 { font-size: 12.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 14px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px 22px; }
  .card h3 { font-size: 15px; margin-bottom: 12px; }
  .score-row { display: flex; align-items: center; gap: 18px; }
  .score-num { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; }
  .score-num.good { color: var(--good); } .score-num.warn { color: var(--warn); } .score-num.bad { color: var(--bad); }
  .score-sub { color: var(--ink-soft); font-size: 13px; }
  .axis { display: grid; grid-template-columns: 1fr 88px 46px; gap: 10px; align-items: center; margin-top: 9px; font-size: 12.5px; }
  .axis-label { color: var(--ink-soft); }
  .axis-track { height: 6px; border-radius: 99px; background: var(--line); overflow: hidden; }
  .axis-fill { display: block; height: 100%; border-radius: 99px; background: var(--accent); }
  .axis-val { font-family: var(--mono); color: var(--ink-faint); text-align: right; }
  .flow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .flow-step { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 8px 14px; font-family: var(--mono); font-size: 13px; font-weight: 600; }
  .flow-arrow { color: var(--ink-faint); font-weight: 700; }
  .module { display: flex; align-items: baseline; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
  .module:last-child { border-bottom: 0; }
  .module-idx { font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--accent); }
  ul.ms-tasks { margin: 8px 0 0 18px; color: var(--ink-soft); font-size: 13.5px; }
  .ms-head { display: flex; align-items: baseline; gap: 10px; }
  .ms-slot { font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: .08em; }
  .ms-title { font-weight: 700; }
  .ms-accept { color: var(--ink-faint); font-size: 12.5px; margin-top: 6px; }
  .ul-principles { margin-left: 18px; color: var(--ink-soft); font-size: 13.5px; }
  table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  th, td { text-align: left; padding: 10px 16px; border-bottom: 1px solid var(--line); font-size: 13.5px; }
  tr:last-child th, tr:last-child td { border-bottom: 0; }
  th { width: 90px; font-weight: 700; color: var(--ink-soft); }
  code { font-family: var(--mono); font-size: 12.5px; background: var(--bg); padding: 2px 7px; border-radius: 6px; border: 1px solid var(--line); }
  .muted { color: var(--ink-faint); font-size: 13px; }
  .demo textarea { width: 100%; font-family: var(--mono); font-size: 13px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); resize: vertical; }
  .demo-controls { display: flex; align-items: center; gap: 12px; margin-top: 10px; flex-wrap: wrap; }
  .demo button { background: var(--accent); color: #fff; border: 0; border-radius: 10px; padding: 9px 18px; font: 700 13.5px "Segoe UI", system-ui, sans-serif; cursor: pointer; }
  .demo button:hover { filter: brightness(1.08); }
  .demo pre { margin-top: 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; font-family: var(--mono); font-size: 13px; min-height: 44px; white-space: pre-wrap; }
  footer { margin-top: 46px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--ink-faint); font-size: 12.5px; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <p class="kicker">Project overview</p>
    <h1>${escapeHtml(name)}</h1>
    <p class="idea">${escapeHtml(idea)}</p>
    <div class="chips">
      <span class="chip">${escapeHtml(typeLabel)}</span>
      <span class="chip">${escapeHtml(stackLabel)}</span>
      ${score != null ? `<span class="chip ${tone}">Feasibility ${score}/100 · ${escapeHtml(feas.verdict || '')}</span>` : ''}
      ${feas.estimate ? `<span class="chip">Est. effort · ${escapeHtml(feas.estimate)}</span>` : ''}
    </div>
  </header>

  <section>
    <h2>Live demo — ${escapeHtml('the core, running')}</h2>
    <div class="card demo">
      <p class="muted">This page runs the same slice your <code>${escapeHtml(coreEntry)}</code> implements today, in the browser —
      no install, no server. Type an input and watch the first step of the spine
      (<code>${escapeHtml(steps[0])} → … → ${escapeHtml(steps[steps.length - 1])}</code>) produce output.</p>
      <div style="margin-top:12px">
        <textarea id="demo-input" rows="3" spellcheck="false" aria-label="Demo input">  ${escapeHtml('hello from the draft — trim me!')}  </textarea>
        <div class="demo-controls">
          <button id="demo-run" type="button">Run core</button>
          <span id="demo-status" class="muted">engine() mirrors the placeholder in the core module — replace it as you implement</span>
        </div>
        <pre id="demo-output" aria-label="Demo output">…</pre>
      </div>
    </div>
  </section>

  <section>
    <h2>Feasibility</h2>
    <div class="cards">
      <div class="card">
        <div class="score-row">
          <span class="score-num ${tone}">${score != null ? score : '—'}</span>
          <span>
            <div class="score-sub">out of 100</div>
            <div class="score-sub">${escapeHtml(feas.verdict || 'Run the pipeline for a verdict')}</div>
          </span>
        </div>
        <div style="margin-top:14px">${axesHtml}</div>
      </div>
      <div class="card">
        <h3>Data-flow spine</h3>
        <div class="flow">
${flowHtml}
        </div>
        <p class="muted" style="margin-top:12px">Keep every step pure and deterministic; adapters stay thin.</p>
      </div>
    </div>
  </section>

  <section>
    <h2>Modules</h2>
    <div class="card">
${modulesHtml}
    </div>
  </section>

  <section>
    <h2>Milestones</h2>
    <div class="cards">
${milestonesHtml}
    </div>
  </section>

  <section>
    <h2>Principles</h2>
    <div class="card">
      <ul class="ul-principles">
${principles.map(p2 => `<li>${escapeHtml(p2)}</li>`).join('\n')}
      </ul>
    </div>
  </section>

  <section>
    <h2>Run it</h2>
    <table>
${commandsHtml}
    </table>
    <p class="muted" style="margin-top:10px">Open <code>README.md</code> for the long version, <code>PLAN.md</code> for the full milestone plan.</p>
  </section>

  <footer>
    Generated by <a href="https://github.com/suzannet-menon/AbridgeAI">AbridgeAI</a> — from rough idea to build-ready plan.
  </footer>

</div>
<script>
  // ── Demo engine ──────────────────────────────────────────────────────
  // Mirrors the placeholder slice shipped in the core module (trim).
  // Replace this ONE function with the real transform as you implement —
  // everything else on this page keeps working.
  function engine(input) {
    return String(input).trim();
  }

  var demoInput = document.getElementById('demo-input');
  var demoRun = document.getElementById('demo-run');
  var demoOutput = document.getElementById('demo-output');
  var demoStatus = document.getElementById('demo-status');

  function render() {
    var raw = demoInput.value;
    var result = engine(raw);
    demoOutput.textContent = JSON.stringify(result) +
      (result === '' ? '   // empty in → empty out' : '');
    demoStatus.textContent = 'input ' + raw.length + ' chars → output ' + result.length +
      ' chars · engine() mirrors the placeholder slice';
  }

  demoRun.addEventListener('click', render);
  demoInput.addEventListener('input', render);
  render();
</script>
</body>
</html>
`;
}

export function scaffoldFiles(input, slug, ctx) {
  const name = input.name || slug;
  const desc = input.idea || 'A deterministic tool.';
  const lang = starterLanguageFor(input);
  const stackKey = ['python', 'go', 'rust'].includes(lang) ? lang : 'typescript';
  const p = planContext(input, ctx, slug);

  let starter;
  if (stackKey === 'python') starter = pyStarter(slug, name, desc, p);
  else if (stackKey === 'go') starter = goStarter(slug, name, desc, p);
  else if (stackKey === 'rust') starter = rustStarter(slug, name, desc, p);
  else starter = tsStarter(slug, name, desc, p);

  const ctxForDocs = { input, ctx, stackKey, slug };
  const plan = { path: 'PLAN.md', content: planMarkdown(ctxForDocs) };
  const readme = { path: 'README.md', content: readmeMarkdown(ctxForDocs) };
  const overview = { path: 'index.html', content: overviewHtml(ctxForDocs) };

  return [plan, readme, overview, ...starter];
}

export function getScaffoldTree(files, rootName) {
  const root = {};
  files.forEach(f => {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach(part => { if (!node[part]) node[part] = {}; node = node[part]; });
  });
  const lines = [];
  if (rootName) lines.push(rootName + '/');
  (function walk(node, prefix) {
    const keys = Object.keys(node).sort();
    keys.forEach((k, i) => {
      const last = i === keys.length - 1;
      const children = node[k];
      const label = k + (Object.keys(children).length ? '/' : '');
      lines.push(prefix + (last ? '└── ' : '├── ') + label);
      if (Object.keys(children).length) walk(children, prefix + (last ? '    ' : '│   '));
    });
  })(root, '');
  return lines;
}

export { filePurpose };