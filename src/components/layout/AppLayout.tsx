import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Menu } from "lucide-react";

export function AppLayout() {
  const { user } = useAuth();

  const getInitials = (name: string) => {
    const words = name?.trim().split(/\s+/) || [];
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return words[0]?.substring(0, 2).toUpperCase() || "AD";
  };

  const userInitials = user?.nama ? getInitials(user.nama) : "AD";

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
        
        <AppSidebar userRole={user?.peran} userName={user?.nama} />
        
        <main className="flex-1 flex flex-col min-w-0">
          {/* HEADER MOBILE - putih bersih */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-indigo-100 bg-white px-4 lg:hidden shadow-sm">
            <div className="flex items-center gap-2">
              <img src="/smartas-logo.png" alt="Logo" className="h-8 w-auto" />
              <span className="font-black italic bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent tracking-tighter text-lg uppercase">
                SMARTAS
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-sm italic shadow-md shadow-indigo-200 uppercase tracking-tighter">
                {userInitials}
              </div>

              <SidebarTrigger>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-indigo-50 text-indigo-700 transition-all active:scale-90">
                  <Menu className="h-7 w-7" />
                </div>
              </SidebarTrigger>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}