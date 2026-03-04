import type { DailyOperationsSnapshot } from "@/lib/dashboard/daily-operations.service";
import { TaskItem } from "./TaskItem";

interface TaskPanelProps {
  tasks: DailyOperationsSnapshot["tasks"];
}

export function TaskPanel({ tasks }: TaskPanelProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-muted">
        Task Pipeline
      </h2>

      {tasks.length === 0 && (
        <div className="text-sm text-muted">
          All caught up {"\uD83C\uDF89"}
        </div>
      )}

      {tasks.map((task) => (
        <TaskItem
          key={task.type}
          label={task.label}
          count={task.count}
          href={task.href}
        />
      ))}
    </div>
  );
}
