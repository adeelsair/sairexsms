"use client";

import { useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format/currency";

type ActionCardProps = {
  actionKey: string;
  title: string;
  subtitle?: string;
  count?: number;
  amount?: number;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  deepLink: string;
  onCompleted?: (actionKey: string) => void;
  onCompleteFailed?: () => void;
};

const PRIORITY_STYLES: Record<ActionCardProps["priority"], string> = {
  URGENT: "border-destructive bg-destructive/10",
  HIGH: "border-warning bg-warning/15",
  MEDIUM: "border-info bg-info/15",
  LOW: "border-border bg-card",
};

export function ActionCard({
  actionKey,
  title,
  subtitle,
  count,
  amount,
  priority,
  deepLink,
  onCompleted,
  onCompleteFailed,
}: ActionCardProps) {
  const router = useRouter();
  const controls = useAnimation();
  const [isCompleting, setIsCompleting] = useState(false);

  async function handleComplete() {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);
    onCompleted?.(actionKey);

    const result = await api.post<{ ok: boolean }>("/api/mobile/action-complete", {
      actionKey,
    });

    if (result.ok) {
      toast.success("Action marked complete");
      return;
    }

    setIsCompleting(false);
    await controls.start({ x: 0 });
    onCompleteFailed?.();
    toast.error(result.error);
  }

  return (
    <motion.div
      drag="x"
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 120 }}
      onDragEnd={async (_, info) => {
        if (info.offset.x > 100) {
          await handleComplete();
          return;
        }
        await controls.start({ x: 0 });
      }}
      animate={controls}
      className="relative"
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={() => router.push(deepLink)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(deepLink);
          }
        }}
        className={cn(
          "mb-3 cursor-pointer rounded-2xl border-2 shadow-sm transition active:scale-[0.98]",
          PRIORITY_STYLES[priority],
          isCompleting ? "opacity-60" : "",
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold">{title}</h3>
              {subtitle ? (
                <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>

            {count || amount ? (
              <div className="shrink-0 text-right">
                {count ? (
                  <p className="text-lg font-bold">{count.toLocaleString("en-PK")}</p>
                ) : null}
                {amount ? (
                  <p className="text-sm font-medium">{formatCurrency(amount)}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
