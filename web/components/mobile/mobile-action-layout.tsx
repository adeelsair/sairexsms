import { ReactNode } from "react";

type MobileActionLayoutProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function MobileActionLayout({
  title,
  children,
  footer,
}: MobileActionLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 text-base font-semibold">
        {title}
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4">{children}</main>

      {footer ? (
        <footer className="border-t border-border bg-background p-3">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
