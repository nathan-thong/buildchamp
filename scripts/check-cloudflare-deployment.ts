import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = join(repositoryRoot, 'dist');
const snapshotDirectory = join(repositoryRoot, 'src', 'data', 'snapshots');

function fail(message: string): never {
  console.error(`Cloudflare deployment check failed: ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

function assertFile(path: string, description: string): void {
  if (!statSync(path, { throwIfNoEntry: false })) {
    fail(`missing ${description}: ${relative(repositoryRoot, path)}`);
  }
}

function assertContains(content: string, value: string, description: string): void {
  if (!content.includes(value)) {
    fail(`${description} is missing ${JSON.stringify(value)}`);
  }
}

assertFile(distDirectory, 'Vite output directory');
assertFile(join(distDirectory, 'index.html'), 'SPA entry document');
assertFile(join(distDirectory, '_headers'), 'Cloudflare response headers');
assertFile(join(distDirectory, '404.html'), 'custom static error document');

const wranglerConfig = readFileSync(join(repositoryRoot, 'wrangler.jsonc'), 'utf8');
assertContains(wranglerConfig, '"main": "./worker/index.ts"', 'Worker entrypoint configuration');
assertContains(wranglerConfig, '"directory": "./dist"', 'Wrangler assets configuration');
assertContains(wranglerConfig, '"binding": "ASSETS"', 'Workers Assets binding configuration');
assertContains(
  wranglerConfig,
  '"not_found_handling": "single-page-application"',
  'Wrangler SPA fallback configuration',
);
assertContains(wranglerConfig, '"run_worker_first": true', 'Worker-first routing configuration');
assertContains(wranglerConfig, '"preview"', 'Wrangler preview environment configuration');
assertContains(wranglerConfig, '"observability"', 'Workers observability configuration');

const headers = readFileSync(join(distDirectory, '_headers'), 'utf8');
assertContains(headers, 'X-Content-Type-Options: nosniff', 'security headers');
assertContains(headers, 'Content-Security-Policy:', 'security headers');
assertContains(
  headers,
  'Cache-Control: public, max-age=31536000, immutable',
  'immutable asset caching headers',
);

const indexHtml = readFileSync(join(distDirectory, 'index.html'), 'utf8');
if (indexHtml.includes('/src/main.tsx')) {
  fail('the source entrypoint was copied into the deployable HTML');
}

const distFiles = collectFiles(distDirectory);
const sourceOnlyFiles = distFiles.filter((path) => {
  const normalizedPath = relative(distDirectory, path).replaceAll('\\', '/');
  return (
    normalizedPath.startsWith('src/') ||
    normalizedPath.startsWith('scripts/') ||
    ['.ts', '.tsx', '.map'].includes(extname(normalizedPath))
  );
});

if (sourceOnlyFiles.length > 0) {
  fail(`source-only files would ship: ${sourceOnlyFiles.join(', ')}`);
}

const assetFiles = distFiles.filter((path) =>
  relative(distDirectory, path).replaceAll('\\', '/').startsWith('assets/'),
);
if (!assetFiles.some((path) => /-[A-Za-z0-9]{8,}\.(?:js|css)$/.test(path))) {
  fail('no fingerprinted Vite asset was found under dist/assets');
}

const javascriptBundles = assetFiles.filter((path) => extname(path) === '.js');
const bundleContents = javascriptBundles.map((path) => readFileSync(path, 'utf8')).join('\n');
const snapshotVersions = readdirSync(snapshotDirectory)
  .filter((fileName) => extname(fileName) === '.json')
  .map((fileName) => fileName.slice(0, -extname(fileName).length))
  .sort();

if (snapshotVersions.length === 0) {
  fail('no retained champion snapshots were found in the source tree');
}

for (const version of snapshotVersions) {
  if (!bundleContents.includes(version)) {
    fail(`retained champion snapshot ${version} was not found in the production bundles`);
  }
}

console.log(
  `Cloudflare deployment check passed: ${snapshotVersions.length} retained snapshots, ${assetFiles.length} fingerprinted assets, and no source-only files.`,
);
