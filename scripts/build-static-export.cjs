const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectDirectory = path.resolve(__dirname, '..');
const apiDirectory = path.join(projectDirectory, 'app', 'api');
const stagedApiDirectory = path.join(
  path.dirname(projectDirectory),
  `.${path.basename(projectDirectory)}-api-${process.pid}`
);

if (!fs.existsSync(apiDirectory)) {
  throw new Error(`Expected Next.js API directory was not found: ${apiDirectory}`);
}

if (fs.existsSync(stagedApiDirectory)) {
  throw new Error(`Static build staging path already exists: ${stagedApiDirectory}`);
}

console.log('Temporarily staging Next.js API routes outside the static app.');
// Dynamic Next.js route handlers cannot be emitted by output: 'export'.
fs.renameSync(apiDirectory, stagedApiDirectory);

let buildStatus = 1;
try {
  const nextCli = path.join(projectDirectory, 'node_modules', 'next', 'dist', 'bin', 'next');
  const build = spawnSync(process.execPath, [nextCli, 'build'], {
    cwd: projectDirectory,
    env: process.env,
    stdio: 'inherit',
  });

  if (build.error) {
    throw build.error;
  }

  buildStatus = build.status ?? 1;
  if (buildStatus === 0) {
    require('./verify-static-export.cjs');
  }
} finally {
  fs.renameSync(stagedApiDirectory, apiDirectory);
}

process.exitCode = buildStatus;
