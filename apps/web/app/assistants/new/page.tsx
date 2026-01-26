'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const PHASE1_USER_ID = '00000000-0000-0000-0000-000000000001';

export default function NewAssistantPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [temperature, setTemperature] = React.useState(0.7);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      userId: PHASE1_USER_ID,
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      systemPrompt: formData.get('systemPrompt') as string || undefined,
      model: formData.get('model') as string,
      temperature: parseFloat(formData.get('temperature') as string),
      maxTokens: formData.get('maxTokens')
        ? parseInt(formData.get('maxTokens') as string, 10)
        : undefined,
      status: formData.get('status') as 'active' | 'inactive',
      provider: 'openai' as const,
    };

    try {
      const response = await fetch('/api/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create assistant');
      }

      router.push('/assistants');
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Create Assistant</h2>

      {error && (
        <div className="rounded bg-red-900/50 p-3 text-red-200">{error}</div>
      )}

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Name *</label>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">Description</label>
        <input
          name="description"
          className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-muted-foreground">System Prompt</label>
        <textarea
          name="systemPrompt"
          rows={4}
          className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Model</label>
          <select
            name="model"
            defaultValue="gpt-5-mini"
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
          >
            <option value="gpt-5-mini">gpt-5-mini</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">
            Temperature ({temperature})
          </label>
          <input
            name="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Max Tokens</label>
          <input
            name="maxTokens"
            type="number"
            min="1"
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Status</label>
          <select
            name="status"
            defaultValue="active"
            className="w-full rounded-lg border border-border bg-card px-4 py-2 text-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-secondary px-6 py-2 text-white hover:bg-accent text-secondary-foreground disabled:opacity-50"
      >
        {isSubmitting ? 'Creating...' : 'Create Assistant'}
      </button>
    </form>
  );
}
