import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, RefreshCw, Save, AlertCircle } from "lucide-react";

interface UserWithUsername {
  username?: string;
  //email?: string;
  id?: string;
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

  const username = (user as UserWithUsername)?.username || "";

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

  // Mulai kamera
  const startWebcam = useCallback(async () => {
    setCameraError(null);
    // Hentikan stream lama jika ada
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

  // Mulai saat model siap
  useEffect(() => {
    if (modelsLoaded) {
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
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Registrasi Wajah</CardTitle>
          <CardDescription>Pastikan pencahayaan cukup dan wajah terlihat jelas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!modelsLoaded ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="animate-spin h-8 w-8 text-blue-500" />
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
                <video ref={videoRef} autoPlay muted playsInline width="640" height="480" className="rounded-lg border shadow bg-black" />
                <canvas ref={canvasRef} width="640" height="480" className="absolute top-0 left-0" />
              </div>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button onClick={detectFace} disabled={detecting}>
                  <Camera className="mr-2 h-4 w-4" />
                  {detecting ? "Mendeteksi..." : "Deteksi Wajah"}
                </Button>
                <Button onClick={saveToDatabase} disabled={!faceDescriptor || saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Menyimpan..." : "Simpan Data Wajah"}
                </Button>
                <Button onClick={resetCamera} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" /> Reset Kamera
                </Button>
              </div>
              {faceDescriptor && (
                <div className="text-center text-green-600 text-sm">
                  <AlertCircle className="inline h-4 w-4 mr-1" /> Wajah terdeteksi, klik Simpan.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}