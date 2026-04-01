import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  GraduationCap, 
  CalendarCheck, 
  Bell,
  Users,
  BookOpen,
  School,
  FileText,
  LogOut,
  ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const adminNav = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/students", label: "Data Siswa", icon: Users },
  { path: "/teachers", label: "Data Guru", icon: GraduationCap },
  { path: "/classes", label: "Kelas", icon: School },
  { path: "/subjects", label: "Mata Pelajaran", icon: BookOpen },
  { path: "/grades", label: "Nilai", icon: ClipboardList },
  { path: "/attendance", label: "Absensi", icon: CalendarCheck },
  { path: "/notifications", label: "Notifikasi", icon: Bell },
  { path: "/audit-logs", label: "Log Aktivitas", icon: FileText },
];

const teacherNav = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/students", label: "Siswa Saya", icon: Users },
  { path: "/grades", label: "Input Nilai", icon: ClipboardList },
  { path: "/attendance", label: "Input Absensi", icon: CalendarCheck },
  { path: "/notifications", label: "Notifikasi", icon: Bell },
];

const studentNav = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/my-grades", label: "Nilai Saya", icon: ClipboardList },
  { path: "/my-attendance", label: "Absensi Saya", icon: CalendarCheck },
  { path: "/notifications", label: "Notifikasi", icon: Bell },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();

  // Cuma ambil role saja, ringan dan cepat
  const { data: userRole } = useQuery({
    queryKey: ["user-role-sidebar", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      const rolePriority = ['admin', 'teacher', 'student'] as const;
      const roles = data?.map(r => r.role) || [];
      return rolePriority.find(r => roles.includes(r)) || 'student';
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // Cache 10 menit
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications-sidebar", user?.id],
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

  const navItems = userRole === "admin" 
    ? adminNav 
    : userRole === "teacher" 
    ? teacherNav 
    : studentNav;

  return (
    <aside className="w-64 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-[#0f172a] dark:to-[#0c1222] border-r border-slate-200/70 dark:border-slate-800/50 flex flex-col h-screen sticky top-0 z-20">
      
      {/* Header Logo */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 shadow-lg shadow-indigo-300/40 dark:shadow-indigo-900/20 transition-all duration-300 hover:scale-110 hover:rotate-3">
          <GraduationCap className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">SMARTAS</h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wide">Smart Attendance System</p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent dark:via-slate-700/50 mb-4" />

      {/* Menu Navigasi */}
      <nav className="flex-1 space-y-1 px-4 py-2 overflow-y-auto pr-1">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-4">MENU UTAMA</p>
        
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            className={({ isActive }) =>
              cn(
                "group relative flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) mb-1 overflow-hidden",
                isActive
                  ? "bg-white dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400 shadow-md shadow-indigo-100/50 dark:shadow-indigo-950/50 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-gradient-to-b before:from-indigo-500 before:to-blue-500"
                  : "text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:text-indigo-600 dark:hover:text-indigo-400"
              )
            }
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 transition-all duration-300 group-hover:scale-115 group-hover:-translate-x-0.5" />
              <span>{item.label}</span>
            </div>

            {/* Badge Notifikasi */}
            {item.path === "/notifications" && unreadCount > 0 && (
              <span className="bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center font-medium shadow-md shadow-red-200 dark:shadow-red-900/20 animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Tombol Logout Bersih */}
      <div className="p-4 mt-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent dark:via-slate-700/50 mb-4" />
        
        <button
          onClick={signOut}
          className="group flex w-full items-center justify-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400 transition-all duration-300 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <LogOut className="h-5 w-5 transition-all duration-300 group-hover:-translate-x-1" />
          Keluar
        </button>
      </div>
    </aside>
  );
}