import Link from "next/link";

type TaskItemProps = {
  label: string;
  count: number;
  href: string;
};

export function TaskItem({ label, count, href }: TaskItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border p-3 transition hover:bg-accent"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-base font-bold">{count}</span>
    </Link>
  );
}
