import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { MapPin } from "lucide-react";
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
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Bell,
  LogOut,
  Users,
  ClipboardList,
  School,
} from "lucide-react";

interface AppSidebarProps {
  userRole?: string | null;
  userName?: string;
}

export function AppSidebar({ userRole, userName }: AppSidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();

  // Menu berdasarkan role
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
        { title: "Kelola Kehadiran", icon: Calendar, path: "/guru/manage-attendance" },
        { title: "Jadwal", icon: Bell, path: "/guru/schedule" },
      ];
    } else if (userRole === "admin") {
      return [
        { title: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
        { title: "Kelola User", icon: Users, path: "/admin/manage-users" },
        { title: "Kelola Jadwal & Mapel", icon: Calendar, path: "/admin/schedule" },
        { title: "PKL", icon: MapPin, path: "/admin/pkl" },
        { title: "Kelola Kehadiran", icon: School, path: "/admin/manage-attendance" },
        { title: "Laporan", icon: ClipboardList, path: "/admin/reports" },
      ];
    }
    return [];
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <School className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-bold text-lg">SMARTAS</h2>
            <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium">{userName || "User"}</p>
            <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}