import { useState, useEffect, useCallback } from 'react';
import Landing from './components/Landing.jsx';

import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Pipeline from './components/Pipeline.jsx';
import ProjectForm from './components/ProjectForm.jsx';
import OutputCard from './components/OutputCard.jsx';
import FeasibilityCard from './components/FeasibilityCard.jsx';
import BuilderCard from './components/BuilderCard.jsx';
import BriefCard from './components/BriefCard.jsx';
import Toast from './components/Toast.jsx';

import { startJob, pollJob, runPlan, exportBrief } from './api/client.js';

import {
  readHistory, saveToHistory, deleteFromHistory, clearHistory,
  readDraft, clearDraft, readTheme, writeTheme, getSystemTheme,
  RECORD_VERSION,
} from './utils/storage.js';
import { downloadFile } from './utils/export.js';

const STAGE_KEYS = ['github', 'research', 'feasibility', 'architecture', 'stack', 'builder', 'brief', 'deepdive'];

function modeBadge(mode) {
  if (mode === 'llm') return 'Gemini · live';
  if (mode === 'groq') return 'Groq · live';
  if (mode === 'jarvislabs') return 'Jarvislabs · live';
  if (mode === 'cached-llm') return 'LLM · cached';
  if (mode === 'deterministic') return 'fallback';
  return undefined;
}

