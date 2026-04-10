
// src/pages/Login.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Email dan password harus diisi");
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Login berhasil! Mengalihkan...");
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-4">
          {/* Logo dari public/smartas-logo.png */}
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
              Sistem Manajemen Akademik Terpadu
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Alamat Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="contoh: nama@sekolah.com"
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">
                Kata Sandi
              </Label>
              <Input
                id="password"
                type="password"
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
          </form>

          <div className="mt-6 text-center text-xs text-gray-500 border-t pt-4">
            <p>© {new Date().getFullYear()} SMARTAS - Sistem Manajemen Akademik</p>
            <p className="mt-1">Hubungi administrator jika mengalami masalah login</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}