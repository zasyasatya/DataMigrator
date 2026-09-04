import Shell, { MobileNav } from "@/components/shell/Shell";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <MobileNav />
      {children}
    </Shell>
  );
}
