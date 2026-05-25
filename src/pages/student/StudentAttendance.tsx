import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Loader2,
  MapPin,
  QrCode,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  User,
  GraduationCap,
  School,
  Briefcase,
  Home,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  Info,
  AlertCircle,
  Sparkles,
  Trophy,
  Star,
  Activity,
  Bell,
  Fingerprint,
  Smartphone,
  Shield,
  Heart,
  Smile,
  ThumbsUp,
  Camera,
  ScanFace,
} from "lucide-react";

// 👇 Impor untuk face-api dan webcam
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";

// ==================== TIPE DATA ====================
interface SiswaData {
  id_siswa: number;
  nama: string;
  nis: string;
  id_pkl: number | null;
  id_kelas: number;
  tempat_pkl?: string;
  koordinat_pkl?: string;
}

interface JadwalHariIni {
  id_jadwal: number;
  mata_pelajaran: string;
  jam: string;
  guru: string;
  sudah_presensi: boolean;
}

// ==================== MODAL UNTUK SCAN WAJAH ====================
interface FaceCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (expression: string) => void;
  isLoading?: boolean;
}

function FaceCaptureModal({ isOpen, onClose, onCapture, isLoading }: FaceCaptureModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedExpression, setDetectedExpression] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadModels = async () => {
      try {
        const MODEL_URL = "/models";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        setModelsLoaded(true);
        setError(null);
      } catch (err: any) {
        console.error(err);
        setError("Gagal memuat model deteksi wajah.");
      }
    };
    loadModels();
  }, [isOpen]);

  const detectExpression = async () => {
    if (!webcamRef.current || !modelsLoaded) return;
    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;
    setDetecting(true);
    setError(null);
    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      if (detection) {
        const expressions = detection.expressions;
        const topExpression = Object.entries(expressions).reduce((a, b) => (a[1] > b[1] ? a : b));
        const expressionName = topExpression[0];
        const confidence = topExpression[1];
        if (confidence > 0.5) {
          setDetectedExpression(expressionName);
          setError(null);
        } else {
          setError("Ekspresi kurang jelas, coba hadap langsung ke kamera.");
        }
      } else {
        setError("Tidak ada wajah terdeteksi.");
      }
    } catch (err: any) {
      setError("Gagal mendeteksi ekspresi: " + err.message);
    } finally {
      setDetecting(false);
    }
  };

  const confirmExpression = () => {
    if (detectedExpression) {
      onCapture(detectedExpression);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-[#2C5EAD] to-[#1591DC] px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <ScanFace className="h-5 w-5" />
            <h3 className="font-semibold">Scan Wajah & Deteksi Ekspresi</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {!modelsLoaded ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#2C5EAD]" />
              <p className="mt-2 text-sm text-slate-500">Memuat model deteksi wajah...</p>
            </div>
          ) : error && !detectedExpression ? (
            <div className="bg-red-50 rounded-xl p-3 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="relative rounded-xl overflow-hidden bg-black/5">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "user" }}
              className="w-full rounded-xl"
              mirrored
            />
            {detecting && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>
          {detectedExpression && (
            <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
              <Smile className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Ekspresi terdeteksi:</p>
                <p className="text-lg font-bold text-emerald-900 capitalize">{detectedExpression}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={detectExpression}
              disabled={detecting || !modelsLoaded}
              className="flex-1 bg-[#2C5EAD] hover:bg-[#2C5EAD]/80"
            >
              {detecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
              Deteksi Ekspresi
            </Button>
            <Button
              onClick={confirmExpression}
              disabled={!detectedExpression || isLoading}
              variant="default"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Gunakan Ekspresi Ini
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== KOMPONEN UTAMA ====================
export default function StudentAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");

  const [siswa, setSiswa] = useState<SiswaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  // Presensi harian
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{ verified: boolean; message: string } | null>(null);
  const [todayPresensi, setTodayPresensi] = useState<{ masuk?: any; pulang?: any }>({});

  // State untuk modal scan wajah
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [presensiType, setPresensiType] = useState<"masuk" | "pulang">("masuk");
  const [pendingPresensiData, setPendingPresensiData] = useState<{ status: string } | null>(null);

  // Presensi mapel
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalHariIni[]>([]);
  const [scanningJadwalId, setScanningJadwalId] = useState<number | null>(null);
  const [isLoadingJadwal, setIsLoadingJadwal] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";

  // Koordinat sekolah
  const SCHOOL_COORD = { lat: -7.3104531, lng: 112.7239911 };

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== FETCH SISWA DATA ====================
  useEffect(() => {
    const fetchSiswaData = async () => {
      if (!user?.id_siswa) return;
      try {
        const { data, error } = await supabase
          .from("siswa")
          .select(`
            id_siswa,
            nama,
            nis,
            id_pkl,
            id_kelas,
            pkl:pkl (tempat_pkl, koordinat_pkl)
          `)
          .eq("id_siswa", user.id_siswa)
          .single();
        if (error) throw error;
        setSiswa({
          id_siswa: data.id_siswa,
          nama: data.nama,
          nis: data.nis?.toString() || "",
          id_pkl: data.id_pkl,
          id_kelas: data.id_kelas,
          tempat_pkl: data.pkl?.tempat_pkl,
          koordinat_pkl: data.pkl?.koordinat_pkl,
        });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchSiswaData();
  }, [user, toast]);

  // ==================== FETCH TODAY PRESENSI ====================
  useEffect(() => {
    if (!siswa) return;
    const fetchTodayPresensi = async () => {
      const today = new Date().toISOString().split("T")[0];
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data, error } = await supabase
        .from("presensi_harian")
        .select("*")
        .eq("id_siswa", siswa.id_siswa)
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      if (error) {
        console.error(error);
        return;
      }
      const masuk = data?.find(p => p.status_presensi === "Hadir" || p.status_presensi === "Terlambat");
      const pulang = data?.find(p => p.status_presensi === "Pulang");
      setTodayPresensi({ masuk, pulang });
    };
    fetchTodayPresensi();
  }, [siswa]);

  // ==================== FETCH JADWAL HARI INI ====================
  useEffect(() => {
    if (!siswa) return;
    const fetchJadwalHariIni = async () => {
      setIsLoadingJadwal(true);
      try {
        const today = new Date();
        const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const hariIni = daysMap[today.getDay()];

        const { data: jadwalData, error: jadwalError } = await supabase
          .from("jadwal")
          .select(`
            id_jadwal,
            jam,
            mapel:mata_pelajaran (nama),
            guru:guru (nama)
          `)
          .eq("id_kelas", siswa.id_kelas)
          .eq("hari", hariIni)
          .eq("aktif", true);
        if (jadwalError) throw jadwalError;

        const start = `${today.toISOString().split("T")[0]}T00:00:00`;
        const end = `${today.toISOString().split("T")[0]}T23:59:59`;
        const { data: presensiData, error: presensiError } = await supabase
          .from("presensi_siswa_mapel")
          .select("id_jadwal")
          .eq("id_siswa", siswa.id_siswa)
          .gte("waktu_presensi", start)
          .lte("waktu_presensi", end);
        if (presensiError) throw presensiError;

        const sudahPresensiIds = new Set(presensiData?.map(p => p.id_jadwal) || []);

        const formatted: JadwalHariIni[] = (jadwalData || []).map((item: any) => ({
          id_jadwal: item.id_jadwal,
          mata_pelajaran: item.mapel?.nama || "-",
          jam: item.jam,
          guru: item.guru?.nama || "-",
          sudah_presensi: sudahPresensiIds.has(item.id_jadwal),
        }));
        setJadwalHariIni(formatted);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setIsLoadingJadwal(false);
      }
    };
    fetchJadwalHariIni();
  }, [siswa, toast]);

  // ==================== VALIDATE LOCATION ====================
  const validateLocation = async (): Promise<{ valid: boolean; message: string }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ valid: false, message: "Browser tidak mendukung geolocation" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy, speed } = position.coords;
          const timestamp = position.timestamp;
          if (accuracy < 5) {
            resolve({ valid: false, message: "⚠️ Lokasi terdeteksi tidak wajar (akurasi terlalu tinggi)" });
            return;
          }
          if (accuracy > 1000) {
            resolve({ valid: false, message: "⚠️ GPS tidak stabil, coba aktifkan ulang lokasi" });
            return;
          }
          const now = Date.now();
          if (now - timestamp > 10000) {
            resolve({ valid: false, message: "⚠️ Lokasi tidak real-time (terdeteksi delay)" });
            return;
          }
          if (speed && speed > 50) {
            resolve({ valid: false, message: "⚠️ Pergerakan tidak wajar terdeteksi" });
            return;
          }
          let targetCoord = SCHOOL_COORD;
          let targetName = "Sekolah";
          if (siswa?.id_pkl && siswa.koordinat_pkl) {
            const [pklLat, pklLng] = siswa.koordinat_pkl.split(",").map(Number);
            targetCoord = { lat: pklLat, lng: pklLng };
            targetName = siswa.tempat_pkl || "Tempat PKL";
          }
          const R = 6371;
          const dLat = (targetCoord.lat - latitude) * Math.PI / 180;
          const dLng = (targetCoord.lng - longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(latitude * Math.PI / 180) * Math.cos(targetCoord.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          const radius = 0.1; // 100 meter
          if (distance <= radius) {
            resolve({ valid: true, message: `✅ Berada di ${targetName} (jarak ${distance.toFixed(2)} km)` });
          } else {
            resolve({ valid: false, message: `❌ Anda tidak berada di ${targetName}. Jarak ${distance.toFixed(2)} km` });
          }
        },
        (error) => {
          resolve({ valid: false, message: `Gagal mendapatkan lokasi: ${error.message}` });
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    });
  };

  // ==================== PROSES PRESENSI DENGAN EKSPRESI ====================
  const prosesPresensiDenganEkspresi = async (ekspresi: string) => {
    if (!siswa || !pendingPresensiData) return;
    const now = new Date();
    const status = pendingPresensiData.status;
    try {
      const { error } = await supabase.from("presensi_harian").insert({
        id_siswa: siswa.id_siswa,
        status_presensi: status,
        waktu_presensi: now.toISOString(),
        ekspresi: ekspresi,
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: `✅ Presensi ${status === "Pulang" ? "pulang" : "masuk"} tercatat dengan ekspresi ${ekspresi}` });
      const today = new Date().toISOString().split("T")[0];
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data } = await supabase
        .from("presensi_harian")
        .select("*")
        .eq("id_siswa", siswa.id_siswa)
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      const masuk = data?.find(p => p.status_presensi === "Hadir" || p.status_presensi === "Terlambat");
      const pulang = data?.find(p => p.status_presensi === "Pulang");
      setTodayPresensi({ masuk, pulang });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setPendingPresensiData(null);
    }
  };

  const handleMasuk = async () => {
    setIsSubmitting(true);
    setLocationStatus(null);
    const { valid, message } = await validateLocation();
    if (!valid) {
      setLocationStatus({ verified: false, message });
      toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setLocationStatus({ verified: true, message });
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const batasTerlambat = 7 * 60 + 30;
    const currentMinutes = currentHour * 60 + currentMinute;
    const status = currentMinutes <= batasTerlambat ? "Hadir" : "Terlambat";
    setPendingPresensiData({ status });
    setPresensiType("masuk");
    setShowFaceModal(true);
    setIsSubmitting(false);
  };

  const handlePulang = async () => {
    if (!todayPresensi.masuk) {
      toast({ title: "Belum masuk", description: "Silakan presensi masuk terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setLocationStatus(null);
    const { valid, message } = await validateLocation();
    if (!valid) {
      setLocationStatus({ verified: false, message });
      toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setLocationStatus({ verified: true, message });
    setPendingPresensiData({ status: "Pulang" });
    setPresensiType("pulang");
    setShowFaceModal(true);
    setIsSubmitting(false);
  };

  const handleFaceCaptured = (expression: string) => {
    prosesPresensiDenganEkspresi(expression);
  };

  // ==================== QR SCANNER FUNCTIONS ====================
  const startScanner = (jadwalId: number) => {
    setScanningJadwalId(jadwalId);
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setTimeout(() => {
      const element = document.getElementById(scannerContainerId);
      if (element) {
        element.innerHTML = "";
        import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
          scannerRef.current = new Html5QrcodeScanner(
            scannerContainerId,
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
          );
          scannerRef.current.render(onScanSuccess, onScanError);
        });
      } else {
        toast({ title: "Error", description: "Elemen scanner tidak ditemukan", variant: "destructive" });
      }
    }, 100);
  };

  const onScanSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanningJadwalId(null);
    await processQRCode(decodedText);
  };

  const onScanError = (error: any) => {
    console.error(error);
  };

  const processQRCode = async (qrData: string) => {
    try {
      const payload = JSON.parse(qrData);
      const { id_jadwal, nonce, exp } = payload;
      if (!id_jadwal || !nonce || !exp) {
        toast({ title: "QR tidak valid", description: "QR Code tidak dikenali", variant: "destructive" });
        return;
      }
      const now = Date.now();
      if (now > exp) {
        toast({ title: "QR kadaluarsa", description: "QR Code sudah tidak berlaku", variant: "destructive" });
        return;
      }
      const { data: existingNonce, error: nonceError } = await (supabase
        .from('active_qr_nonce') as any)
        .select("nonce, used")
        .eq("nonce", nonce)
        .single();
      if (nonceError || !existingNonce) {
        toast({ title: "QR tidak valid", description: "QR Code tidak dikenali oleh sistem", variant: "destructive" });
        return;
      }
      if (existingNonce.used) {
        toast({ title: "QR sudah digunakan", description: "QR Code ini sudah dipakai sebelumnya", variant: "destructive" });
        return;
      }
      await (supabase.from('active_qr_nonce') as any)
        .update({ used: true })
        .eq("nonce", nonce);
      const { data: jadwal, error: jadwalError } = await supabase
        .from("jadwal")
        .select(`
          id_jadwal,
          hari,
          jam,
          id_kelas,
          mapel:mata_pelajaran (nama),
          guru:guru (nama)
        `)
        .eq("id_jadwal", id_jadwal)
        .single();
      if (jadwalError || !jadwal) {
        toast({ title: "Jadwal tidak ditemukan", variant: "destructive" });
        return;
      }
      if (jadwal.id_kelas !== siswa?.id_kelas) {
        toast({ title: "Tidak berhak", description: "Anda tidak terdaftar di kelas ini", variant: "destructive" });
        return;
      }
      const today = new Date();
      const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const hariIni = daysMap[today.getDay()];
      if (jadwal.hari !== hariIni) {
        toast({ title: "Bukan hari ini", description: `Jadwal ini untuk hari ${jadwal.hari}`, variant: "destructive" });
        return;
      }
      const [startHour, startMin] = jadwal.jam.split(" - ")[0].split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
      if (currentMinutes < startMinutes - 15 || currentMinutes > startMinutes + 45) {
        toast({ title: "Di luar waktu", description: "Presensi hanya dapat dilakukan 15 menit sebelum hingga 45 menit setelah jadwal dimulai", variant: "destructive" });
        return;
      }
      const { valid, message } = await validateLocation();
      if (!valid) {
        toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
        return;
      }
      const { error: insertError } = await supabase.from("presensi_siswa_mapel").insert({
        id_siswa: siswa!.id_siswa,
        id_jadwal: id_jadwal,
        status: "Hadir",
        waktu_presensi: new Date().toISOString(),
      });
      if (insertError) {
        if (insertError.code === "23505") {
          toast({ title: "Sudah presensi", description: "Anda sudah melakukan presensi untuk jadwal ini", variant: "destructive" });
        } else {
          throw insertError;
        }
      } else {
        toast({ title: "Berhasil", description: `✅ Presensi ${jadwal.mapel?.nama} tercatat` });
        const todayStr = today.toISOString().split("T")[0];
        const start = `${todayStr}T00:00:00`;
        const end = `${todayStr}T23:59:59`;
        const { data: presensiData } = await supabase
          .from("presensi_siswa_mapel")
          .select("id_jadwal")
          .eq("id_siswa", siswa!.id_siswa)
          .gte("waktu_presensi", start)
          .lte("waktu_presensi", end);
        const sudahPresensiIds = new Set(presensiData?.map(p => p.id_jadwal) || []);
        setJadwalHariIni(prev => prev.map(j => ({
          ...j,
          sudah_presensi: sudahPresensiIds.has(j.id_jadwal)
        })));
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanningJadwalId(null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const attendanceProgress = (() => {
    const totalJadwal = jadwalHariIni.length;
    const sudahPresensi = jadwalHariIni.filter(j => j.sudah_presensi).length;
    if (totalJadwal === 0) return 0;
    return (sudahPresensi / totalJadwal * 100).toFixed(1);
  })();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#C4E2F5]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#2C5EAD] mx-auto" />
          <p className="text-[#2C5EAD] font-medium">Memuat Presensi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F7FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* HEADER - Gradasi palette */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-xl">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-2 border-white shadow-md">
                <AvatarFallback className="bg-white/30 text-white text-xl font-bold">
                  {siswa?.nama?.charAt(0) || "S"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                  <span>{greeting},</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{siswa?.nama}</h1>
                <p className="text-blue-100 text-sm">Presensi Kehadiran</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-[#2C5EAD] rounded-xl px-4 py-2 text-center shadow-md">
                <div className="text-xs text-white/90">{formatDate(currentTime)}</div>
                <div className="text-lg font-semibold text-white">{currentTime.toLocaleTimeString("id-ID")}</div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white rounded-xl h-10 w-10 shadow-md"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* PKL INFO (jika ada) */}
        {siswa?.id_pkl && siswa?.tempat_pkl && (
          <Card className="border-0 shadow-md rounded-xl bg-gradient-to-r from-[#2C5EAD]/5 to-[#1591DC]/5">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-[#1591DC]" />
              <div>
                <p className="text-xs text-gray-500">Tempat PKL</p>
                <p className="font-semibold text-gray-800">{siswa.tempat_pkl}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MAIN CARD - Form Presensi */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-xl">
                <Fingerprint className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-xl">Form Presensi</CardTitle>
                <CardDescription className="text-blue-100 text-xs sm:text-sm">
                  Lakukan presensi harian dan presensi mata pelajaran
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4 sm:space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-[#2C5EAD] p-1 rounded-xl">
                  <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-4 py-1.5 text-sm gap-2 text-white/80 data-[state=active]:text-[#2C5EAD]">
                    <Calendar className="h-4 w-4" /> Presensi Harian
                  </TabsTrigger>
                  <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-4 py-1.5 text-sm gap-2 text-white/80 data-[state=active]:text-[#2C5EAD]">
                    <QrCode className="h-4 w-4" /> Presensi Mapel
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB PRESENSI HARIAN */}
              <TabsContent value="harian" className="space-y-4 sm:space-y-6">
                <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                  {/* Card Masuk */}
                  <Card className="rounded-xl border-0 shadow-md overflow-hidden relative">
                    <CardHeader className="pb-2 p-4 sm:p-5">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-100 p-1.5 sm:p-2 rounded-xl">
                          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                        </div>
                        <CardTitle className="text-sm sm:text-lg">Presensi Masuk</CardTitle>
                      </div>
                      <CardDescription className="text-xs sm:text-sm">Jam masuk sekolah / PKL</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5 pt-0">
                      {todayPresensi.masuk ? (
                        <div className="space-y-3">
                          <div className="bg-emerald-50 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                            <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600" />
                            <div>
                              <p className="font-semibold text-emerald-800 text-sm sm:text-base">Sudah Presensi</p>
                              <p className="text-xs sm:text-sm text-emerald-600">
                                {new Date(todayPresensi.masuk.waktu_presensi).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {todayPresensi.masuk.ekspresi && (
                                <p className="text-xs text-emerald-600 mt-1 capitalize">Ekspresi: {todayPresensi.masuk.ekspresi}</p>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 rounded-full text-xs">
                            Status: {todayPresensi.masuk.status_presensi}
                          </Badge>
                        </div>
                      ) : (
                        <Button
                          onClick={handleMasuk}
                          disabled={isSubmitting}
                          className="w-full rounded-xl bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-sm sm:text-base h-9 sm:h-10"
                        >
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                          Scan Wajah & Presensi Masuk
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card Pulang */}
                  <Card className="rounded-xl border-0 shadow-md overflow-hidden relative">
                    <CardHeader className="pb-2 p-4 sm:p-5">
                      <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-1.5 sm:p-2 rounded-xl">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                        </div>
                        <CardTitle className="text-sm sm:text-lg">Presensi Pulang</CardTitle>
                      </div>
                      <CardDescription className="text-xs sm:text-sm">Jam pulang sekolah / PKL</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5 pt-0">
                      {todayPresensi.pulang ? (
                        <div className="bg-orange-50 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                          <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
                          <div>
                            <p className="font-semibold text-orange-800 text-sm sm:text-base">Sudah Presensi</p>
                            <p className="text-xs sm:text-sm text-orange-600">
                              {new Date(todayPresensi.pulang.waktu_presensi).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {todayPresensi.pulang.ekspresi && (
                              <p className="text-xs text-orange-600 mt-1 capitalize">Ekspresi: {todayPresensi.pulang.ekspresi}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={handlePulang}
                          disabled={isSubmitting || !todayPresensi.masuk}
                          variant="outline"
                          className="w-full rounded-xl text-sm sm:text-base h-9 sm:h-10 border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"
                        >
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                          Scan Wajah & Presensi Pulang
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Location Status Alert */}
                {locationStatus && (
                  <Alert className={`rounded-xl border ${locationStatus.verified ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <div className="flex items-start gap-3">
                      {locationStatus.verified ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
                      <AlertDescription className={locationStatus.verified ? 'text-emerald-700' : 'text-rose-700'}>
                        {locationStatus.message}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

                {/* Tips */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-1.5 sm:p-2 rounded-xl">
                      <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm sm:text-base">Tips Presensi Wajah</p>
                      <p className="text-xs sm:text-sm text-slate-600">
                        Pastikan GPS aktif dan Anda berada di lokasi sekolah/PKL. Kamera hanya dapat diakses jika lokasi valid.
                        Hadapkan wajah dengan jelas ke kamera, lalu tekan tombol <strong>"Deteksi Ekspresi"</strong>.
                        Ekspresi yang terdeteksi (senang, netral, dll) akan disimpan sebagai bukti presensi.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB PRESENSI MAPEL */}
              <TabsContent value="mapel" className="space-y-4 sm:space-y-6">
                {isLoadingJadwal ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#2C5EAD]" />
                  </div>
                ) : jadwalHariIni.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-slate-100 rounded-full w-16 h-16 sm:w-20 sm:h-20 mx-auto flex items-center justify-center mb-4">
                      <Calendar className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium text-sm sm:text-base">Tidak ada jadwal mata pelajaran untuk hari ini</p>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">Selamat beristirahat! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-5">
                    <div className="bg-slate-50 rounded-xl p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
                          <span className="font-medium text-slate-700 text-sm sm:text-base">Progress Presensi Hari Ini</span>
                        </div>
                        <span className="text-xl sm:text-2xl font-bold text-[#2C5EAD]">{attendanceProgress}%</span>
                      </div>
                      <Progress value={parseFloat(attendanceProgress as string)} className="h-2 [&>div]:bg-[#1591DC]" />
                      <p className="text-xs text-slate-500 mt-2">
                        {jadwalHariIni.filter(j => j.sudah_presensi).length} dari {jadwalHariIni.length} mata pelajaran sudah dipresensi
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <School className="h-4 w-4 sm:h-5 sm:w-5 text-[#1591DC]" />
                        Jadwal Mata Pelajaran Hari Ini:
                      </h3>
                      <div className="grid gap-4">
                        {jadwalHariIni.map((jadwal, index) => (
                          <Card key={jadwal.id_jadwal} className="rounded-xl border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group relative">
                            <div className={`absolute top-0 left-0 w-1 h-full ${jadwal.sudah_presensi ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <CardContent className="pt-4 pb-4 sm:pt-5 sm:pb-5 pl-5 sm:pl-6">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={`rounded-full ${jadwal.sudah_presensi ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-0 text-[10px] sm:text-xs px-2 py-0 sm:px-3 sm:py-1`}>
                                      {jadwal.sudah_presensi ? "✓ Selesai" : "⏳ Belum"}
                                    </Badge>
                                    <span className="text-[10px] sm:text-xs text-slate-400">#{index + 1}</span>
                                  </div>
                                  <h4 className="font-bold text-slate-800 text-base sm:text-lg">{jadwal.mata_pelajaran}</h4>
                                  <div className="flex flex-wrap gap-3 mt-2">
                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500">
                                      <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                      {jadwal.jam}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500">
                                      <User className="h-3 w-3 sm:h-4 sm:w-4" />
                                      {jadwal.guru}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  {jadwal.sudah_presensi ? (
                                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl">
                                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                                      <span className="text-emerald-700 font-medium text-xs sm:text-sm">Sudah Presensi</span>
                                    </div>
                                  ) : scanningJadwalId === jadwal.id_jadwal ? (
                                    <div className="space-y-3">
                                      <div id={scannerContainerId} className="w-64 sm:w-72 rounded-xl overflow-hidden"></div>
                                      <Button onClick={stopScanner} variant="outline" size="sm" className="rounded-xl w-full text-xs sm:text-sm">
                                        Batal Scan
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      onClick={() => startScanner(jadwal.id_jadwal)}
                                      className="rounded-xl bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-xs sm:text-sm h-9 sm:h-10"
                                    >
                                      <QrCode className="mr-2 h-4 w-4" /> Scan QR Code
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-100 p-1.5 sm:p-2 rounded-xl">
                          <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm sm:text-base">Informasi QR Code Dinamis</p>
                          <p className="text-xs sm:text-sm text-slate-600">
                            QR Code yang ditampilkan guru berubah setiap <strong>30 detik</strong> dan hanya berlaku <strong>30 detik</strong>.
                            QR hanya dapat dipakai <strong>sekali</strong> untuk presensi. Pastikan Anda scan sebelum QR habis masa berlaku.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-3 sm:pt-4">
          <Separator className="mb-3 sm:mb-4" />
          <p className="text-[10px] sm:text-xs text-slate-400">
            © {new Date().getFullYear()} Sistem Presensi - SmartAS
          </p>
          <p className="text-[8px] sm:text-[10px] text-slate-300 mt-1">
            Gunakan fitur presensi dengan bijak
          </p>
        </div>
      </div>

      {/* MODAL SCAN WAJAH */}
      <FaceCaptureModal
        isOpen={showFaceModal}
        onClose={() => {
          setShowFaceModal(false);
          setPendingPresensiData(null);
          setIsSubmitting(false);
        }}
        onCapture={handleFaceCaptured}
        isLoading={isSubmitting}
      />
    </div>
  );
}