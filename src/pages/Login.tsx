import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCheck, ArrowLeft, Camera, RefreshCw, Loader2, AlertCircle, Sun, Moon, Cloud, Sparkles, CheckCircle, XCircle } from "lucide-react";
import { detectSmile } from "@/utils/liveness";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, faceSignIn } = useAuth();
  const navigate = useNavigate();

  // State untuk face login
  const [showFaceLogin, setShowFaceLogin] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [verifyingLiveness, setVerifyingLiveness] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dialog states
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Waktu saat ini untuk greeting
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
          await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
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
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [showFaceLogin, modelsLoaded, startWebcam]);

  // Fungsi deteksi dan cocokkan wajah + liveness senyum
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
        setErrorMessage("Gagal mengambil data pengguna");
        setErrorDialogOpen(true);
        setDetecting(false);
        return;
      }

      if (!users || users.length === 0) {
        setErrorMessage("Belum ada pengguna yang mendaftarkan wajah. Silakan registrasi wajah terlebih dahulu.");
        setErrorDialogOpen(true);
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

      if (!bestMatch) {
        setErrorMessage("Wajah tidak dikenali. Pastikan Anda sudah registrasi wajah atau coba lagi.");
        setErrorDialogOpen(true);
        setDetecting(false);
        return;
      }

      // LIVENESS CHECK (SENYUM)
      setVerifyingLiveness(true);
      toast.info(`Silakan tersenyum ke kamera...`);
      const isAlive = await detectSmile(videoRef.current, 7000);
      setVerifyingLiveness(false);

      if (!isAlive) {
        setErrorMessage("Verifikasi gagal: senyum tidak terdeteksi. Coba lagi.");
        setErrorDialogOpen(true);
        setDetecting(false);
        return;
      }

      toast.success(`Halo ${bestMatch.username}, wajah dikenali dan liveness terverifikasi! Login...`);
      const { error: loginError } = await faceSignIn(bestMatch.username);
      if (loginError) {
        setErrorMessage(loginError);
        setErrorDialogOpen(true);
      } else {
        setSuccessMessage("Login berhasil! Mengalihkan ke dashboard...");
        setSuccessDialogOpen(true);
        setTimeout(() => navigate("/dashboard"), 1500);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Terjadi kesalahan saat verifikasi wajah");
      setErrorDialogOpen(true);
    } finally {
      setDetecting(false);
      setVerifyingLiveness(false);
    }
  };

  const resetCamera = () => {
    toast.info("Merestart kamera...");
    startWebcam();
    if (canvasRef.current) {
      canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMessage("Username dan password harus diisi");
      setErrorDialogOpen(true);
      return;
    }
    setLoading(true);
    toast.info("Memproses login...");
    const { error } = await signIn(username, password);
    if (error) {
      setErrorMessage(error);
      setErrorDialogOpen(true);
    } else {
      setSuccessMessage("Login berhasil! Mengalihkan ke dashboard...");
      setSuccessDialogOpen(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    }
    setLoading(false);
  };

  // Fungsi untuk mendapatkan ikon greeting
  const getGreetingIcon = () => {
    if (greeting === "Selamat Pagi") return <Sun className="h-4 w-4" />;
    if (greeting === "Selamat Siang") return <Cloud className="h-4 w-4" />;
    return <Moon className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#C4E2F5]/30 via-white to-[#C4E2F5]/20 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
        {/* Dekorasi header dengan gradasi */}
        <div className="h-2 bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA]" />
        <CardHeader className="text-center space-y-4 pt-6">
          <div className="mx-auto flex h-24 w-24 items-center justify-center">
            <img src="/New.png" alt="SMARTAS Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-[#2C5EAD] to-[#1591DC] bg-clip-text text-transparent">
              SMARTAS
            </CardTitle>
            <CardDescription className="text-base mt-2 flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-[#4BB8FA]" />
              <span>Sistem Manajemen Akademik Terpadu</span>
            </CardDescription>
          </div>
          {/* Greeting & clock (estetika tambahan) */}
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-full py-1 px-3 w-fit mx-auto">
            {getGreetingIcon()}
            <span>{greeting},</span>
            <span>{formatDate(currentTime)}</span>
            <span className="font-mono">{currentTime.toLocaleTimeString("id-ID")}</span>
          </div>
        </CardHeader>
        <CardContent>
          {showFaceLogin ? (
            // Face Login UI
            <div className="space-y-5">
              {!modelsLoaded ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="animate-spin h-8 w-8 text-[#2C5EAD]" />
                  <span className="ml-2 text-slate-600">Memuat model wajah...</span>
                </div>
              ) : cameraError ? (
                <div className="text-center text-red-500 p-4 bg-red-50 rounded-xl">
                  <AlertCircle className="inline h-8 w-8 mb-2" />
                  <p>{cameraError}</p>
                  <Button onClick={resetCamera} variant="outline" className="mt-4 border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                    Coba Lagi
                  </Button>
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
                      className="rounded-xl border shadow-md bg-black"
                    />
                    <canvas
                      ref={canvasRef}
                      width="320"
                      height="240"
                      className="absolute top-0 left-0 rounded-xl"
                    />
                    {/* Overlay saat menunggu senyum */}
                    {verifyingLiveness && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl backdrop-blur-sm">
                        <div className="text-white text-center">
                          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" />
                          <p className="font-medium">Tersenyum ke kamera</p>
                          <p className="text-xs mt-1">Deteksi liveness...</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button 
                      onClick={detectAndMatchFace} 
                      disabled={detecting || verifyingLiveness}
                      className="bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white rounded-xl"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {detecting ? "Memverifikasi..." : "Verifikasi Wajah"}
                    </Button>
                    <Button 
                      onClick={resetCamera} 
                      variant="outline" 
                      disabled={detecting || verifyingLiveness}
                      className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white rounded-xl"
                    >
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
                      disabled={detecting || verifyingLiveness}
                      className="text-slate-600 hover:text-[#2C5EAD]"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Login biasa
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700">Nama Pengguna</Label>
                <Input 
                  id="username" 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                  disabled={loading} 
                  placeholder="Nama Pengguna" 
                  className="rounded-xl border-slate-200 focus:ring-[#1591DC] focus:border-[#1591DC]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  disabled={loading} 
                  placeholder="********" 
                  className="rounded-xl border-slate-200 focus:ring-[#1591DC] focus:border-[#1591DC]"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full rounded-xl bg-gradient-to-r from-[#2C5EAD] to-[#1591DC] hover:shadow-lg transition-all duration-200" 
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
                {loading ? "Memproses..." : "Masuk"}
              </Button>
              <div className="flex justify-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowFaceLogin(true);
                    toast.info("Beralih ke login wajah");
                  }}
                  className="text-[#1591DC] hover:underline font-medium"
                >
                  Login dengan Wajah
                </button>
              </div>
              <div className="text-center text-xs text-slate-400 border-t pt-4 mt-2">
                <p>© {new Date().getFullYear()} SMARTAS - Sistem Informasi Akademik</p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Pop-up Dialog Sukses */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="rounded-2xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-xl flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              Login Berhasil
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm text-slate-700">
            {successMessage}
          </DialogDescription>
          <DialogFooter>
            <Button 
              onClick={() => setSuccessDialogOpen(false)} 
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pop-up Dialog Gagal */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="rounded-2xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-xl flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Login Gagal
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm text-slate-700">
            {errorMessage}
          </DialogDescription>
          <DialogFooter>
            <Button 
              onClick={() => setErrorDialogOpen(false)} 
              variant="outline"
              className="rounded-xl border-red-300 text-red-600 hover:bg-red-50"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}