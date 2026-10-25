import test from 'node:test';
import assert from 'node:assert/strict';
import { scaffoldFiles, getScaffoldTree } from '../../backend/src/scaffold/scaffold.js';

const CTX = {
  results: {
    architecture: {
      modules: ['ingest', 'core', 'render', 'notify'],
      shape: 'ingest -> normalize -> generate -> deliver',
      principles: ['Keep the core pure.', 'Adapters stay thin.'],
    },
    feasibility: {
      score: 72, verdict: 'GO', verdictClass: 'good', estimate: '3 weeks',
      axes: [{ label: 'Idea clarity', value: 24, max: 30 }, { label: 'Stack fit', value: 20, max: 25 }],
    },
    builder: {
      milestones: [
        { week: 1, title: 'Foundations', tasks: ['wire build', 'wire tests'], accept: 'build green' },
        { week: 2, title: 'Core slice', tasks: ['implement core'], accept: 'e2e green' },
      ],
    },
  },
};

function scaffold(input) {
  return scaffoldFiles(input, 'glue-tool', CTX);
}

test('every scaffold contains the docs trio + overview page', () => {
  for (const stack of ['typescript', 'python', { customStack: 'FastAPI + React' }]) {
    const input = typeof stack === 'string' ? { stack, name: 'Glue Tool', idea: 'a glue tool' } : { ...stack, name: 'Glue Tool', idea: 'a glue tool' };
    const paths = scaffold(input).map(f => f.path);
    const fixture = stack === 'typescript' ? 'test/fixtures/sample-input.txt' : 'fixtures/sample-input.txt';
    for (const required of ['PLAN.md', 'README.md', 'index.html', '.gitignore', fixture]) {
      assert.ok(paths.includes(required), `${required} missing for ${JSON.stringify(input.stack || input.customStack)}`);
    }
  }
});

test('index.html ships a live demo wired to the core slice', () => {
  const html = scaffold({ stack: 'python', name: 'Glue Tool', idea: 'a glue tool' }).find(f => f.path === 'index.html').content;
  assert.ok(html.includes('Live demo'), 'demo section present');
  assert.ok(html.includes('id="demo-input"'));
  assert.ok(html.includes('id="demo-run"'));
  assert.ok(html.includes('id="demo-output"'));
  // the engine mirrors the placeholder slice and tells the builder to replace it
  assert.ok(html.includes('function engine(input)'));
  assert.ok(html.includes('String(input).trim()'));
  assert.ok(html.includes('Replace this ONE function'));
  // it names the core module's current entry so the builder knows what mirrors what
  assert.ok(html.includes('src.core.run()'));
  // inline script only — never a remote dependency
  assert.ok(!/<script[^>]+src/i.test(html), 'no external scripts allowed');
});

test('demo names each stack entry point correctly', () => {
  const py = scaffold({ stack: 'python' }).find(f => f.path === 'index.html').content;
  assert.ok(py.includes('src.core.run()'));
  const ts = scaffold({ stack: 'typescript' }).find(f => f.path === 'index.html').content;
  assert.ok(ts.includes('src/core.ts run()'));
  const go = scaffold({ stack: 'go' }).find(f => f.path === 'index.html').content;
  assert.ok(go.includes('core.Run()'));
  const rs = scaffold({ stack: 'rust' }).find(f => f.path === 'index.html').content;
  assert.ok(rs.includes('core::run()'));
});

test('index.html is a complete, self-contained overview page', () => {
  const html = scaffold({ stack: 'python', name: 'Glue Tool', idea: 'a glue tool' }).find(f => f.path === 'index.html').content;
  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('</html>'));
  assert.ok(html.includes('Glue Tool'));
  assert.ok(html.includes('a glue tool')); // the idea renders
  assert.ok(html.includes('72'));          // feasibility score
  assert.ok(html.includes('Data-flow spine'));
  assert.ok(html.includes('Milestones'));
  assert.ok(html.includes('ingest'));      // architecture modules render
  assert.ok(html.includes('PLAN.md'));     // pointers to the docs
});

test('index.html escapes user input (idea is wrapped in quotes by us, html is safe)', () => {
  const evil = scaffold({ stack: 'python', name: '<script>alert(1)</script>' })
    .find(f => f.path === 'index.html').content;
  assert.ok(!evil.includes('<script>alert(1)</script>'));
  assert.ok(evil.includes('&lt;script&gt;'));
});

test('typescript starter ships multiple runnable vitest cases', () => {
  const body = scaffold({ stack: 'typescript' }).find(f => f.path === 'test/core.test.ts').content;
  assert.ok(body.includes("from 'vitest'"));
  assert.ok((body.match(/\bit\(/g) || []).length >= 3);
});

test('python starter ships multiple pytest cases', () => {
  const body = scaffold({ stack: 'python' }).find(f => f.path === 'tests/test_core.py').content;
  assert.ok((body.match(/def test_/g) || []).length >= 3);
});

test('go starter ships multiple testing cases', () => {
  const body = scaffold({ stack: 'go' }).find(f => f.path === 'core/core_test.go').content;
  assert.ok((body.match(/func Test/g) || []).length >= 2);
});

test('rust starter ships multiple #[test] cases', () => {
  const body = scaffold({ stack: 'rust' }).find(f => f.path === 'src/core.rs').content;
  assert.ok((body.match(/#\[test\]/g) || []).length >= 2);
});

test('custom stacks route to the right starter language', () => {
  const py = scaffold({ customStack: 'FastAPI + React + PostgreSQL' });
  assert.ok(py.find(f => f.path === 'pyproject.toml'));
  const ts = scaffold({ customStack: 'react + vue' });
  assert.ok(ts.find(f => f.path === 'package.json'));
});

test('README mentions the overview page and the test command', () => {
  const readme = scaffold({ stack: 'python' }).find(f => f.path === 'README.md').content;
  assert.ok(readme.includes('index.html'));
  assert.ok(readme.includes('uv run pytest'));
});

test('python pytest config makes bare `pytest` work from the project root', () => {
  const toml = scaffold({ stack: 'python' }).find(f => f.path === 'pyproject.toml').content;
  assert.ok(toml.includes('pythonpath = ["."]'), 'tests import src.* with plain pytest');
  assert.ok(toml.includes('[tool.pytest.ini_options]'));
});

test('PLAN.md carries the feasibility verdict and milestones', () => {
  const plan = scaffold({ stack: 'typescript' }).find(f => f.path === 'PLAN.md').content;
  assert.ok(plan.includes('72/100'));
  assert.ok(plan.includes('Core slice'));
  assert.ok(plan.includes('Done when:'));
});

test('file tree renders folders with a proper root', () => {
  const tree = getScaffoldTree(scaffold({ stack: 'python' }), 'glue-tool');
  assert.ok(tree[0] === 'glue-tool/');
  assert.ok(tree.some(l => l.includes('src/')));
  assert.ok(tree.some(l => l.includes('index.html')));
});
