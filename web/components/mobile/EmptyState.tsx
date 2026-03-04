"use client";

type EmptyStateProps = {
  completed: number;
};

export function EmptyState({ completed }: EmptyStateProps) {
  return (
    <div className="mt-12 px-6 text-center">
      <div className="mb-4 text-5xl">🎉</div>

      <h2 className="text-xl font-bold">All Clear!</h2>

      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;ve completed {completed} actions today.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-success/15 p-4">
        <p className="text-sm text-success">
          Your school operations are running smoothly.
        </p>
      </div>
    </div>
  );
}
