const { spawnSync } = require('child_process');
const { readFileSync } = require('fs');

function gitLsFiles() {
  const result = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' }
  );
  if (result.error && !result.stdout) {
    throw result.error;
  }
  if (result.status !== 0 && !result.stdout) {
    throw new Error(result.stderr || 'git ls-files failed');
  }
  return result.stdout.split('\n').filter(Boolean);
}

const trackedFiles = gitLsFiles();
const failures = [];

for (const file of trackedFiles) {
  if (
    /^\.env(?:\.|$)/.test(file) &&
    file !== '.env.example' &&
    file !== '.env.release.example'
  ) {
    failures.push(`tracked environment file: ${file}`);
  }

  if (file.startsWith('.idea/') || file.endsWith('.iml')) {
    failures.push(`tracked IDE file: ${file}`);
  }

  if (file.startsWith('src/') && file.endsWith('.js')) {
    const source = readFileSync(file, 'utf8');
    if (/app\.listen\(\s*PORT\s*,\s*\(/.test(source)) {
      failures.push(`service binds without explicit host: ${file}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Public repository check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Public repository check passed.');
