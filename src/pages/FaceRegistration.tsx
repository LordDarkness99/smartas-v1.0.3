import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Camera, RefreshCw, Save, AlertCircle, Sun, Moon, Cloud, User, Calendar } from "lucide-react";

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
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const detectFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (videoRef.current.readyState !== 4) {
      toast.error("Kamera belum siap, tunggu sebentar");
      return;
    }
    setDetecting(true);
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        setFaceDescriptor(detection.descriptor);
        const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
        const resized = faceapi.resizeResults(detection, dims);
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        faceapi.draw.drawDetections(canvasRef.current, resized);
        faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
        toast.success("Wajah terdeteksi");
      } else {
        toast.error("Tidak ada wajah terdeteksi");
        setFaceDescriptor(null);
      }
    } catch (error) {
      toast.error("Error deteksi wajah");
    } finally {
      setDetecting(false);
    }
  };

  const saveToDatabase = async () => {
    if (!faceDescriptor) return toast.error("Deteksi wajah dulu");
    if (!username) return toast.error("Username tidak ditemukan");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("akun")
        .update({ muka: Array.from(faceDescriptor) })
        .eq("username", username);
      if (error) throw error;
      toast.success("Data wajah tersimpan");
      setFaceDescriptor(null);
      canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    } catch (err) {
      toast.error((err as Error).message || "Gagal menyimpan");
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
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button 
                    onClick={detectFace} 
                    disabled={detecting}
                    className="bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white rounded-xl"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {detecting ? "Mendeteksi..." : "Deteksi Wajah"}
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
    </div>
  );
}