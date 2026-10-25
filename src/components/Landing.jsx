import { useEffect, useRef } from 'react';

const STEPS = [
  { key: 'github',       index: '01', name: 'Builder Signals',          desc: 'Reads your public GitHub profile and top repos, or falls back to sample data if the API is unreachable. Personalizes the plan to your actual language history.' },
  { key: 'research',     index: '02', name: 'Research & Opportunities',  desc: 'A deterministic opportunity, risk, and direction scan for the idea as written.' },
  { key: 'feasibility',  index: '03', name: 'Feasibility Assessment',    desc: 'Scores the idea across five weighted axes and returns a GO, proceed-with-caution, or rethink verdict, an effort estimate, and a risk register.' },
  { key: 'architecture', index: '04', name: 'Architecture Direction',    desc: 'A module breakdown and data-flow blueprint sized to the idea.' },
  { key: 'stack',        index: '05', name: 'Tech Stack Recommendation', desc: 'A stack recommendation — TypeScript, Python, Go, Rust, or your custom combination — matched to your comfort level.' },
  { key: 'builder',      index: '06', name: 'Builder Plan & Scaffold',   desc: 'A starter file tree, starter files, and a milestone checklist — download it as a real, unzippable project.' },
  { key: 'brief',        index: '07', name: 'Implementation Plan',       desc: 'Assembles a complete, build-ready implementation plan with next steps, MVP guidance, and milestone targets.' },
  { key: 'deepdive',     index: '08', name: 'Deep Dive',                desc: 'Module notes, extra test cases, and pitfalls — the pre-build read that keeps the build honest. Optional, Jarvislabs-first.' },
];

const DEMO_SCORE = 82;

