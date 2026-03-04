import Link from "next/link";

type QuickActionButtonProps = {
  label: string;
  href: string;
};

export function QuickActionButton({ label, href }: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-primary p-3 text-center text-sm font-medium text-white transition hover:opacity-90"
    >
      {label}
    </Link>
  );
}
