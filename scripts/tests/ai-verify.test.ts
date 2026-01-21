import { describe, it, expect, afterEach } from 'vitest';
import { execa } from 'execa';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ai:verify script', () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tmpDirs.map(dir => rm(dir, { recursive: true, force: true }))
    );
    tmpDirs.length = 0;
  });

  it('exits 0 when all checks pass', async () => {
    const result = await execa('pnpm', ['ai:verify'], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.exitCode).toBe(0);
  }, 60000);

  it('exits non-zero when type-check fails', async () => {
    const tmpDir = join(tmpdir(), `ai-verify-test-${Date.now()}`);
    tmpDirs.push(tmpDir);
    await mkdir(tmpDir, { recursive: true });

    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-pkg',
        scripts: {
          'ai:verify': 'pnpm type-check',
          'type-check': 'tsc --noEmit'
        }
      })
    );

    await writeFile(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: true
        }
      })
    );

    await writeFile(
      join(tmpDir, 'test.ts'),
      'const x: string = 123;'
    );

    const result = await execa('pnpm', ['ai:verify'], {
      cwd: tmpDir,
      reject: false
    });

    expect(result.exitCode).not.toBe(0);
  });

  it('exits non-zero when lint fails', async () => {
    const tmpDir = join(tmpdir(), `ai-verify-test-lint-${Date.now()}`);
    tmpDirs.push(tmpDir);
    await mkdir(tmpDir, { recursive: true });

    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-pkg',
        scripts: {
          'ai:verify': 'pnpm lint',
          'lint': 'eslint .'
        }
      })
    );

    await writeFile(
      join(tmpDir, '.eslintrc.json'),
      JSON.stringify({
        rules: {
          'no-unused-vars': 'error'
        },
        parserOptions: { ecmaVersion: 2022 }
      })
    );

    await writeFile(
      join(tmpDir, 'test.js'),
      'var unused = 1;'
    );

    const result = await execa('pnpm', ['ai:verify'], {
      cwd: tmpDir,
      reject: false
    });

    expect(result.exitCode).not.toBe(0);
  });

  it('exits non-zero when test fails', async () => {
    const tmpDir = join(tmpdir(), `ai-verify-test-fail-${Date.now()}`);
    tmpDirs.push(tmpDir);
    await mkdir(tmpDir, { recursive: true });

    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-pkg',
        scripts: {
          'ai:verify': 'pnpm test',
          'test': 'vitest run'
        }
      })
    );

    await writeFile(
      join(tmpDir, 'test.test.js'),
      `import { test, expect } from 'vitest';
test('failing test', () => {
  expect(1).toBe(2);
});`
    );

    const result = await execa('pnpm', ['ai:verify'], {
      cwd: tmpDir,
      reject: false
    });

    expect(result.exitCode).not.toBe(0);
  });

  it('runs all packages in parallel via turbo', async () => {
    const result = await execa('turbo', ['run', 'ai:verify', '--dry=json'], {
      cwd: process.cwd(),
      reject: false
    });

    const output = JSON.parse(result.stdout);
    expect(output.tasks.length).toBeGreaterThan(1);
    expect(output.tasks.some((t: any) => t.dependsOn?.includes('ai:verify'))).toBe(true);
  });
});
