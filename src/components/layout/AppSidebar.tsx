import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  Bell,
  FileText,
  LogOut,
  School,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/teachers", label: "Teachers", icon: GraduationCap },
  { to: "/classes", label: "Classes", icon: School },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/grades", label: "Grades", icon: ClipboardList },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/audit-logs", label: "Audit Logs", icon: FileText },
];

const teacherNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/grades", label: "Grades", icon: ClipboardList },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

const studentNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/grades", label: "My Grades", icon: ClipboardList },
  { to: "/attendance", label: "My Attendance", icon: CalendarCheck },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export function AppSidebar() {
  const { role, profile, signOut } = useAuth();

  const navItems = role === "admin" ? adminNav : role === "teacher" ? teacherNav : studentNav;

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">School SMS</h1>
          <p className="text-xs text-sidebar-muted capitalize">{role || "user"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium truncate">{profile?.full_name || "User"}</p>
          <p className="text-xs text-sidebar-muted truncate">{profile?.email}</p>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
