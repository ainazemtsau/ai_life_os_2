export default function AssistantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Assistants</h1>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        {children}
      </main>
    </div>
  );
}
