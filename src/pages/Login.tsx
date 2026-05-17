// src/pages/Login.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { UserCheck, KeyRound, ArrowLeft, Camera, RefreshCw, Loader2, AlertCircle } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, faceSignIn } = useAuth();
  const navigate = useNavigate();

  // State untuk form ganti password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changeUsername, setChangeUsername] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // State untuk face login
  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load model face-api
  useEffect(() => {
    if (showFaceLogin) {
      toast.info("Memuat model pengenalan wajah...");
      const loadModels = async () => {
        try {
          const MODEL_URL = "/models";
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
          await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
          setModelsLoaded(true);
          toast.success("Model wajah siap digunakan");
        } catch (error) {
          console.error(error);
          toast.error("Gagal memuat model wajah. Periksa folder /models");
        }
      };
      loadModels();
    }
  }, [showFaceLogin]);

  // Mulai kamera
  const startWebcam = useCallback(async () => {
    setCameraError(null);
    if (videoRef.current?.srcObject) {
      const oldStream = videoRef.current.srcObject as MediaStream;
      oldStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true;
        await videoRef.current.play();
        toast.success("Kamera berhasil diaktifkan");
      }
    } catch (err) {
      console.error(err);
      let msg = "Tidak dapat mengakses kamera. Periksa izin.";
      if ((err as Error).name === "NotAllowedError") msg = "Izin kamera ditolak. Izinkan akses kamera.";
      else if ((err as Error).name === "NotFoundError") msg = "Tidak ada kamera terdeteksi.";
      setCameraError(msg);
      toast.error(msg);
    }
  }, []);

  // Mulai saat model siap dan showFaceLogin true
  useEffect(() => {
    if (showFaceLogin && modelsLoaded) {
      startWebcam();
    }
    // Cleanup
    const video = videoRef.current;
    return () => {
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    };
  }, [showFaceLogin, modelsLoaded, startWebcam]);

  // Fungsi deteksi dan cocokkan wajah
  const detectAndMatchFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState !== 4) {
      toast.error("Kamera belum siap, tunggu sebentar");
      return;
    }
    setDetecting(true);
    toast.info("Memverifikasi wajah...");
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("Tidak ada wajah terdeteksi. Pastikan wajah Anda terlihat jelas.");
        setDetecting(false);
        return;
      }

      const currentDescriptor = detection.descriptor;

      // Ambil semua user yang punya data wajah
      const { data: users, error } = await supabase
        .from("akun")
        .select("username, nama, muka")
        .not("muka", "is", null);

      if (error) {
        toast.error("Gagal mengambil data pengguna");
        setDetecting(false);
        return;
      }

      if (!users || users.length === 0) {
        toast.error("Belum ada pengguna yang mendaftarkan wajah. Silakan registrasi wajah terlebih dahulu.");
        setDetecting(false);
        return;
      }

      // Bandingkan dengan Euclidean distance
      let bestMatch: { username: string; distance: number } | null = null;
      for (const user of users) {
        const storedDescriptor = user.muka as number[];
        if (!storedDescriptor) continue;
        const distance = faceapi.euclideanDistance(currentDescriptor, storedDescriptor);
        if (distance < 0.6) {
          if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { username: user.username, distance };
          }
        }
      }

      if (bestMatch) {
        toast.success(`Halo ${bestMatch.username}, wajah dikenali! Login...`);
        const { error: loginError } = await faceSignIn(bestMatch.username);
        if (loginError) {
          toast.error(loginError);
        } else {
          toast.success("Login berhasil! Mengalihkan...");
          setTimeout(() => navigate("/dashboard"), 1000);
        }
      } else {
        toast.error("Wajah tidak dikenali. Pastikan Anda sudah registrasi wajah atau coba lagi.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat verifikasi wajah");
    } finally {
      setDetecting(false);
    }
  };

  // Reset kamera
  const resetCamera = () => {
    toast.info("Merestart kamera...");
    startWebcam();
    if (canvasRef.current) {
      canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Login manual dengan password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Username dan password harus diisi");
      return;
    }
    setLoading(true);
    toast.info("Memproses login...");
    const { error } = await signIn(username, password);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Login berhasil! Mengalihkan...");
      setTimeout(() => navigate("/dashboard"), 1000);
    }
    setLoading(false);
  };

  // Ganti password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeUsername || !oldPassword || !newPassword || !confirmNewPassword) {
      toast.error("Semua field harus diisi");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Password baru tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setChangingPassword(true);
    toast.info("Mengganti password...");
    try {
      const { data: akun, error: fetchError } = await supabase
        .from("akun")
        .select("kata_sandi")
        .eq("username", changeUsername)
        .single();
      if (fetchError || !akun) {
        toast.error("Username tidak ditemukan");
        return;
      }
      const isPasswordValid = await bcrypt.compare(oldPassword, akun.kata_sandi);
      if (!isPasswordValid) {
        toast.error("Password lama salah");
        return;
      }
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      const { error: updateError } = await supabase
        .from("akun")
        .update({ kata_sandi: hashedNewPassword })
        .eq("username", changeUsername);
      if (updateError) throw updateError;
      toast.success("Password berhasil diubah! Silakan login dengan password baru.");
      setShowChangePassword(false);
      setChangeUsername("");
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: unknown) {
      toast.error((error as Error).message || "Terjadi kesalahan saat mengganti password");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center">
            <img src="/smartas-logo.png" alt="SMARTAS Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SMARTAS
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {showFaceLogin ? "Login dengan Wajah" : showChangePassword ? "Ganti Password" : "Sistem Manajemen Akademik Terpadu"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {showFaceLogin ? (
            // Face Login UI
            <div className="space-y-4">
              {!modelsLoaded ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
                  <span className="ml-2">Memuat model wajah...</span>
                </div>
              ) : cameraError ? (
                <div className="text-center text-red-500 p-4">
                  <AlertCircle className="inline h-8 w-8 mb-2" />
                  <p>{cameraError}</p>
                  <Button onClick={resetCamera} variant="outline" className="mt-4">Coba Lagi</Button>
                </div>
              ) : (
                <>
                  <div className="relative flex justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      width="320"
                      height="240"
                      className="rounded-lg border shadow bg-black"
                    />
                    <canvas
                      ref={canvasRef}
                      width="320"
                      height="240"
                      className="absolute top-0 left-0"
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Button onClick={detectAndMatchFace} disabled={detecting}>
                      <Camera className="mr-2 h-4 w-4" />
                      {detecting ? "Memverifikasi..." : "Verifikasi Wajah"}
                    </Button>
                    <Button onClick={resetCamera} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" /> Reset Kamera
                    </Button>
                    <Button
                      onClick={() => {
                        setShowFaceLogin(false);
                        if (videoRef.current?.srcObject) {
                          (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                          videoRef.current.srcObject = null;
                        }
                        toast.info("Kembali ke login manual");
                      }}
                      variant="ghost"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : !showChangePassword ? (
            // Login biasa
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="nama_pengguna" disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="********" disabled={loading} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                {loading ? "Memproses..." : "Masuk"}
              </Button>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setShowFaceLogin(true);
                    toast.info("Beralih ke login wajah");
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Login dengan Wajah
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(true);
                    toast.info("Buka form ganti password");
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Lupa / Ganti Password?
                </button>
              </div>
              <div className="text-center text-xs text-gray-500 border-t pt-4">
                <p>© {new Date().getFullYear()} SMARTAS - Sistem Manajemen Akademik</p>
              </div>
            </form>
          ) : (
            // Form ganti password
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="changeUsername">Username</Label>
                <Input id="changeUsername" type="text" value={changeUsername} onChange={(e) => setChangeUsername(e.target.value)} required placeholder="Masukkan username" disabled={changingPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oldPassword">Password Lama</Label>
                <Input id="oldPassword" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required disabled={changingPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password Baru (min. 6)</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={changingPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Konfirmasi Password Baru</Label>
                <Input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required disabled={changingPassword} />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => {
                  setShowChangePassword(false);
                  toast.info("Batal ganti password");
                }} disabled={changingPassword}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Batal
                </Button>
                <Button type="submit" className="flex-1" disabled={changingPassword}>
                  {changingPassword ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  {changingPassword ? "Memproses..." : "Ganti Password"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}