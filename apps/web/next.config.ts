import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@ai-life-os/supabase', '@ai-life-os/ai', '@ai-life-os/ui'],
};

export default config;
