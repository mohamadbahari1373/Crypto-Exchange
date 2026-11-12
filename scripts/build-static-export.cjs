const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectDirectory = path.resolve(__dirname, '..');
const buildDirectory = path.join(
  path.dirname(projectDirectory),
  `.${path.basename(projectDirectory)}-static-build-${process.pid}`
);
const exportedDirectory = path.join(buildDirectory, 'out');
const outputDirectory = path.join(projectDirectory, 'out');

if (fs.existsSync(buildDirectory)) {
  throw new Error(`Static build staging path already exists: ${buildDirectory}`);
}

console.log('Preparing an isolated static build without Next.js API routes.');
let buildStatus = 1;
try {
  fs.cpSync(projectDirectory, buildDirectory, {
    recursive: true,
    filter(source) {
      const relativePath = path.relative(projectDirectory, source);
      if (!relativePath) return true;
      const segments = relativePath.split(path.sep);
      if (['node_modules', '.next', 'out', '.git'].includes(segments[0])) return false;
      return !(segments[0] === 'app' && segments[1] === 'api');
    },
  });
  fs.symlinkSync(path.join(projectDirectory, 'node_modules'), path.join(buildDirectory, 'node_modules'), 'junction');

  const nextCli = path.join(projectDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');
  const build = spawnSync(process.execPath, [nextCli, 'build'], {
    cwd: buildDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  if (build.error) throw build.error;
  buildStatus = build.status ?? 1;

  if (buildStatus === 0) {
    if (!fs.existsSync(exportedDirectory)) {
      throw new Error(`Next.js did not generate the expected static export: ${exportedDirectory}`);
    }
    fs.rmSync(outputDirectory, { recursive: true, force: true });
    fs.cpSync(exportedDirectory, outputDirectory, { recursive: true, force: true });
    require('./verify-static-export.cjs');
  }
} finally {
  fs.rmSync(buildDirectory, { recursive: true, force: true });
}

process.exitCode = buildStatus;
