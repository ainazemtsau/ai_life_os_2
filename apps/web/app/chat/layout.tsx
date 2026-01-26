'use client';

import { ThreadList } from '@ai-life-os/ui';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <aside className="hidden w-64 flex-shrink-0 border-r border-border md:block">
        <ThreadList />
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
