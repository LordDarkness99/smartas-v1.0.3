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

  // ========== KONFIGURASI WARNA SIDEBAR ==========
  // Ubah nilai di bawah ini untuk mengganti seluruh warna background sidebar
  const sidebarBg = "bg-white";           // background utama sidebar
  const sidebarBorder = "border-indigo-100"; // warna border
  const sidebarShadow = "shadow-lg";       // shadow

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

  return (
    <>
      <Sidebar
        collapsible="icon"
        side={isMobile ? "right" : "left"}
        className={`${sidebarBg} border-r ${sidebarBorder} ${sidebarShadow}`}
      >
        {/* HEADER - warna sama dengan sidebar */}
        <SidebarHeader className={`py-5 px-6 flex flex-col items-center justify-center ${sidebarBg}`}>
          <div className="mb-0.5 flex items-center justify-center h-14 w-full text-center">
            <img src="/smartas-logo.png" alt="SMARTAS Logo" className="h-12 w-auto object-contain" />
          </div>
          <div className="text-center group-data-[collapsible=icon]:hidden">
            <h2 className="text-xl font-black italic tracking-tighter bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent uppercase leading-[0.8]">
              SMARTAS
            </h2>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-indigo-400 mt-1.5">
              {userRole || "Access"} Mode
            </p>
          </div>
        </SidebarHeader>

        {/* CONTENT - warna sama */}
        <SidebarContent className={`px-4 py-0 ${sidebarBg}`}>
          <SidebarGroup>
            <SidebarGroupLabel className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400 text-center group-data-[collapsible=icon]:hidden">
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
                        onClick={() => { if (isMobile) setOpenMobile(false); }}
                        className={`group mb-1 h-10 px-4 transition-all duration-300 rounded-xl ${
                          isActive
                            ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-200"
                            : "text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                        }`}
                      >
                        <Link to={item.path} className="flex items-center gap-3">
                          <item.icon
                            className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${
                              isActive ? "text-white" : "text-indigo-500 group-hover:text-indigo-600"
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

        {/* FOOTER - warna sama, dengan logika seperti yang diinginkan */}
        <SidebarFooter className={`p-4 border-t ${sidebarBorder} ${sidebarBg}`}>
          <div className={`flex items-center gap-3 rounded-2xl ${sidebarBg} p-2.5 shadow-sm border ${sidebarBorder} overflow-hidden`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-inner">
              <UserCircle className="h-5.5 w-5.5" />
            </div>
            <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[9px] font-bold text-indigo-600 uppercase tracking-tighter">{userRole} Akun</p>
              <p className="truncate text-sm font-black text-indigo-900 leading-tight">{userName || "User"}</p>
            </div>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-all duration-200 group-data-[collapsible=icon]:hidden"
            >
              <UserCircle className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-indigo-100 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-indigo-800">Akun Saya</DialogTitle>
            <DialogDescription className="text-indigo-500">Informasi akun dan pengaturan sandi</DialogDescription>
          </DialogHeader>

          {!isChangingPassword ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-indigo-600">Nama</p>
                <p className="text-base font-semibold text-indigo-900">{userName || "User"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-indigo-600">Role</p>
                <p className="text-base font-semibold text-indigo-900 capitalize">{userRole || "-"}</p>
              </div>
              {username && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-indigo-600">Nama Pengguna</p>
                  <p className="text-base font-semibold text-indigo-900">{username}</p>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1 gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50" onClick={() => setIsChangingPassword(true)}>
                  <KeyRound className="h-4 w-4" />
                  Ganti Sandi
                </Button>
                <Button variant="destructive" className="flex-1 gap-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-indigo-700">Sandi Baru (min. 6 karakter)</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-indigo-700">Konfirmasi Sandi Baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="border-indigo-200 focus:border-indigo-400"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsChangingPassword(false)} className="text-indigo-600">
                  Batal
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
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