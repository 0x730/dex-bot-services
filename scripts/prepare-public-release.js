const {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} = require('fs');
const { dirname, join, resolve } = require('path');
const { spawnSync } = require('child_process');

const ROOT = resolve(__dirname, '..');
const DEFAULT_OUT = '/tmp/bots-public-release';

function parseArgs(argv) {
  const args = {
    out: DEFAULT_OUT,
    force: false,
    skipVerify: false,
    dryRun: false,
    secretsRotated: false,
    githubRepo: '',
    version: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') args.out = argv[++index];
    else if (arg === '--force') args.force = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--secrets-rotated') args.secretsRotated = true;
    else if (arg === '--skip-verify') args.skipVerify = true;
    else if (arg === '--github-repo') args.githubRepo = argv[++index];
    else if (arg === '--version') args.version = argv[++index];
    else if (arg === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run release:public:prepare -- --out /tmp/bots-public --version 1.0.0 --github-repo 0x730/dex-bot-services --force

Options:
  --out DIR              Export directory. Default: ${DEFAULT_OUT}
  --version VERSION      Version used in printed tag/release commands.
  --github-repo 0x730/dex-bot-services
                         Repository used in printed publish commands.
  --force                Remove the output directory first when it exists.
  --dry-run              Run checks only and do not create the snapshot.
  --secrets-rotated      Required for snapshot creation. Confirms historical secrets were rotated.
  --skip-verify          Skip npm test and npm run check:public.
`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }

  return result.stdout || '';
}

function trackedAndUntrackedFiles() {
  return run(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { capture: true }
  )
    .split('\n')
    .filter(Boolean)
    .filter((file) => existsSync(join(ROOT, file)));
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}

function loadPublicIgnore() {
  const ignorePath = join(ROOT, '.publicignore');
  if (!existsSync(ignorePath)) return [];

  return readFileSync(ignorePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => ({
      negate: line.startsWith('!'),
      pattern: line.startsWith('!') ? line.slice(1) : line,
    }));
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith('/')) {
    return file.startsWith(pattern);
  }
  if (pattern.includes('*')) {
    return wildcardToRegExp(pattern).test(file);
  }
  return file === pattern || file.startsWith(`${pattern}/`);
}

function isPublicFile(file, rules) {
  let included = true;
  for (const rule of rules) {
    if (matchesPattern(file, rule.pattern)) {
      included = rule.negate;
    }
  }
  return included;
}

function assertNoSensitiveExport(files) {
  const failures = [];
  for (const file of files) {
    if (
      /^\.env(?:\.|$)/.test(file) &&
      file !== '.env.example' &&
      file !== '.env.release.example'
    ) {
      failures.push(`environment file would be exported: ${file}`);
    }
    if (file.startsWith('.git/') || file === '.git') {
      failures.push(`git metadata would be exported: ${file}`);
    }
    if (file.startsWith('.idea/') || file.endsWith('.iml')) {
      failures.push(`IDE file would be exported: ${file}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Public export blocked:\n- ${failures.join('\n- ')}`);
  }
}

function assertPublicReleaseMetadata(files) {
  const failures = [];
  const hasLicenseFile = files.some((file) =>
    /^licen[cs]e(?:\.|$)/i.test(file)
  );
  if (!hasLicenseFile) {
    failures.push(
      'missing public license file. Add LICENSE with the correct holder before publishing.'
    );
  }

  const packagePath = join(ROOT, 'package.json');
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    if (!pkg.name || pkg.name === 'bots') {
      failures.push(
        'package.json name is still generic; set the public package/repo name.'
      );
    }
    if (!pkg.description) {
      failures.push('package.json description is empty.');
    }
    if (!pkg.license || pkg.license === 'UNLICENSED') {
      failures.push('package.json license must match the public LICENSE file.');
    }
  }

  const placeholderPatterns = [
    /support@yourdomain\.com/i,
    /discord\.gg\/yourdiscord/i,
    /t\.me\/yourtelegram/i,
  ];
  for (const file of files) {
    if (!file.endsWith('.md') || !existsSync(join(ROOT, file))) continue;
    const source = readFileSync(join(ROOT, file), 'utf8');
    if (placeholderPatterns.some((pattern) => pattern.test(source))) {
      failures.push(
        `placeholder public support/contact link remains in ${file}`
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Public release metadata check failed:\n- ${failures.join('\n- ')}`
    );
  }
}

function assertReleaseAcknowledgements(args) {
  if (!args.secretsRotated) {
    throw new Error(
      'Public release blocked: pass --secrets-rotated only after rotating every secret that was ever committed.'
    );
  }
}

function copyFileOrDirectory(file, outDir) {
  const source = join(ROOT, file);
  const target = join(outDir, file);
  mkdirSync(dirname(target), { recursive: true });

  if (statSync(source).isDirectory()) {
    cpSync(source, target, { recursive: true });
  } else {
    copyFileSync(source, target);
  }
}

function patchPackageVersion(outDir, version) {
  if (!version) return;
  const packagePath = join(outDir, 'package.json');
  if (!existsSync(packagePath)) return;

  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  pkg.version = version;
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function initGit(outDir) {
  const result = spawnSync('git', ['init', '-b', 'main'], {
    cwd: outDir,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('git init failed in public export directory');
  }
}

function printNextCommands({ outDir, githubRepo, version }) {
  console.log('\nPublic release snapshot prepared.');
  console.log(`Export directory: ${outDir}`);
  console.log('\nManual snapshot commands:');
  console.log(`cd ${outDir}`);
  console.log('git add .');
  console.log(`git commit -m "Release ${version || '<version>'}"`);
  console.log(
    `git remote add origin https://github.com/${githubRepo || '0x730/dex-bot-services'}.git`
  );
  console.log('git push -u origin main');
  if (version) {
    console.log(`git tag v${version}`);
    console.log(`git push origin v${version}`);
  } else {
    console.log('git tag v<version>');
    console.log('git push origin v<version>');
  }
  console.log('\nRecommended publish command:');
  console.log('npm run release:public:publish');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const outDir = resolve(args.out);
  if (!args.dryRun && existsSync(outDir)) {
    if (!args.force) {
      throw new Error(
        `Output directory exists. Re-run with --force: ${outDir}`
      );
    }
    rmSync(outDir, { recursive: true, force: true });
  }

  if (!args.skipVerify) {
    run('npm', ['test']);
    run('npm', ['run', 'check:public']);
  }

  const rules = loadPublicIgnore();
  const files = trackedAndUntrackedFiles().filter((file) =>
    isPublicFile(file, rules)
  );
  assertPublicReleaseMetadata(files);
  assertNoSensitiveExport(files);

  if (args.dryRun) {
    console.log('Public release dry run passed.');
    return;
  }

  assertReleaseAcknowledgements(args);

  mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    copyFileOrDirectory(file, outDir);
  }

  patchPackageVersion(outDir, args.version);
  initGit(outDir);
  printNextCommands({
    outDir,
    githubRepo: args.githubRepo,
    version: args.version,
  });
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
