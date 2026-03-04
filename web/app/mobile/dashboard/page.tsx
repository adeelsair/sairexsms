"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionCard } from "@/components/mobile/ActionCard";
import { EmptyState } from "@/components/mobile/EmptyState";
import { PerformanceStrip } from "@/components/mobile/PerformanceStrip";
import { useMobileActionRealtime } from "@/lib/hooks/useMobileActionRealtime";
import {
  useMobileTodayActions,
  type MobileTodayActionsResponse,
} from "@/lib/hooks/useMobileTodayActions";

export default function MobileDashboardPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  const { data, isLoading, isError, refetch } = useMobileTodayActions(orgId);
  const [actions, setActions] = useState<MobileTodayActionsResponse | null>(null);
  const [showAll, setShowAll] = useState(false);

  useMobileActionRealtime(orgId);

  useEffect(() => {
    if (data) {
      setActions(data);
    }
  }, [data]);

  function handleRemove(actionKey: string) {
    setActions((previous) => {
      if (!previous) return previous;

      const removedAction =
        previous.urgent.find((action) => action.actionKey === actionKey) ??
        previous.attention.find((action) => action.actionKey === actionKey) ??
        previous.info.find((action) => action.actionKey === actionKey) ??
        null;

      const nextCompletedToday = removedAction
        ? [
            {
              ...removedAction,
              id: `completed_${removedAction.id}_${Date.now()}`,
              priority: "LOW" as const,
            },
            ...previous.completedToday,
          ]
        : previous.completedToday;

      return {
        ...previous,
        urgent: previous.urgent.filter((action) => action.actionKey !== actionKey),
        attention: previous.attention.filter(
          (action) => action.actionKey !== actionKey,
        ),
        info: previous.info.filter((action) => action.actionKey !== actionKey),
        completedToday: nextCompletedToday,
        meta: {
          ...previous.meta,
          completedToday: previous.meta.completedToday + (removedAction ? 1 : 0),
        },
      };
    });
  }

  function getTopAction(input: MobileTodayActionsResponse) {
    if (input.urgent.length > 0) return input.urgent[0];
    if (input.attention.length > 0) return input.attention[0];
    if (input.info.length > 0) return input.info[0];
    return null;
  }

  if (isLoading && !actions) {
    return <div className="min-h-screen bg-background p-4 text-sm text-muted">Loading actions...</div>;
  }

  if (isError || !actions) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card className="rounded-xl border border-border bg-surface">
          <CardContent className="p-4 text-sm">Failed to load dashboard.</CardContent>
        </Card>
      </div>
    );
  }

  const totalCount =
    actions.urgent.length + actions.attention.length + actions.info.length;
  const noActions = totalCount === 0;
  const isFocusMode = actions.urgent.length >= 3 || totalCount >= 7;
  const topAction = getTopAction(actions);

  return (
    <div className="min-h-screen space-y-4 bg-background p-4 pb-20">
      <header className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">Today&apos;s Work Queue</p>
        <h1 className="text-xl font-bold">Action Dashboard</h1>
      </header>

      <PerformanceStrip
        completed={actions.meta.completedToday}
        total={actions.meta.totalGeneratedToday}
        name={actions.meta.userName}
      />

      {noActions ? (
        <EmptyState completed={actions.meta.completedToday} />
      ) : (
        <>
          <section>
            {isFocusMode ? (
              <>
                <h2 className="mb-2 text-lg font-bold">Focus Now</h2>
                {topAction ? (
                  <ActionCard
                    key={topAction.id}
                    {...topAction}
                    onCompleted={handleRemove}
                    onCompleteFailed={() => {
                      void refetch();
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted">No actions right now.</p>
                )}

                {!showAll ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-1 h-auto p-0 text-sm text-muted-foreground"
                    onClick={() => setShowAll(true)}
                  >
                    View all actions
                  </Button>
                ) : (
                  <div className="space-y-6">
                    <section>
                      <h3 className="mb-2 text-base font-semibold">Urgent</h3>
                      {actions.urgent.slice(1).map((action) => (
                        <ActionCard
                          key={action.id}
                          {...action}
                          onCompleted={handleRemove}
                          onCompleteFailed={() => {
                            void refetch();
                          }}
                        />
                      ))}
                    </section>

                    <section>
                      <h3 className="mb-2 text-base font-semibold">Attention Needed</h3>
                      {actions.attention.map((action) => (
                        <ActionCard
                          key={action.id}
                          {...action}
                          onCompleted={handleRemove}
                          onCompleteFailed={() => {
                            void refetch();
                          }}
                        />
                      ))}
                    </section>

                    <section>
                      <h3 className="mb-2 text-base font-semibold">Informational</h3>
                      {actions.info.map((action) => (
                        <ActionCard
                          key={action.id}
                          {...action}
                          onCompleted={handleRemove}
                          onCompleteFailed={() => {
                            void refetch();
                          }}
                        />
                      ))}
                    </section>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="mb-2 text-lg font-bold">Urgent</h2>
                {actions.urgent.length ? (
                  actions.urgent.map((action) => (
                    <ActionCard
                      key={action.id}
                      {...action}
                      onCompleted={handleRemove}
                      onCompleteFailed={() => {
                        void refetch();
                      }}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted">No urgent actions right now.</p>
                )}
              </>
            )}
          </section>

          {!isFocusMode ? (
            <>
              <section>
                <h2 className="mb-2 text-lg font-bold">Attention Needed</h2>
                {actions.attention.length ? (
                  actions.attention.map((action) => (
                    <ActionCard
                      key={action.id}
                      {...action}
                      onCompleted={handleRemove}
                      onCompleteFailed={() => {
                        void refetch();
                      }}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted">Nothing pending in this bucket.</p>
                )}
              </section>

              <section>
                <h2 className="mb-2 text-lg font-bold">Informational</h2>
                {actions.info.length ? (
                  actions.info.map((action) => (
                    <ActionCard
                      key={action.id}
                      {...action}
                      onCompleted={handleRemove}
                      onCompleteFailed={() => {
                        void refetch();
                      }}
                    />
                  ))
                ) : (
                  <p className="text-sm text-muted">No informational actions.</p>
                )}
              </section>
            </>
          ) : null}
        </>
      )}

      {actions.urgent.length >= 3 ? (
        <Button
          type="button"
          className="fixed bottom-24 right-4 z-40 h-12 w-12 rounded-full bg-destructive p-0 text-destructive-foreground shadow-lg animate-pulse"
          onClick={() => {
            setShowAll(true);
          }}
        >
          !
        </Button>
      ) : null}

      <Card className="rounded-xl border border-border bg-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Completed Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {actions.completedToday.length ? (
            actions.completedToday.map((action) => (
              <div key={action.id} className="flex items-center justify-between text-sm">
                <span className="text-muted">{action.title}</span>
                <span className="font-semibold">
                  {action.count ? action.count.toLocaleString("en-PK") : "Done"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Complete an action to build momentum.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
