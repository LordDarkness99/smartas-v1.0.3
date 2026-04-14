import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText,
  MapPin,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Bell,
  LogOut,
  Users,
  ClipboardList,
  School,
  UserCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar, // Import ini penting
} from "@/components/ui/sidebar";











interface AppSidebarProps {
  userRole?: string | null;
  userName?: string;
}

export function AppSidebar({ userRole, userName }: AppSidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar(); // Ambil setOpenMobile


  const getMenuItems = () => {
    if (userRole === "siswa") {
      return [
        { title: "Dashboard", icon: LayoutDashboard, path: "/student/dashboard" },
        { title: "Jadwal Mapel", icon: BookOpen, path: "/student/my-grades" },
        { title: "Presensi", icon: Calendar, path: "/student/my-attendance" },
        { title: "Notifikasi", icon: Bell, path: "/student/notifications" },
      ];
    } else if (userRole === "guru") {
      return [
        { title: "Dashboard", icon: LayoutDashboard, path: "/guru/dashboard" },
        { title: "Kelola Nilai", icon: ClipboardList, path: "/guru/manage-grades" },
        { title: "Presensi", icon: Calendar, path: "/guru/attendance" },
        { title: "Jadwal", icon: Bell, path: "/guru/schedule" },
      ];
    } else if (userRole === "admin") {
      return [
        { title: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
        { title: "Kelola User", icon: Users, path: "/admin/manage-users" },
        { title: "Jadwal & Mapel", icon: Calendar, path: "/admin/schedule" },
        { title: "Program PKL", icon: MapPin, path: "/admin/pkl" },
        { title: "Presensi Sekolah", icon: School, path: "/admin/attendance" },
        { title: "Laporan Data", icon: FileText, path: "/admin/reports" },
      ];
    }
    return [];
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar 
      collapsible="icon" 
      side={isMobile ? "right" : "left"}
      className={`bg-white shadow-xl ${isMobile ? "border-l" : "border-r"} border-blue-50`}
    >
      <SidebarHeader className="py-5 px-6 flex flex-col items-center justify-center">
        <div className="mb-0.5 flex items-center justify-center h-14 w-full text-center">
          <img src="/smartas-logo.png" alt="SMARTAS Logo" className="h-12 w-auto object-contain" />
        </div>
        <div className="text-center group-data-[collapsible=icon]:hidden">
          <h2 className="text-xl font-black italic tracking-tighter text-blue-600 uppercase leading-[0.8]">
            SMARTAS
          </h2>
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1.5">
            {userRole || "Access"} Mode
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-0">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center group-data-[collapsible=icon]:hidden">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      // Logika otomatis nutup sidebar pas klik menu di HP
                      onClick={() => { if (isMobile) setOpenMobile(false); }}
                      className={`group mb-1 h-10 px-4 transition-all duration-300 rounded-xl ${
                        isActive ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                      }`}
                    >
                      <Link to={item.path} className="flex items-center gap-3">
                        <item.icon className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"}`} />
                        <span className="font-bold text-sm tracking-tight group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-blue-50 bg-blue-50/30">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm border border-blue-100 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-inner">
            <UserCircle className="h-5.5 w-5.5" />
          </div>
          <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-black text-blue-950 leading-tight">{userName || "User"}</p>
            <p className="truncate text-[9px] font-bold text-blue-900 uppercase tracking-tighter">{userRole} Account</p>
          </div>
          <button onClick={signOut} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-all duration-200 group-data-[collapsible=icon]:hidden">




            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}