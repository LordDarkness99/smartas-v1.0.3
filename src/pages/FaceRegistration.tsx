import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, RefreshCw, Save, AlertCircle, Sun, Moon, Cloud, Timer, CheckCircle, XCircle } from "lucide-react";

interface UserWithUsername {
  username?: string;
  id?: string;
  nama?: string;
}

export default function FaceRegistration() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [detectCooldown, setDetectCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // State untuk dialog pop-up
  const [accuracyDialogOpen, setAccuracyDialogOpen] = useState(false);
  const [accuracyMessage, setAccuracyMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const username = (user as UserWithUsername)?.username || "";
  const nama = (user as UserWithUsername)?.nama || "";

  // Greeting effect
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (detectCooldown && cooldownSeconds > 0) {
      interval = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            setDetectCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [detectCooldown, cooldownSeconds]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
        toast.success("Model wajah siap");
      } catch (error) {
        console.error(error);
        toast.error("Gagal load model face-api");
      }
    };
    loadModels();
  }, []);

  // Start webcam
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

  useEffect(() => {
    if (modelsLoaded) {
      startWebcam();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [modelsLoaded, startWebcam]);

  const resetCamera = () => {
    startWebcam();
    setFaceDescriptor(null);
    setDetectCooldown(false);
    setCooldownSeconds(0);
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const detectFace = async () => {
    if (detectCooldown) {
      toast.info(`Tunggu ${cooldownSeconds} detik lagi sebelum deteksi ulang`);
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState !== 4) {
      toast.error("Kamera belum siap, tunggu sebentar");
      return;
    }

    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      toast.error("Stream video belum siap, coba lagi");
      return;
    }

    setDetecting(true);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const confidence = detection.detection.score;
        // Ubah threshold dari 0.8 menjadi 0.94
        if (confidence < 0.94) {
          // Tentukan penyebab berdasarkan tingkat akurasi
          let penyebab = "";
          if (confidence < 0.6) penyebab = "Wajah terlalu jauh atau pencahayaan sangat buruk.";
          else if (confidence < 0.8) penyebab = "Pencahayaan kurang atau wajah tidak menghadap kamera dengan jelas.";
          else penyebab = "Pastikan wajah bersih dari penghalang (kacamata hitam, topi) dan pencahayaan cukup.";
          
          const msg = `Akurasi wajah terlalu rendah (${(confidence * 100).toFixed(1)}%). Minimal 94%. ${penyebab} Silakan deteksi ulang.`;
          setAccuracyMessage(msg);
          setAccuracyDialogOpen(true); // Tampilkan pop-up dialog
          
          setFaceDescriptor(null);
          canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          setDetectCooldown(true);
          setCooldownSeconds(5);
          return;
        }

        setFaceDescriptor(detection.descriptor);
        const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
        const resized = faceapi.resizeResults(detection, dims);
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        faceapi.draw.drawDetections(canvasRef.current, resized);
        faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
        toast.success(`Wajah terdeteksi dengan akurasi ${(confidence * 100).toFixed(1)}%`);
        
        setDetectCooldown(true);
        setCooldownSeconds(5);
      } else {
        toast.error("Tidak ada wajah terdeteksi. Pastikan wajah berada dalam frame kamera.");
        setFaceDescriptor(null);
        setDetectCooldown(true);
        setCooldownSeconds(2);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error deteksi wajah. Coba refresh halaman.");
    } finally {
      setDetecting(false);
    }
  };

  const saveToDatabase = async () => {
    if (!faceDescriptor) {
      toast.error("Belum ada wajah terdeteksi. Silakan deteksi wajah terlebih dahulu.");
      return;
    }
    if (!username) {
      toast.error("Username tidak ditemukan. Silakan login ulang.");
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("akun")
        .update({ muka: Array.from(faceDescriptor) })
        .eq("username", username);
        
      if (error) throw error;
      
      setSuccessMessage("✅ Data wajah berhasil disimpan!");
      setSuccessDialogOpen(true); // Pop-up sukses
      
      setFaceDescriptor(null);
      canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setDetectCooldown(false);
      setCooldownSeconds(0);
    } catch (err) {
      const errorMsg = (err as Error).message || "Gagal menyimpan data wajah";
      setErrorMessage(`❌ ${errorMsg}`);
      setErrorDialogOpen(true); // Pop-up error
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F7FC]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header gradasi */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-xl mb-6 sm:mb-8">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-2 border-white shadow-md">
                <AvatarFallback className="bg-white/30 text-white text-xl font-bold">
                  {nama?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                  <span>{greeting},</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{nama || "User"}</h1>
                <p className="text-blue-100 text-sm">Registrasi Wajah</p>
              </div>
            </div>
            <div className="bg-[#2C5EAD] rounded-xl px-4 py-2 text-center shadow-md">
              <div className="text-xs text-white/90">{formatDate(currentTime)}</div>
              <div className="text-lg font-semibold text-white">{currentTime.toLocaleTimeString("id-ID")}</div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-xl">
                <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-xl">Registrasi Wajah</CardTitle>
                <CardDescription className="text-blue-100 text-xs sm:text-sm">
                  Pastikan pencahayaan cukup dan wajah terlihat jelas.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-6">
            {!modelsLoaded ? (
              <div className="flex justify-center items-center h-64">
                <RefreshCw className="animate-spin h-8 w-8 text-[#2C5EAD]" />
                <span className="ml-2 text-[#2C5EAD]">Memuat model wajah...</span>
              </div>
            ) : cameraError ? (
              <div className="text-center text-red-500 p-4 bg-red-50 rounded-xl">
                <AlertCircle className="inline h-8 w-8 mb-2" />
                <p>{cameraError}</p>
                <Button onClick={resetCamera} variant="outline" className="mt-4 border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                  <RefreshCw className="mr-2 h-4 w-4" /> Coba Lagi
                </Button>
              </div>
            ) : (
              <>
                <div className="relative flex justify-center">
                  <div className="relative rounded-xl overflow-hidden shadow-lg bg-black">
                    <video ref={videoRef} autoPlay muted playsInline width="640" height="480" className="w-full h-auto rounded-xl" />
                    <canvas ref={canvasRef} width="640" height="480" className="absolute top-0 left-0 w-full h-full" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 justify-center items-center">
                  <Button 
                    onClick={detectFace} 
                    disabled={detecting || detectCooldown}
                    className="bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white rounded-xl"
                  >
                    {detectCooldown ? (
                      <>
                        <Timer className="mr-2 h-4 w-4 animate-pulse" />
                        Tunggu {cooldownSeconds}s
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        {detecting ? "Mendeteksi..." : "Deteksi Wajah"}
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={saveToDatabase} 
                    disabled={!faceDescriptor || saving}
                    variant="outline"
                    className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white rounded-xl"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Menyimpan..." : "Simpan Data Wajah"}
                  </Button>
                  <Button 
                    onClick={resetCamera} 
                    variant="outline"
                    className="border-gray-300 text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset Kamera
                  </Button>
                </div>
                {faceDescriptor && (
                  <div className="bg-emerald-50 rounded-xl p-3 text-center text-emerald-700 text-sm flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>✓ Wajah terdeteksi, klik Simpan untuk menyimpan data wajah Anda.</span>
                  </div>
                )}
                {detectCooldown && !faceDescriptor && (
                  <div className="bg-amber-50 rounded-xl p-3 text-center text-amber-700 text-sm flex items-center justify-center gap-2">
                    <Timer className="h-4 w-4" />
                    <span>Mohon tunggu {cooldownSeconds} detik sebelum mencoba deteksi ulang.</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pt-4 mt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Sistem Registrasi Wajah - SmartAS</p>
        </div>
      </div>

      {/* Pop-up Dialog untuk Akurasi Rendah */}
      <Dialog open={accuracyDialogOpen} onOpenChange={setAccuracyDialogOpen}>
        <DialogContent className="rounded-2xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-xl flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Akurasi Wajah Rendah
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm text-slate-700">
            {accuracyMessage}
          </DialogDescription>
          <DialogFooter>
            <Button 
              onClick={() => setAccuracyDialogOpen(false)} 
              className="rounded-xl bg-[#2C5EAD] hover:bg-[#2C5EAD]/80"
            >
              Mengerti, Coba Lagi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pop-up Dialog untuk Sukses Simpan */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="rounded-2xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-xl flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              Berhasil
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

      {/* Pop-up Dialog untuk Error Simpan */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="rounded-2xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-xl flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Gagal Menyimpan
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