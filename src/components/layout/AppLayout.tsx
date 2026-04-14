import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Menu } from "lucide-react"; // Ikon garis 3 horizontal

export function AppLayout() {
  const { user } = useAuth();

  // Fungsi penyingkat nama (Muhammad Rojak -> MR)
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
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
        
        {/* Sidebar SMARTAS */}
        <AppSidebar userRole={user?.peran} userName={user?.nama} />
        
        <main className="flex-1 flex flex-col min-w-0">
          {/* --- HEADER MOBILE --- */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-4 lg:hidden shadow-sm">
            {/* Sisi Kiri: Branding */}
            <div className="flex items-center gap-2">
              <img src="/smartas-logo.png" alt="Logo" className="h-8 w-auto" />
              <span className="font-black italic text-blue-600 tracking-tighter text-lg uppercase">
                SMARTAS
              </span>
            </div>

            {/* Sisi Kanan: Kotak Inisial + Hamburg Garis 3 */}
            <div className="flex items-center gap-2">
              {/* Kotak Inisial Nama (ED / MR) */}
              <div className="flex h-9 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-black text-sm italic shadow-lg shadow-blue-200 uppercase tracking-tighter">
                {userInitials}
              </div>

              {/* Tombol Hamburg Garis 3 Horizontal (Mengganti foto 1 ke foto 2) */}
              <SidebarTrigger>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600 transition-all active:scale-90">
                  <Menu className="h-7 w-7" /> {/* Ini ikon garis 3 bang */}
                </div>
              </SidebarTrigger>
            </div>
          </header>

          {/* Isi Konten Dashboard */}
          <div className="flex-1 overflow-auto p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}