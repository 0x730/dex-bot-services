const {
  chmodSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} = require('fs');
const https = require('https');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const ROOT = resolve(__dirname, '..');
const GITHUB_API = 'api.github.com';

function parseArgs(argv) {
  const args = {
    envFile: '.env.release.local',
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--env') args.envFile = argv[++index];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run release:public:publish
  npm run release:public:publish -- --env .env.release.local
  npm run release:public:publish -- --dry-run
`);
}

function parseEnvFile(envPath) {
  if (!existsSync(envPath)) {
    throw new Error(`Missing release env file: ${envPath}`);
  }

  const parsed = {};
  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function requireValue(config, key) {
  const value = config[key] || process.env[key];
  if (!value || value.startsWith('replace_with_')) {
    throw new Error(`Missing required release value: ${key}`);
  }
  return value;
}

function run(command, args, options = {}) {
  if (options.dryRun) {
    console.log(`[dry-run] ${command} ${args.join(' ')}`);
    return '';
  }

  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: options.env || process.env,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
  return result.stdout || '';
}

function githubRequest(token, method, path, body) {
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolveRequest, rejectRequest) => {
    const req = https.request(
      {
        hostname: GITHUB_API,
        path,
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'dex-bot-services-release',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          let parsed = {};
          if (responseBody) {
            try {
              parsed = JSON.parse(responseBody);
            } catch (error) {
              parsed = { message: responseBody };
            }
          }
          resolveRequest({ statusCode: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', rejectRequest);
    if (payload) req.write(payload);
    req.end();
  });
}

async function githubJson(
  token,
  method,
  path,
  body,
  allowedStatusCodes = [200]
) {
  const response = await githubRequest(token, method, path, body);
  if (!allowedStatusCodes.includes(response.statusCode)) {
    const message = response.body?.message || `HTTP ${response.statusCode}`;
    throw new Error(`GitHub API ${method} ${path} failed: ${message}`);
  }
  return response.body;
}

function parseSemver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function formatSemver(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

async function resolveReleaseVersion(config, token, dryRun) {
  const configured =
    config.RELEASE_VERSION || process.env.RELEASE_VERSION || 'auto';
  if (configured && configured.toLowerCase() !== 'auto') {
    if (!parseSemver(configured)) {
      throw new Error('RELEASE_VERSION must be semver like 1.2.3 or auto.');
    }
    return configured.replace(/^v/, '');
  }

  if (dryRun) {
    const dryRunVersion = config.RELEASE_DRY_RUN_VERSION || '0.0.1';
    if (!parseSemver(dryRunVersion)) {
      throw new Error('RELEASE_DRY_RUN_VERSION must be semver like 0.0.1.');
    }
    return dryRunVersion.replace(/^v/, '');
  }

  const repo = requireValue(config, 'GITHUB_REPO');
  const versions = [];

  try {
    const releases = await githubJson(
      token,
      'GET',
      `/repos/${repo}/releases?per_page=100`,
      undefined,
      [200, 404]
    );
    if (Array.isArray(releases)) {
      versions.push(
        ...releases
          .map((release) => parseSemver(release.tag_name))
          .filter(Boolean)
      );
    }
  } catch (error) {
    // A brand-new repository may not exist yet. Start from 0.0.1 below.
  }

  try {
    const tags = await githubJson(
      token,
      'GET',
      `/repos/${repo}/tags?per_page=100`,
      undefined,
      [200, 404]
    );
    if (Array.isArray(tags)) {
      versions.push(
        ...tags.map((tag) => parseSemver(tag.name)).filter(Boolean)
      );
    }
  } catch (error) {
    // A brand-new repository may not exist yet. Start from 0.0.1 below.
  }

  if (versions.length === 0) {
    return '0.0.1';
  }

  versions.sort(compareSemver);
  const latest = versions[versions.length - 1];
  return formatSemver({ ...latest, patch: latest.patch + 1 });
}

function assertConfig(config) {
  const repo = requireValue(config, 'GITHUB_REPO');
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error('GITHUB_REPO must be in OWNER/REPO format.');
  }

  requireValue(config, 'PUBLIC_RELEASE_DIR');
  requireValue(config, 'GIT_AUTHOR_NAME');
  requireValue(config, 'GIT_AUTHOR_EMAIL');

  const token =
    config.GITHUB_PAT || process.env.GITHUB_PAT || process.env.GH_TOKEN;
  if (!token || token.startsWith('replace_with_')) {
    throw new Error(
      'Missing GitHub token. Set GITHUB_PAT in .env.release.local.'
    );
  }

  if ((config.RELEASE_SECRETS_ROTATED || '').toLowerCase() !== 'true') {
    throw new Error(
      'Set RELEASE_SECRETS_ROTATED=true only after rotating every historical secret.'
    );
  }

  const replaceMain = (config.RELEASE_REPLACE_MAIN || 'false').toLowerCase();
  if (!['true', 'false'].includes(replaceMain)) {
    throw new Error('RELEASE_REPLACE_MAIN must be true or false.');
  }
}

async function ensureGitHubRepository({ token, repo, visibility, dryRun }) {
  if (dryRun) {
    console.log(
      `[dry-run] GitHub API ensure repository ${repo} (${visibility})`
    );
    return;
  }

  const existing = await githubRequest(token, 'GET', `/repos/${repo}`);
  if (existing.statusCode === 200) return;
  if (existing.statusCode !== 404) {
    const message = existing.body?.message || `HTTP ${existing.statusCode}`;
    throw new Error(`GitHub API GET /repos/${repo} failed: ${message}`);
  }

  const [owner, repoName] = repo.split('/');
  const user = await githubJson(token, 'GET', '/user');
  const body = {
    name: repoName,
    private: visibility === 'private',
    auto_init: false,
  };

  if (user.login.toLowerCase() === owner.toLowerCase()) {
    await githubJson(token, 'POST', '/user/repos', body, [201]);
  } else {
    await githubJson(token, 'POST', `/orgs/${owner}/repos`, body, [201]);
  }
}

function writeAskPass(outDir) {
  const askPassPath = resolve(outDir, '.git', 'github-pat-askpass.sh');
  writeFileSync(
    askPassPath,
    [
      '#!/bin/sh',
      'case "$1" in',
      '*Username*) echo "x-access-token" ;;',
      '*Password*) echo "$GITHUB_PAT" ;;',
      '*) echo "" ;;',
      'esac',
      '',
    ].join('\n')
  );
  chmodSync(askPassPath, 0o700);
  return askPassPath;
}

function withGitAuthEnv(env, outDir) {
  const askPassPath = writeAskPass(outDir);
  return {
    env: {
      ...env,
      GIT_ASKPASS: askPassPath,
      GIT_TERMINAL_PROMPT: '0',
    },
    cleanup: () => {
      try {
        unlinkSync(askPassPath);
      } catch (error) {
        // Best effort cleanup.
      }
    },
  };
}

async function createGitHubRelease({ token, repo, version, dryRun }) {
  if (dryRun) {
    console.log(`[dry-run] GitHub API create release ${repo} v${version}`);
    return;
  }

  await githubJson(
    token,
    'POST',
    `/repos/${repo}/releases`,
    {
      tag_name: `v${version}`,
      name: `v${version}`,
      generate_release_notes: true,
    },
    [201]
  );
}

async function hasRemoteMain({ token, repo, dryRun }) {
  if (dryRun) return true;

  const response = await githubRequest(
    token,
    'GET',
    `/repos/${repo}/git/ref/heads/main`
  );

  if (response.statusCode === 200) return true;
  if (response.statusCode === 404) return false;

  const message = response.body?.message || `HTTP ${response.statusCode}`;
  throw new Error(`GitHub API GET main ref failed: ${message}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const envPath = resolve(ROOT, args.envFile);
  const config = parseEnvFile(envPath);
  assertConfig(config);

  const repo = requireValue(config, 'GITHUB_REPO');
  const outDir = requireValue(config, 'PUBLIC_RELEASE_DIR');
  const visibility = config.GITHUB_REPO_VISIBILITY || 'public';
  if (!['public', 'private'].includes(visibility)) {
    throw new Error('GITHUB_REPO_VISIBILITY must be public or private.');
  }
  const replaceMain =
    (config.RELEASE_REPLACE_MAIN || 'false').toLowerCase() === 'true';

  const token =
    config.GITHUB_PAT || process.env.GITHUB_PAT || process.env.GH_TOKEN;
  const releaseEnv = {
    ...process.env,
    GITHUB_PAT: token,
    GITHUB_TOKEN: token,
  };
  const version = await resolveReleaseVersion(config, token, args.dryRun);

  const prepareArgs = [
    'run',
    'release:public:prepare',
    '--',
    '--out',
    outDir,
    '--version',
    version,
    '--github-repo',
    repo,
    '--force',
  ];
  if (args.dryRun) {
    prepareArgs.push('--dry-run');
  } else {
    prepareArgs.push('--secrets-rotated');
  }

  run('npm', prepareArgs, { env: releaseEnv });

  const gitAuthor = [
    '-c',
    `user.name=${requireValue(config, 'GIT_AUTHOR_NAME')}`,
    '-c',
    `user.email=${requireValue(config, 'GIT_AUTHOR_EMAIL')}`,
  ];

  run('git', ['add', '.'], {
    cwd: outDir,
    env: releaseEnv,
    dryRun: args.dryRun,
  });
  run('git', [...gitAuthor, 'commit', '-m', `Release ${version}`], {
    cwd: outDir,
    env: releaseEnv,
    dryRun: args.dryRun,
  });

  await ensureGitHubRepository({
    token,
    repo,
    visibility,
    dryRun: args.dryRun,
  });

  run('git', ['remote', 'add', 'origin', `https://github.com/${repo}.git`], {
    cwd: outDir,
    env: releaseEnv,
    dryRun: args.dryRun,
  });

  const gitAuth = args.dryRun
    ? { env: releaseEnv, cleanup: () => {} }
    : withGitAuthEnv(releaseEnv, outDir);

  try {
    const remoteMainExists = await hasRemoteMain({
      token,
      repo,
      dryRun: args.dryRun,
    });

    const pushMainArgs = ['push', '-u', 'origin', 'main'];
    if (replaceMain && remoteMainExists) {
      run(
        'git',
        ['fetch', '--depth=1', 'origin', 'main:refs/remotes/origin/main'],
        {
          cwd: outDir,
          env: gitAuth.env,
          dryRun: args.dryRun,
        }
      );
      pushMainArgs.push('--force-with-lease');
    }
    run('git', pushMainArgs, {
      cwd: outDir,
      env: gitAuth.env,
      dryRun: args.dryRun,
    });
    run('git', ['tag', `v${version}`], {
      cwd: outDir,
      env: releaseEnv,
      dryRun: args.dryRun,
    });
    run('git', ['push', 'origin', `v${version}`], {
      cwd: outDir,
      env: gitAuth.env,
      dryRun: args.dryRun,
    });
  } finally {
    gitAuth.cleanup();
  }

  await createGitHubRelease({ token, repo, version, dryRun: args.dryRun });

  if (args.dryRun) {
    console.log(`Dry run completed for ${repo} v${version}.`);
  } else {
    console.log(`Published ${repo} v${version}.`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
