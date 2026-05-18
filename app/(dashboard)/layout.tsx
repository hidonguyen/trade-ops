// Dashboard shell: sidebar (fixed left) + sticky header + scrollable content area
// Server component — fetches session and redirects unauthenticated users
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BuProvider } from "@/components/providers/bu-provider";
import { NavHighlightProvider } from "@/components/providers/nav-highlight-provider";
import { RolesProvider } from "@/components/providers/roles-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userRoles = session.user.roles ?? [];
  const userName: string = session.user.name ?? session.user.email ?? "Người dùng";

  return (
    <RolesProvider roles={userRoles}>
    <BuProvider>
      <NavHighlightProvider>
        <div className="min-h-screen flex">
          {/* Fixed sidebar — desktop only; mobile handled inside Sidebar via Sheet */}
          <Sidebar userRoles={userRoles} />

          {/* Main area: offset by sidebar width on desktop */}
          <div className="flex flex-col flex-1 lg:pl-60 min-w-0">
            <Header userName={userName} userRoles={userRoles} />

            <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </NavHighlightProvider>
    </BuProvider>
    </RolesProvider>
  );
}
