import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createClient } from '../src/client';
import { getSupabaseConfig } from '../src/env';

describe('getSupabaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws Error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    expect(() => getSupabaseConfig()).toThrow('NEXT_PUBLIC_SUPABASE_URL is required');
  });

  it('throws Error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabaseConfig()).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  });

  it('returns config when both env vars are set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const config = getSupabaseConfig();
    expect(config.supabaseUrl).toBe('https://test.supabase.co');
    expect(config.supabaseAnonKey).toBe('test-key');
  });
});

describe('createClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('property: valid URLs create client without error', () => {
    fc.assert(fc.property(fc.webUrl(), fc.string({ minLength: 10 }), (url, key) => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
      expect(() => createClient()).not.toThrow();
    }));
  });
});
