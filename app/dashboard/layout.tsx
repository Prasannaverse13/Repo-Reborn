import AppShell from "@/components/AppShell";

export const metadata = { title: "Dashboard · Repo Reborn" };

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