export default function Landing({ onEnter }) {
  const frameRef = useRef(0);
  const pipelineRef = useRef(null);
  const stepsRef = useRef(null);
  const arcRef = useRef(null);
  const scoreRef = useRef(null);
  const verdictRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const r = 32;
    const circumference = 2 * Math.PI * r;

    if (arcRef.current) {
      arcRef.current.style.strokeDasharray = circumference.toFixed(2);
      arcRef.current.style.strokeDashoffset = circumference.toFixed(2);
    }

    function setFrame(index) {
      STEPS.forEach((step, i) => {
        const row = pipelineRef.current?.querySelector(`[data-step="${step.key}"]`);
        const howRow = stepsRef.current?.querySelector(`[data-step="${step.key}"]`);
        const status = row?.querySelector('.tl-status');
        row?.classList.remove('is-done', 'is-running');
        howRow?.classList.remove('is-active');

        if (i < index) { row?.classList.add('is-done'); if (status) status.textContent = 'completed'; }
        else if (i === index) { row?.classList.add('is-running'); if (status) status.textContent = 'in progress'; howRow?.classList.add('is-active'); }
        else { if (status) status.textContent = 'queued'; }
      });

      const feasReached = index >= 2;
      const pct = feasReached ? DEMO_SCORE / 100 : 0;
      if (arcRef.current) arcRef.current.style.strokeDashoffset = (circumference * (1 - pct)).toFixed(2);
      if (scoreRef.current) scoreRef.current.textContent = feasReached ? DEMO_SCORE : 0;
      if (verdictRef.current) { verdictRef.current.textContent = feasReached ? 'GO' : 'Running…'; verdictRef.current.setAttribute('data-verdict', 'good'); }
    }

    if (reduceMotion) { setFrame(2); return; }

    frameRef.current = 0;
    setFrame(0);
    const timer = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % STEPS.length;
      setFrame(frameRef.current);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="landing">
      {/* Navbar */}
      <header>
        <nav className="l-nav" aria-label="Primary">
          <a className="l-brand" href="/">
            <img src="/logo.png" alt="AbridgeAI" className="navbar-logo" />
          </a>
          <button type="button" className="l-nav-cta" onClick={onEnter} id="landing-enter-btn">
            Open Dashboard <span className="l-arrow" aria-hidden="true">→</span>
          </button>
        </nav>
      </header>

      <main id="l-main">
        {/* Hero */}
        <section className="l-hero">
          <h1 className="l-headline l-fade-in">
            Score the idea, <em>scaffold the stack</em>, skip the blank page.
          </h1>
          <p className="l-sub l-fade-in l-delay-1">
            AbridgeAI runs a deterministic planning pipeline on your idea — a feasibility score,
            an architecture blueprint, a downloadable starter scaffold, and a complete
            implementation plan. LLM calls are optional enrichment; the core plan stands on its own.
          </p>
          <div className="l-badges l-fade-in l-delay-2">
            <span className="l-badge"><span className="l-badge-dot" aria-hidden="true" />Feasibility scored /100</span>
            <span className="l-badge"><span className="l-badge-dot" aria-hidden="true" />Scaffold downloads as .zip</span>
            <span className="l-badge"><span className="l-badge-dot" aria-hidden="true" />Works even offline-free fallbacks</span>
            <span className="l-badge"><span className="l-badge-dot" aria-hidden="true" />Custom stack support</span>
          </div>
        </section>

        {/* Product preview */}
        <section className="l-stage" aria-hidden="true">
          <div className="l-window">
            <div className="l-window-bar">
              <span className="l-window-strip" />
              <span className="l-window-label">Overview</span>
            </div>

            <div className="metrics-row">
              <div className="metric"><span className="metric-label">Projects</span><span className="metric-value">6</span></div>
              <div className="metric"><span className="metric-label">Feasibility avg</span><span className="metric-value">78%</span></div>
              <div className="metric"><span className="metric-label">Scaffolds</span><span className="metric-value">6</span></div>
              <div className="metric"><span className="metric-label">Plans ready</span><span className="metric-value">6</span></div>
            </div>

            <div className="l-window-body">
              <section className="ov-section">
                <h2>Planning pipeline</h2>
                <ol className="timeline" id="l-preview-pipeline" ref={pipelineRef}>
                  {STEPS.map(step => (
                    <li key={step.key} className="tl-row" data-step={step.key}>
                      <span className="tl-node">
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="tl-name">{step.name}</span>
                      <span className="tl-status">queued</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="ov-section">
                <h2>Feasibility</h2>
                <div className="feas-arc-wrap">
                  <svg className="feas-arc" width="72" height="72" viewBox="0 0 76 76">
                    <circle className="feas-arc-track" cx="38" cy="38" r="32" />
                    <circle className="feas-arc-fill" ref={arcRef} cx="38" cy="38" r="32" transform="rotate(-90 38 38)" />
                    <text className="feas-arc-num" ref={scoreRef} x="38" y="35">0</text>
                    <text className="feas-arc-max" x="38" y="50">/100</text>
                  </svg>
                  <p className="feas-verdict-line" ref={verdictRef} data-verdict="good">Running…</p>
                </div>
                <div className="feas-axes">
                  <div className="feas-axis-row"><span className="feas-axis-label">Idea clarity</span><span className="feas-axis-track"><span className="feas-axis-fill" style={{ width: '86%' }} /></span><span className="feas-axis-val">26/30</span></div>
                  <div className="feas-axis-row"><span className="feas-axis-label">Stack fit</span><span className="feas-axis-track"><span className="feas-axis-fill" style={{ width: '80%' }} /></span><span className="feas-axis-val">20/25</span></div>
                  <div className="feas-axis-row"><span className="feas-axis-label">Scope</span><span className="feas-axis-track"><span className="feas-axis-fill" style={{ width: '90%' }} /></span><span className="feas-axis-val">18/20</span></div>
                </div>
              </section>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="l-how">
          <div className="l-how-head">
            <h2>Eight stages, one run</h2>
            <p>Watch the preview above — the real pipeline runs in the app, stage by stage, with honest fallbacks.</p>
          </div>
          <ol className="l-steps" ref={stepsRef}>
            {STEPS.map(step => (
              <li key={step.key} className="l-step" data-step={step.key}>
                <span className="l-step-index">{step.index}</span>
                <div>
                  <p className="l-step-name">{step.name}</p>
                  <p className="l-step-desc">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="l-cta">
          <h2>Bring an idea. Leave with a plan and a scaffold.</h2>
          <button type="button" className="l-cta-btn" onClick={onEnter} id="landing-cta-btn">
            Start planning <span className="l-arrow" aria-hidden="true">→</span>
          </button>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-left">
            <span>© 2026 AbridgeAI — All rights reserved.</span>
          </div>
          <div className="l-footer-links">
            <span>Apache-2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
