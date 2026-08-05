import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(__dirname, '..', 'src');

function readAllSourceFiles(): Array<{ path: string; content: string }> {
  return readdirSync(SRC_DIR)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .map((name) => ({ path: name, content: readFileSync(join(SRC_DIR, name), 'utf8') }));
}

describe('single service worker guarantee', () => {
  it('has exactly one custom service worker source file (src/sw.ts)', () => {
    const files = readdirSync(SRC_DIR);
    const serviceWorkerFiles = files.filter((name) => /^sw\.tsx?$/.test(name));
    expect(serviceWorkerFiles).toEqual(['sw.ts']);
  });

  it('registers the VitePWA plugin exactly once, via injectManifest pointing at src/sw.ts', () => {
    const viteConfig = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf8');
    const vitePwaCalls = viteConfig.match(/VitePWA\(/g) ?? [];
    expect(vitePwaCalls).toHaveLength(1);
    expect(viteConfig).toContain("strategies: 'injectManifest'");
    expect(viteConfig).toContain("filename: 'sw.ts'");
  });

  it('is imported for registration (virtual:pwa-register) from exactly one file, UpdatePrompt.tsx', () => {
    const files = readAllSourceFiles();
    const importers = files.filter(({ content }) => /from ['"]virtual:pwa-register/.test(content));
    expect(importers.map(({ path }) => path)).toEqual(['UpdatePrompt.tsx']);
  });

  it('never calls navigator.serviceWorker.register directly (registration only ever goes through virtual:pwa-register)', () => {
    const files = readAllSourceFiles().filter(({ path }) => path !== 'sw.ts');
    const directRegistrations = files.filter(({ content }) => content.includes('serviceWorker.register('));
    expect(directRegistrations).toEqual([]);
  });
});
