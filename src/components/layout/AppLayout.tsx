import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

export function AppLayout() {
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar userRole={user?.peran} userName={user?.nama} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}