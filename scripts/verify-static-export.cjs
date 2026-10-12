const fs = require('node:fs');
const path = require('node:path');

const publicDirectory = path.resolve(__dirname, '..', 'public');
const exportDirectory = path.resolve(__dirname, '..', 'out');
const missingOrDifferent = [];

function verifyDirectory(sourceDirectory, relativeDirectory = '') {
  const sourcePath = path.join(sourceDirectory, relativeDirectory);
  const exportPath = path.join(exportDirectory, relativeDirectory);

  if (!fs.existsSync(exportPath) || !fs.statSync(exportPath).isDirectory()) {
    missingOrDifferent.push(relativeDirectory || '.');
    return;
  }

  for (const entry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      verifyDirectory(publicDirectory, relativePath);
      continue;
    }

    const sourceFile = path.join(publicDirectory, relativePath);
    const exportFile = path.join(exportDirectory, relativePath);
    if (
      !fs.existsSync(exportFile)
      || !fs.statSync(exportFile).isFile()
      || !fs.readFileSync(sourceFile).equals(fs.readFileSync(exportFile))
    ) {
      missingOrDifferent.push(relativePath);
    }
  }
}

verifyDirectory(publicDirectory);

if (missingOrDifferent.length > 0) {
  throw new Error(
    `Static export is missing public assets or contains different copies:\n${missingOrDifferent.join('\n')}`
  );
}

console.log('Verified all public assets are present in the static export.');
