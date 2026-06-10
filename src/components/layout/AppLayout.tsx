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
        
        {/* Sidebar hanya di layar, sembunyi saat cetak */}
        <div className="print:hidden">
          <AppSidebar userRole={user?.peran} userName={user?.nama} />
        </div>
        
        <main className="flex-1 flex flex-col min-w-0">
          {/* HEADER MOBILE - sembunyi saat cetak */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-indigo-100 bg-white px-4 lg:hidden shadow-sm print:hidden">
            <div className="flex items-center gap-2">
              <img src="/New.png" alt="Logo" className="h-8 w-auto" />
              <span className="text-xl font-black italic tracking-tighter bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] bg-clip-text text-transparent uppercase leading-[0.8]">
                TITEN
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Avatar dengan warna palette yang diminta */}
              <div className="flex h-9 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#2C5EAD] to-[#1591DC] text-white font-black text-sm italic shadow-md shadow-[#2C5EAD]/20 uppercase tracking-tighter">
                {userInitials}
              </div>

              {/* Tombol hamburger - sembunyi saat cetak */}
              <div className="print:hidden">
                <SidebarTrigger>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#C4E2F5] text-[#2C5EAD] transition-all active:scale-90">
                    <Menu className="h-7 w-7" />
                  </div>
                </SidebarTrigger>
              </div>
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