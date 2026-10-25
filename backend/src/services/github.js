import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithTimeout, GITHUB_TIMEOUT_MS } from '../utils/fetchTimeout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = path.resolve(__dirname, '../../../public/data/sample-github-analysis.json');

function parseGitHubProfile(profile) {
  return {
    login: profile.login || 'unknown',
    name: profile.name || profile.login || 'Unknown',
    bio: profile.bio || null,
    location: profile.location || null,
    company: profile.company || null,
    blog: profile.blog || null,
    publicRepos: profile.public_repos != null ? profile.public_repos : 0,
    followers: profile.followers != null ? profile.followers : 0,
    following: profile.following != null ? profile.following : 0,
    htmlUrl: profile.html_url || null,
    createdAt: profile.created_at || null,
  };
}

function tallyLanguages(repos) {
  const tally = {};
  (repos || []).forEach(repo => {
    if (repo.language) tally[repo.language] = (tally[repo.language] || 0) + 1;
  });
  return Object.keys(tally)
    .map(k => ({ language: k, count: tally[k] }))
    .sort((a, b) => b.count - a.count);
}

function summarizeRepos(repos) {
  return (repos || [])
    .slice()
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 4)
    .map(r => ({
      name: r.name || r.full_name || '?',
      description: r.description || null,
      language: r.language || null,
      stars: r.stargazers_count != null ? r.stargazers_count : 0,
    }));
}

// ── Built-in last-resort fallback ─────────────────────────────────────────────
// Mirrors public/data/sample-github-analysis.json. Only used when the file
// cannot be read (unlikely in Node) — kept for resilience.
const BUILTIN_SAMPLE_RAW = {
  profile: {
    login: 'octocat', name: 'The Octocat',
    bio: 'Curious cat. Builder of small, useful things.',
    location: 'San Francisco, CA', company: '@github', blog: null,
    public_repos: 8, followers: 20124, following: 9,
    html_url: 'https://github.com/octocat', created_at: '2011-01-25T18:44:36Z',
  },
  repos: [
    { name: 'Hello-World',     description: 'My first repository on GitHub!',                         language: 'TypeScript', stargazers_count: 2621 },
    { name: 'Spoon-Knife',     description: 'This repo is for demonstration purposes only.',          language: 'JavaScript', stargazers_count: 12802 },
    { name: 'github-bot',      description: 'A small bot that triages issues with labels.',           language: 'TypeScript', stargazers_count: 341 },
    { name: 'notes-to-actions',description: 'CLI that turns meeting notes into action items.',        language: 'Python',     stargazers_count: 187 },
    { name: 'rail-scheduler',  description: 'Priority-queue based scheduler for web workers.',        language: 'TypeScript', stargazers_count: 96 },
    { name: 'weather-cli',     description: 'Weather forecasts in your terminal, no API key needed.', language: 'Go',         stargazers_count: 74 },
    { name: 'spellcheck-rs',   description: 'Fast fuzzy spell checker with a tiny footprint.',        language: 'Rust',       stargazers_count: 213 },
  ],
};

function loadSampleGitHub() {
  try {
    const raw = fs.readFileSync(SAMPLE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      source: 'sample',
      profile: parseGitHubProfile(data.profile),
      languages: tallyLanguages(data.repos),
      repos: summarizeRepos(data.repos),
    };
  } catch {
    const data = BUILTIN_SAMPLE_RAW;
    return {
      source: 'sample',
      profile: parseGitHubProfile(data.profile),
      languages: tallyLanguages(data.repos),
      repos: summarizeRepos(data.repos),
    };
  }
}

export async function fetchGitHub(username) {
  const user = String(username || '').trim().replace(/^@/, '');
  if (!user) return loadSampleGitHub();

  if (typeof fetch !== 'function') return loadSampleGitHub();
  try {
    const headers = { 'User-Agent': 'AbridgeAI/0.1 (hack-day demo)' };
    const profileRes = await fetchWithTimeout(
      `https://api.github.com/users/${encodeURIComponent(user)}`,
      { headers },
      GITHUB_TIMEOUT_MS,
    );
    if (!profileRes.ok) throw new Error(`GitHub profile status ${profileRes.status}`);
    const profile = await profileRes.json();
    const reposRes = await fetchWithTimeout(
      `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=updated`,
      { headers },
      GITHUB_TIMEOUT_MS,
    );
    const repos = reposRes.ok ? await reposRes.json() : [];
    return {
      source: 'live',
      profile: parseGitHubProfile(profile),
      languages: tallyLanguages(repos),
      repos: summarizeRepos(repos),
    };
  } catch {
    return loadSampleGitHub();
  }
}