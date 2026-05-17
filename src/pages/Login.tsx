// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserCheck, KeyRound, ArrowLeft } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // State untuk form ganti password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changeUsername, setChangeUsername] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Nama Pengguna dan Sandi harus diisi");
      return;
    }

    setLoading(true);
    const { error } = await signIn(username, password);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Masuk berhasil! Mengalihkan...");
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!changeUsername || !oldPassword || !newPassword || !confirmNewPassword) {
      toast.error("Semua field harus diisi");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Sandi baru tidak cocok");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Sandi minimal 6 karakter");
      return;
    }

    setChangingPassword(true);
    try {
      // 1. Ambil data akun berdasarkan username
      const { data: akun, error: fetchError } = await supabase
        .from("akun")
        .select("kata_sandi")
        .eq("username", changeUsername)
        .single();

      if (fetchError || !akun) {
        toast.error("Nama Pengguna tidak ditemukan");
        return;
      }

      // 2. Verifikasi password lama dengan bcrypt
      const isPasswordValid = await bcrypt.compare(oldPassword, akun.kata_sandi);
      if (!isPasswordValid) {
        toast.error("Sandi lama salah");
        return;
      }

      // 3. Hash password baru
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // 4. Update password di database
      const { error: updateError } = await supabase
        .from("akun")
        .update({ kata_sandi: hashedNewPassword })
        .eq("username", changeUsername);

      if (updateError) throw updateError;

      toast.success("Sandi berhasil diubah! Silakan login dengan sandi baru.");
      // Reset form dan kembali ke mode login
      setShowChangePassword(false);
      setChangeUsername("");
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Terjadi kesalahan saat mengganti sandi");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center">
            <img
              src="/smartas-logo.png"
              alt="SMARTAS Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SMARTAS
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {showChangePassword ? "Ganti Sandi" : "Sistem Manajemen Akademik Terpadu"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!showChangePassword ? (
            // Form Login
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold">
                  Nama Pengguna
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="contoh: nama_pengguna"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="Sandi" className="text-sm font-semibold">
                  Kata Sandi
                </Label>
                <Input
                  id="Password"
                  type="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Masukkan kata sandi"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Memproses...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Masuk
                  </div>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                >
                  Lupa / Ganti Sandi?
                </button>
              </div>

              <div className="mt-6 text-center text-xs text-gray-500 border-t pt-4">
                <p>© {new Date().getFullYear()} SMARTAS - Sistem Manajemen Akademik</p>
                <p className="mt-1">Hubungi administrator jika mengalami masalah login</p>
              </div>
            </form>
          ) : (
            // Form Ganti Password
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="changeUsername" className="text-sm font-semibold">
                  Nama Pengguna
                </Label>
                <Input
                  id="changeUsername"
                  type="text"
                  value={changeUsername}
                  onChange={(e) => setChangeUsername(e.target.value)}
                  required
                  placeholder="Masukkan nama pengguna Anda"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="oldPassword" className="text-sm font-semibold">
                  Sandi Lama
                </Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder="Masukkan sandi lama"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-semibold">
                  Sandi Baru (min. 6 karakter)
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Masukkan sandi baru"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword" className="text-sm font-semibold">
                  Konfirmasi Sandi Baru
                </Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  placeholder="Ulangi sandi baru"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={changingPassword}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => {
                    setShowChangePassword(false);
                    setChangeUsername("");
                    setOldPassword("");
                    setNewPassword("");
                    setConfirmNewPassword("");
                  }}
                  disabled={changingPassword}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Kembali
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Memproses...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      Ganti Sandi
                    </div>
                  )}
                </Button>
              </div>

              <div className="text-center text-xs text-gray-500 border-t pt-4 mt-2">
                <p>Pastikan Anda mengingat sandi baru setelah mengganti.</p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}