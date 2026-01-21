import { describe, it, expect } from 'vitest';
import { execa } from 'execa';

describe('justfile recipes', () => {
  it('just feature exits 0 on success', async () => {
    const result = await execa('just', ['feature'], { cwd: process.cwd(), reject: false });
    expect(result.exitCode).toBe(0);
  }, 120000);

  it('just verify exits 0 on success', async () => {
    const result = await execa('just', ['verify'], { cwd: process.cwd(), reject: false });
    expect(result.exitCode).toBe(0);
  }, 120000);

  it('just type-check exits 0 on success', async () => {
    const result = await execa('just', ['type-check'], { cwd: process.cwd(), reject: false });
    expect(result.exitCode).toBe(0);
  }, 60000);

  it('just lint exits 0 on success', async () => {
    const result = await execa('just', ['lint'], { cwd: process.cwd(), reject: false });
    expect(result.exitCode).toBe(0);
  }, 60000);

  it('just test exits 0 on success', async () => {
    const result = await execa('just', ['test'], { cwd: process.cwd(), reject: false });
    expect(result.exitCode).toBe(0);
  }, 120000);

  it('just build exits 0 on success', async () => {
    const result = await execa('just', ['build'], { cwd: process.cwd(), reject: false });
    expect(result.exitCode).toBe(0);
  }, 120000);

  it('just clean exits 0 on success', async () => {
    const result = await execa('just', ['clean'], { cwd: process.cwd(), reject: false });
    expect(result.exitCode).toBe(0);
  }, 60000);
});