export default function App() {
  const [view, setView] = useState('landing');
  const [theme, setTheme] = useState(() => readTheme() || getSystemTheme());
  const [history, setHistory] = useState(() => readHistory());
  const [activeId, setActiveId] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);

  // Pipeline state
  const [pipelineState, setPipelineState] = useState('standby');
  const [statuses, setStatuses] = useState({});
  const [results, setResults] = useState(null);
  const [stageErrors, setStageErrors] = useState({});

  // Form restore
  const [restoreData, setRestoreData] = useState(() => readDraft());

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#151310' : '#b6e62c';
  }, [theme]);

  // System theme listener
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => { if (!readTheme()) setTheme(e.matches ? 'dark' : 'light'); };
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
    } else if (mql.addListener) {
      mql.addListener(handler);
    }
    return () => {
      if (mql.removeEventListener) {
        mql.removeEventListener('change', handler);
      } else if (mql.removeListener) {
        mql.removeListener(handler);
      }
    };
  }, []);

  const showToast = useCallback(msg => setToast(msg), []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    writeTheme(next); setTheme(next);
    showToast(next === 'dark' ? 'Dark theme on.' : 'Light theme on.');
  };

  const resetPipeline = () => {
    setStatuses({});
    setResults(null);
    setStageErrors({});
    setPipelineState('standby');
  };

  // ── Pipeline runner ──────────────────────────────────────────
  // Preferred path: background job with real per-stage progress. If the
  // job endpoint is unreachable/not available, fall back to the
  // synchronous run and reveal stages in order.
  const runPipeline = async (input) => {
    if (running) return;
    setRunning(true);
    setResults(null);
    setStatuses({});
    setStageErrors({});
    setPipelineState('running');
    setView('overview');

    try {
      let newResults;
      let newStageErrors;
      try {
        const job = await startJob(input);
        const finished = await pollJob(job.id, j => {
          if (j.stages) setStatuses({ ...j.stages });
        });
        newResults = finished.results;
        newStageErrors = finished.errors || {};
      } catch (jobErr) {
        // Backend without job support (or a hiccup while starting/polling):
        // fall back to the one-shot synchronous run with staged reveal.
        // A genuine timeout must NOT be retried in sync mode.
        if (jobErr.message.code === 'TIMEOUT' || jobErr.message.includes('timed out')) throw jobErr;
        ({ results: newResults, errors: newStageErrors } = await runPlan(input));
        STAGE_KEYS.forEach((key, i) => {
          setTimeout(() => {
            setStatuses(prev => ({ ...prev, [key]: newStageErrors?.[key] ? 'error' : 'done' }));
          }, i * 140);
        });
      }

      setResults(newResults);
      setStageErrors(newStageErrors || {});
      setStatuses(prev => {
        const next = { ...prev };
        STAGE_KEYS.forEach(key => {
          next[key] = newStageErrors?.[key] ? 'error' : (next[key] === 'queued' ? 'done' : next[key]);
        });
        return next;
      });
      setPipelineState('complete');
      setResults(newResults);

      // Save to history
      if (input.idea) {
        const record = {
          version: RECORD_VERSION,
          id: Date.now().toString(36),
          name: input.name, stack: input.stack, customStack: input.customStack,
          github: input.github, idea: input.idea, deadline: input.deadline,
          comfort: input.comfort, type: input.type, team: input.team, audience: input.audience,
          time: new Date().toLocaleString(),
          outputs: newResults,
        };
        setCurrentProject(record);
        setActiveId(record.id);
        saveToHistory(record);
        setHistory(readHistory());
        clearDraft();
      }
    } catch (err) {
      console.error(err);
      showToast('Something went wrong — please try again.');
      resetPipeline();
    } finally {
      setRunning(false);
    }
  };

  // ── Load a saved project ─────────────────────────────────────
  const loadProject = (item) => {
    setRestoreData(item);
    setActiveId(item.id);
    setCurrentProject(item);

    if (!item.outputs) {
      setResults(null);
      resetPipeline();
      showToast('Run the pipeline to generate outputs for this project.');
      setView('new');
      return;
    }

    // normalize() in readHistory has already ensured the record is in the
    // current schema (e.g. feasibility.axes is present). No agent re-run needed.
    setResults(item.outputs);
    setStatuses({ github: 'done', research: 'done', feasibility: 'done', architecture: 'done', stack: 'done', builder: 'done', brief: 'done', deepdive: 'done' });
    setPipelineState('complete');
    setView('overview');
    showToast('Loaded saved project outputs.');
  };

  const handleDeleteHistory = (id) => {
    deleteFromHistory(id);
    setHistory(readHistory());
    if (activeId === id) { setCurrentProject(null); setActiveId(null); setResults(null); resetPipeline(); }
    showToast('Project removed from history.');
  };

  const handleClearHistory = () => {
    if (!history.length) return;
    if (window.confirm('Clear all saved projects? This cannot be undone.')) {
      clearHistory(); setHistory([]); setCurrentProject(null); setActiveId(null);
      setResults(null); resetPipeline();
      showToast('History cleared.');
    }
  };

  const handleEnterFromLanding = () => {
    setView('overview');
  };

  const handleExport = async () => {
    if (!currentProject) return;
    try {
      const { filename, markdown } = await exportBrief(currentProject);
      downloadFile(filename, markdown);
      showToast('Project brief exported.');
    } catch (err) {
      console.error(err);
      showToast('Export failed — is the backend running?');
    }
  };

  // ── Metrics (derived from history) ─────────────────────────
  const metrics = (() => {
    const items = history;
    const feasScores = items.filter(it => it.outputs?.feasibility?.score != null).map(it => it.outputs.feasibility.score);
    return {
      projects: items.length,
      feasAvg: feasScores.length ? Math.round(feasScores.reduce((a, b) => a + b, 0) / feasScores.length) : null,
      scaffolds: items.filter(it => it.outputs?.builder?.files?.length).length,
      plans: items.filter(it => it.outputs?.brief).length,
    };
  })();

  // ── Status line ──────────────────────────────────────────────
  const statusText = running ? 'running pipeline…' : pipelineState === 'complete' ? `complete · ${currentProject?.time || ''}` : 'idle';
  const statusState = running ? 'running' : pipelineState === 'complete' ? 'done' : 'idle';

  if (view === 'landing') {
    return <Landing onEnter={handleEnterFromLanding} />;
  }

  return (
    <div className="shell">
      <Sidebar
        history={history}
        activeId={activeId}
        onLoad={loadProject}
        onDelete={handleDeleteHistory}
        onClear={handleClearHistory}
        onOverview={() => setView('overview')}
      />

      <div className="workspace">
        <Header
          onNewProject={() => setView('new')}
          onToggleTheme={toggleTheme}
          theme={theme}
          onExport={handleExport}
          canExport={!!currentProject}
        />

        <main className="main" id="main">
          <a className="skip-link" href="#main">Skip to content</a>

          {/* ── OVERVIEW VIEW ── */}
          {view === 'overview' && (
            <section className="view" id="view-overview">
              <div className="view-head">
                <div>
                  <h1>Overview</h1>
                  <p className="view-sub">
                    Turn a rough idea into a structured, feasible, build-ready project plan.
                    Run the planning pipeline on an idea to get a feasibility assessment,
                    architecture direction, tech stack recommendation, starter scaffold, and
                    a complete implementation plan.
                  </p>
                </div>
              </div>

              <div className="metrics-row">
                <div className="metric">
                  <span className="metric-label">Projects</span>
                  <span className="metric-value" id="m-projects">{metrics.projects}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Feasibility avg</span>
                  <span className="metric-value" id="m-feas">{metrics.feasAvg == null ? '—' : `${metrics.feasAvg}%`}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Scaffolds</span>
                  <span className="metric-value" id="m-scaffolds">{metrics.scaffolds}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Plans ready</span>
                  <span className="metric-value" id="m-tasks">{metrics.plans}</span>
                </div>
              </div>

              <div className="overview-grid">
                <Pipeline
                  statuses={statuses}
                  feasibility={results?.feasibility}
                  pipelineState={pipelineState}
                  stageErrors={stageErrors}
                />
              </div>

              <p className="status-line" id="status" data-state={statusState} aria-live="polite">
                <span className="status-dot" aria-hidden="true" />
                <span id="status-text">{statusText}</span>
              </p>

              {results && (
                <section className="outputs-section" id="outputs-panel">
                  <div className="outputs-head">
                    <h2>Planning results</h2>
                  </div>
                  <div className="outputs" id="outputs">
                    <OutputCard index={1} title="Builder Signals (GitHub Analysis)" agent="github"
                      body={results.github.text} badge={results.github.badge}
                      copyable={results.github.text} onToast={showToast} />
                    <OutputCard index={2} title="Research & Opportunity Analysis" agent="research"
                      body={results.research?.text ?? results.research} copyable={results.research?.text ?? results.research}
                      badge={modeBadge(results.research?.mode)} onToast={showToast} />
                    <FeasibilityCard feasibility={results.feasibility} onToast={showToast} />
                    <OutputCard index={4} title="Architecture Direction" agent="architecture"
                      body={results.architecture?.text ?? results.architecture} copyable={results.architecture?.text ?? results.architecture}
                      badge={modeBadge(results.architecture?.mode)} onToast={showToast} />
                    <OutputCard index={5} title="Tech Stack Recommendation" agent="stack"
                      body={results.stack?.text ?? results.stack} copyable={results.stack?.text ?? results.stack} onToast={showToast} />
                    <BuilderCard builder={results.builder} onToast={showToast} />
                    <BriefCard brief={results.brief} onToast={showToast} />
                    <OutputCard index={8} title="Deep Dive (module notes · extra tests)" agent="deepdive"
                      body={results.deepdive?.text} copyable={results.deepdive?.text}
                      badge={modeBadge(results.deepdive?.mode)} onToast={showToast} />
                  </div>
                </section>
              )}

              {!results && !running && (
                <div className="no-results-cta">
                  <p>Ready to plan your next project?</p>
                  <button type="button" className="btn btn--primary" onClick={() => setView('new')}>
                    + Start a new project
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ── NEW PROJECT VIEW ── */}
          {view === 'new' && (
            <ProjectForm
              onSubmit={runPipeline}
              initialData={restoreData}
              onBack={() => setView('overview')}
              running={running}
              onToast={showToast}
            />
          )}
        </main>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
