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
      toast({ title: "Error", description: "Sandi baru tidak cocok", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Sandi minimal 6 karakter", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const { error } = await supabase.from("akun").update({ kata_sandi: hashedPassword }).eq("username", username);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Sandi telah diubah" });
      setIsChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      toast({ title: "Gagal", description: (error as Error).message || "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsDialogOpen(false);
    await signOut();
  };

  const isMenuItemActive = (itemPath: string) => {
    if (itemPath === "/face-registration") {
      return location.pathname.includes("face-registration");
    }
    return location.pathname === itemPath || location.pathname === itemPath + "/";
  };

  const button3D = `
    transition-all duration-100 ease-out
    active:translate-y-[2px] active:shadow-[0_2px_0_rgba(0,0,0,0.2)]
    hover:-translate-y-[2px] hover:shadow-[0_6px_0_rgba(0,0,0,0.2)]
  `;

  // Texture halus: dot grid dengan warna biru sangat transparan (opacity 0.02)
  const subtleTexture = "bg-[radial-gradient(ellipse_at_center,_rgba(44,94,173,0.02)_1px,_transparent_1px)] bg-[length:24px_24px]";

  return (
    <>
      <Sidebar
        collapsible="icon"
        side={isMobile ? "right" : "left"}
        className={`bg-white ${subtleTexture} border-r border-[#C4E2F5]/30 shadow-[-8px_0_20px_-8px_rgba(44,94,173,0.15)] z-10 transition-all duration-300`}
      >
        {/* HEADER */}
        <SidebarHeader className={`py-5 px-6 flex flex-col items-center justify-center bg-white ${subtleTexture} relative after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[#1591DC]/20 after:to-transparent`}>
          <div className="mb-0.5 flex items-center justify-center h-14 w-full text-center">
            <img src="/smartas-logo.png" alt="SMARTAS Logo" className="h-12 w-auto object-contain drop-shadow-md" />
          </div>
          <div className="text-center group-data-[collapsible=icon]:hidden">
            <h2 className="text-xl font-black italic tracking-tighter bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] bg-clip-text text-transparent uppercase leading-[0.8]">
              SMARTAS
            </h2>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#4BB8FA] mt-1.5">
              {userRole || "Access"} Mode
            </p>
          </div>
        </SidebarHeader>

        {/* CONTENT */}
        <SidebarContent className={`px-4 py-2 bg-white ${subtleTexture}`}>
          <SidebarGroup>
            <SidebarGroupLabel className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-[#2C5EAD]/60 text-center group-data-[collapsible=icon]:hidden">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  const isActive = isMenuItemActive(item.path);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        onClick={() => { if (isMobile) setOpenMobile(false); }}
                        className={`group relative mb-2 h-10 px-4 rounded-xl overflow-hidden
                          ${button3D}
                          ${isActive
                            ? "bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] text-white shadow-[0_4px_0_rgba(0,0,0,0.25)] hover:shadow-[0_6px_0_rgba(0,0,0,0.25)] active:shadow-[0_2px_0_rgba(0,0,0,0.25)]"
                            : "bg-white border border-[#C4E2F5] text-[#2C5EAD] shadow-[0_4px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_0_rgba(0,0,0,0.1)] active:shadow-[0_2px_0_rgba(0,0,0,0.1)]"
                          }`}
                      >
                        <Link to={item.path} className="flex items-center gap-3 w-full">
                          <item.icon
                            className={`h-4.5 w-4.5 transition-all duration-300 group-hover:scale-110
                              ${isActive ? "text-white drop-shadow-sm" : "text-[#1591DC] group-hover:text-[#2C5EAD]"}`}
                          />
                          <span className="font-bold text-sm tracking-tight group-data-[collapsible=icon]:hidden">
                            {item.title}
                          </span>
                          {isActive && (
                            <span className="absolute right-2 h-1.5 w-1.5 rounded-full bg-white shadow-md animate-pulse group-data-[collapsible=icon]:right-0.5" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* FOOTER */}
        <SidebarFooter className={`p-4 border-t border-[#C4E2F5]/30 bg-white ${subtleTexture}`}>
          <div className="relative flex items-center gap-3 rounded-2xl p-2.5 bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-lg overflow-hidden group">
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm ring-2 ring-white/40">
              <UserCircle className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white shadow-md animate-pulse" />
            </div>
            <div className="relative flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[9px] font-bold text-white/80 uppercase tracking-tighter">
                {userRole} Akun
              </p>
              <p className="truncate text-sm font-black text-white leading-tight">
                {userName || "User"}
              </p>
            </div>
            <button
              onClick={() => setIsDialogOpen(true)}
              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg 
                bg-gradient-to-br from-red-500 via-red-600 to-red-800 
                text-white shadow-[0_4px_0_rgba(0,0,0,0.4)] hover:shadow-[0_6px_0_rgba(0,0,0,0.4)] active:shadow-[0_2px_0_rgba(0,0,0,0.4)]
                ${button3D} group-data-[collapsible=icon]:hidden`}
            >
              <KeyRound className="h-4 w-4 drop-shadow-sm" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* Dialog - tetap tanpa texture */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-[#C4E2F5] shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-[#2C5EAD] flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-[#1591DC]" />
              Akun Saya
            </DialogTitle>
            <DialogDescription className="text-[#1591DC]">
              Informasi akun dan pengaturan sandi
            </DialogDescription>
          </DialogHeader>

          {!isChangingPassword ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1 p-3 rounded-xl bg-[#C4E2F5]/10 border border-[#C4E2F5]/30">
                <p className="text-sm font-medium text-[#2C5EAD]">Nama</p>
                <p className="text-base font-semibold text-[#2C5EAD]">
                  {userName || "User"}
                </p>
              </div>
              <div className="space-y-1 p-3 rounded-xl bg-[#C4E2F5]/10 border border-[#C4E2F5]/30">
                <p className="text-sm font-medium text-[#2C5EAD]">Role</p>
                <p className="text-base font-semibold text-[#2C5EAD] capitalize">
                  {userRole || "-"}
                </p>
              </div>
              {username && (
                <div className="space-y-1 p-3 rounded-xl bg-[#C4E2F5]/10 border border-[#C4E2F5]/30">
                  <p className="text-sm font-medium text-[#2C5EAD]">Nama Pengguna</p>
                  <p className="text-base font-semibold text-[#2C5EAD]">{username}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className={`flex-1 gap-2 border-[#C4E2F5] text-[#2C5EAD] 
                    bg-white shadow-[0_4px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_0_rgba(0,0,0,0.1)] active:shadow-[0_2px_0_rgba(0,0,0,0.1)]
                    ${button3D}`}
                  onClick={() => setIsChangingPassword(true)}
                >
                  <KeyRound className="h-4 w-4" />
                  Ganti Sandi
                </Button>
                <Button
                  className={`flex-1 gap-2 
                    bg-gradient-to-br from-red-500 via-red-600 to-red-800 
                    text-white shadow-[0_4px_0_rgba(0,0,0,0.4)] hover:shadow-[0_6px_0_rgba(0,0,0,0.4)] active:shadow-[0_2px_0_rgba(0,0,0,0.4)]
                    ${button3D}`}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-[#2C5EAD]">
                  Sandi Baru (min. 6 karakter)
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-[#C4E2F5] focus:border-[#1591DC] focus:ring-[#1591DC]/20 transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-[#2C5EAD]">
                  Konfirmasi Sandi Baru
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="border-[#C4E2F5] focus:border-[#1591DC] focus:ring-[#1591DC]/20 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className={`text-[#2C5EAD] bg-white shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:shadow-[0_6px_0_rgba(0,0,0,0.08)] active:shadow-[0_2px_0_rgba(0,0,0,0.08)]
                    ${button3D}`}
                  onClick={() => setIsChangingPassword(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] text-white 
                    shadow-[0_4px_0_rgba(0,0,0,0.3)] hover:shadow-[0_6px_0_rgba(0,0,0,0.3)] active:shadow-[0_2px_0_rgba(0,0,0,0.3)]
                    ${button3D}`}
                >
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