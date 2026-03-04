import { cn } from "@/lib/utils";
import { SIDEBAR_GRADIENT } from "@/lib/theme/chrome-theme";

export function SystemSidebar(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn("text-white", props.className)}
      style={{
        background: SIDEBAR_GRADIENT,
      }}
    >
      {props.children}
    </aside>
  );
}

