import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Bell, Loader2, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ✅ Ambil data profile dan role user untuk header
  const { data: userData, isLoading: profileLoading } = useQuery({
    queryKey: ["header-profile", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .single();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      const rolePriority = ['admin', 'teacher', 'student'] as const;
      const userRoles = roles?.map(r => r.role) || [];
      const role = rolePriority.find(r => userRoles.includes(r)) || 'student';
      
      const roleLabel = {
        admin: "Administrator",
        teacher: "Guru",
        student: "Siswa"
      }[role];

      return { profile, role, roleLabel }
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        
        {/* ✅ Header yang sekarang ada nama user */}
        <header className="flex h-14 items-center justify-between border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-6">
          
          {/* Kosong di kiri */}
          <div />

          {/* Kanan: Profile + Notifikasi */}
          <div className="flex items-center gap-3">

            {/* Profile User */}
            {profileLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {userData?.profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">
                    {userData?.profile?.full_name || user?.email}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {userData?.roleLabel}
                  </p>
                </div>
              </div>
            )}

            {/* Divider kecil */}
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />

            {/* Tombol Notifikasi */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigate("/notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-[10px] font-bold text-white shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </div>

        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}