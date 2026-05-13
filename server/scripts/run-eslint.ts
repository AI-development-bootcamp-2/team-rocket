import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const rootDir = path.resolve(__dirname, '..');
const tempDir = path.join(rootDir, '.tmp-eslint');
const eslintConfigPath = path.join(tempDir, 'eslint.config.js');
const humanFsRoot = path.join(rootDir, 'node_modules', '@humanfs');

function collectJavaScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectJavaScriptFiles(fullPath);
    }

    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

function patchExtensionlessRelativeImports(source: string) {
  return source
    .replace(
      /((?:import|export)\s+(?:[^'"]+?\s+from\s+)?["'])(\.{1,2}\/[^"'?]+?)(["'])/g,
      (fullMatch, prefix, specifier, suffix) => {
        if (/\.[a-z0-9]+$/i.test(specifier)) {
          return fullMatch;
        }

        return `${prefix}${specifier}.js${suffix}`;
      },
    )
    .replace(
      /((?:import|export)\s*["'])(\.{1,2}\/[^"'?]+?)(["'])/g,
      (fullMatch, prefix, specifier, suffix) => {
        if (/\.[a-z0-9]+$/i.test(specifier)) {
          return fullMatch;
        }

        return `${prefix}${specifier}.js${suffix}`;
      },
    );
}

function runNodeScript(scriptPath: string, args: string[]) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync(tempDir, { recursive: true });

const patchedFiles = new Map<string, string>();

for (const filePath of collectJavaScriptFiles(humanFsRoot)) {
  const originalSource = readFileSync(filePath, 'utf8');
  const patchedSource = patchExtensionlessRelativeImports(originalSource);

  if (patchedSource !== originalSource) {
    patchedFiles.set(filePath, originalSource);
    writeFileSync(filePath, patchedSource, 'utf8');
  }
}

try {
  runNodeScript(path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'), [
    'eslint.config.ts',
    '--module',
    'commonjs',
    '--target',
    'ES2020',
    '--esModuleInterop',
    '--skipLibCheck',
    '--outDir',
    tempDir,
  ]);

  runNodeScript(path.join(rootDir, 'node_modules', 'eslint', 'bin', 'eslint.js'), [
    '--config',
    eslintConfigPath,
    'src/',
    'tests/',
    ...process.argv.slice(2),
  ]);
} finally {
  for (const [filePath, originalSource] of patchedFiles.entries()) {
    writeFileSync(filePath, originalSource, 'utf8');
  }

  rmSync(tempDir, { recursive: true, force: true });
}
