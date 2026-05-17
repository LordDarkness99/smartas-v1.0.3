import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";
import {
  FileText,
  MapPin,
  LayoutDashboard,
  Calendar,
  Bell,
  LogOut,
  Users,
  School,
  UserCircle,
  KeyRound,
  Camera,
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  userRole?: string | null;
  userName?: string;
}

export function AppSidebar({ userRole, userName }: AppSidebarProps) {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getMenuItems = () => {
    if (userRole === "siswa") {
      return [
        { title: "Dashboard", icon: LayoutDashboard, path: "/student/dashboard" },
        { title: "Jadwal", icon: Calendar, path: "/student/schedule" },
        { title: "Presensi", icon: Calendar, path: "/student/attendance" },
        { title: "Registrasi Wajah", icon: Camera, path: "/face-registration" },
        // { title: "Notifikasi", icon: Bell, path: "/student/notifications" },
      ];
    } else if (userRole === "guru") {
      return [
        { title: "Dashboard", icon: LayoutDashboard, path: "/guru/dashboard" },
        { title: "Jadwal", icon: Calendar, path: "/guru/schedule" },
        { title: "Presensi", icon: Calendar, path: "/guru/attendance" },
        { title: "Registrasi Wajah", icon: Camera, path: "/face-registration" },
      ];
    } else if (userRole === "admin") {
      return [
        { title: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
        { title: "Kelola User", icon: Users, path: "/admin/manage-users" },
        { title: "Jadwal & Mapel", icon: Calendar, path: "/admin/schedule" },
        { title: "Program PKL", icon: MapPin, path: "/admin/pkl" },
        { title: "Presensi Sekolah", icon: School, path: "/admin/attendance" },
        { title: "Laporan Data", icon: FileText, path: "/admin/reports" },
        { title: "Registrasi Wajah", icon: Camera, path: "/face-registration" },
      ];
    }
    return [];
  };

  const menuItems = getMenuItems();

  const username = (user as { username?: string })?.username || "";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Sandi baru tidak cocok",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Sandi minimal 6 karakter",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Hash password baru dengan bcrypt (salt rounds = 10)
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password hash ke tabel akun
      const { error } = await supabase
        .from("akun")
        .update({ kata_sandi: hashedPassword })
        .eq("username", username);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Sandi telah diubah",
      });
      setIsChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: "Gagal",
        description: err.message || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsDialogOpen(false);
    await signOut();
  };

  return (
    <>
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
                        onClick={() => {
                          if (isMobile) setOpenMobile(false);
                        }}
                        className={`group mb-1 h-10 px-4 transition-all duration-300 rounded-xl ${
                          isActive
                            ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                            : "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                        }`}
                      >
                        <Link to={item.path} className="flex items-center gap-3">
                          <item.icon
                            className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${
                              isActive ? "text-white" : "text-slate-400 group-hover:text-blue-600"
                            }`}
                          />
                          <span className="font-bold text-sm tracking-tight group-data-[collapsible=icon]:hidden">
                            {item.title}
                          </span>
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
              <p className="truncate text-[9px] font-bold text-blue-900 uppercase tracking-tighter">{userRole} Akun</p>
              <p className="truncate text-sm font-black text-blue-950 leading-tight">{userName || "User"}</p>
            </div>
            {/* Ikon profile (bukan logout) untuk membuka dialog akun */}
            <button
              onClick={() => setIsDialogOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-all duration-200 group-data-[collapsible=icon]:hidden"
            >
              <UserCircle className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Akun Saya</DialogTitle>
            <DialogDescription>Informasi akun dan pengaturan sandi</DialogDescription>
          </DialogHeader>

          {!isChangingPassword ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Nama</p>
                <p className="text-base font-semibold">{userName || "User"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500">Role</p>
                <p className="text-base font-semibold capitalize">{userRole || "-"}</p>
              </div>
              {username && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Nama Pengguna</p>
                  <p className="text-base font-semibold">{username}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => setIsChangingPassword(true)}>
                  <KeyRound className="h-4 w-4" />
                  Ganti Sandi
                </Button>
                <Button variant="destructive" className="flex-1 gap-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Sandi Baru (min. 6 karakter)</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Sandi Baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsChangingPassword(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Menyimpan..." : "Simpan Sandi"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}