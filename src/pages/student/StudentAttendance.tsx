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
  ThumbsUp
} from "lucide-react";

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
  
  // Presensi mapel
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalHariIni[]>([]);
  const [scanningJadwalId, setScanningJadwalId] = useState<number | null>(null);
  const [isLoadingJadwal, setIsLoadingJadwal] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "qr-reader";

  // Koordinat sekolah
  const SCHOOL_COORD = { lat: -7.316156236652295, lng: 112.72532308933857 };

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
          const { latitude, longitude } = position.coords;
          
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
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(latitude * Math.PI/180) * Math.cos(targetCoord.lat * Math.PI/180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
        }
      );
    });
  };

  // ==================== HANDLE MASUK ====================
  const handleMasuk = async () => {
    setIsSubmitting(true);
    setLocationStatus(null);
    try {
      const { valid, message } = await validateLocation();
      if (!valid) {
        setLocationStatus({ verified: false, message });
        toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
        return;
      }
      setLocationStatus({ verified: true, message });
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const batasTerlambat = 7 * 60 + 30;
      const currentMinutes = currentHour * 60 + currentMinute;
      const status = currentMinutes <= batasTerlambat ? "Hadir" : "Terlambat";
      
      const { error } = await supabase.from("presensi_harian").insert({
        id_siswa: siswa!.id_siswa,
        status_presensi: status,
        waktu_presensi: now.toISOString(),
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: `✅ Presensi ${status} tercatat` });
      
      const today = new Date().toISOString().split("T")[0];
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data } = await supabase
        .from("presensi_harian")
        .select("*")
        .eq("id_siswa", siswa!.id_siswa)
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      const masuk = data?.find(p => p.status_presensi === "Hadir" || p.status_presensi === "Terlambat");
      const pulang = data?.find(p => p.status_presensi === "Pulang");
      setTodayPresensi({ masuk, pulang });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== HANDLE PULANG ====================
  const handlePulang = async () => {
    if (!todayPresensi.masuk) {
      toast({ title: "Belum masuk", description: "Silakan presensi masuk terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setLocationStatus(null);
    try {
      const { valid, message } = await validateLocation();
      if (!valid) {
        setLocationStatus({ verified: false, message });
        toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
        return;
      }
      setLocationStatus({ verified: true, message });
      
      const { error } = await supabase.from("presensi_harian").insert({
        id_siswa: siswa!.id_siswa,
        status_presensi: "Pulang",
        waktu_presensi: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: "✅ Presensi pulang tercatat" });
      
      const today = new Date().toISOString().split("T")[0];
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data } = await supabase
        .from("presensi_harian")
        .select("*")
        .eq("id_siswa", siswa!.id_siswa)
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      const masuk = data?.find(p => p.status_presensi === "Hadir" || p.status_presensi === "Terlambat");
      const pulang = data?.find(p => p.status_presensi === "Pulang");
      setTodayPresensi({ masuk, pulang });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
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
      const { id_jadwal, timestamp } = payload;
      if (!id_jadwal) {
        toast({ title: "QR tidak valid", description: "QR Code tidak dikenali", variant: "destructive" });
        return;
      }
      if (timestamp && Date.now() - timestamp > 60 * 60 * 1000) {
        toast({ title: "QR kadaluarsa", description: "QR Code sudah kadaluarsa", variant: "destructive" });
        return;
      }
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

  // Calculate attendance percentage for today
  const attendanceProgress = (() => {
    const totalJadwal = jadwalHariIni.length;
    const sudahPresensi = jadwalHariIni.filter(j => j.sudah_presensi).length;
    if (totalJadwal === 0) return 0;
    return (sudahPresensi / totalJadwal * 100).toFixed(1);
  })();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500">Memuat Presensi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 overflow-x-hidden">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-white/30 rounded-2xl">
                <AvatarFallback className="bg-white/20 text-white text-xl font-bold rounded-2xl">
                  {siswa?.nama?.charAt(0) || "S"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Presensi Siswa</h1>
                <p className="text-blue-100 text-sm">
                  {siswa?.nama} • {siswa?.nis}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* INFO CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">NIS</p>
                  <p className="text-lg font-bold text-blue-900">{siswa?.nis}</p>
                </div>
                <User className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Status</p>
                  <p className="text-lg font-bold text-emerald-900">
                    {siswa?.id_pkl ? "PKL" : "Sekolah"}
                  </p>
                </div>
                {siswa?.id_pkl ? <Briefcase className="h-8 w-8 text-emerald-500" /> : <School className="h-8 w-8 text-emerald-500" />}
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Presensi Masuk</p>
                  <p className="text-lg font-bold text-amber-900">
                    {todayPresensi.masuk ? "Sudah" : "Belum"}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Progress Mapel</p>
                  <p className="text-lg font-bold text-purple-900">{attendanceProgress}%</p>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PKL INFO */}
        {siswa?.id_pkl && siswa?.tempat_pkl && (
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Briefcase className="h-8 w-8" />
                <div>
                  <p className="text-sm opacity-90">Tempat PKL</p>
                  <p className="font-semibold">{siswa.tempat_pkl}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MAIN TABS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl">
                <Fingerprint className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Form Presensi</CardTitle>
                <CardDescription className="text-slate-300 text-sm">
                  Lakukan presensi harian dan presensi mata pelajaran
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
              <TabsList className="bg-slate-100 p-1 rounded-xl w-full max-w-md">
                <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Presensi Harian
                </TabsTrigger>
                <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Presensi Mapel
                </TabsTrigger>
              </TabsList>

              {/* TAB PRESENSI HARIAN */}
              <TabsContent value="harian" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Card Masuk */}
                  <Card className="rounded-xl border-0 shadow-md overflow-hidden relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                          <Calendar className="h-5 w-5 text-emerald-600" />
                        </div>
                        <CardTitle className="text-lg">Presensi Masuk</CardTitle>
                      </div>
                      <CardDescription>Jam masuk sekolah / PKL</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {todayPresensi.masuk ? (
                        <div className="space-y-3">
                          <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
                            <CheckCircle className="h-8 w-8 text-emerald-600" />
                            <div>
                              <p className="font-semibold text-emerald-800">Sudah Presensi</p>
                              <p className="text-sm text-emerald-600">
                                {new Date(todayPresensi.masuk.waktu_presensi).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-700 rounded-full">
                            Status: {todayPresensi.masuk.status_presensi}
                          </Badge>
                        </div>
                      ) : (
                        <Button 
                          onClick={handleMasuk} 
                          disabled={isSubmitting} 
                          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                        >
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                          Presensi Masuk Sekarang
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card Pulang */}
                  <Card className="rounded-xl border-0 shadow-md overflow-hidden relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-2 rounded-xl">
                          <Clock className="h-5 w-5 text-orange-600" />
                        </div>
                        <CardTitle className="text-lg">Presensi Pulang</CardTitle>
                      </div>
                      <CardDescription>Jam pulang sekolah / PKL</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {todayPresensi.pulang ? (
                        <div className="bg-orange-50 rounded-xl p-4 flex items-center gap-3">
                          <CheckCircle className="h-8 w-8 text-orange-600" />
                          <div>
                            <p className="font-semibold text-orange-800">Sudah Presensi</p>
                            <p className="text-sm text-orange-600">
                              {new Date(todayPresensi.pulang.waktu_presensi).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          onClick={handlePulang} 
                          disabled={isSubmitting || !todayPresensi.masuk} 
                          variant="outline" 
                          className="w-full rounded-xl"
                        >
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                          Presensi Pulang
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
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-xl">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Tips Presensi</p>
                      <p className="text-sm text-slate-600">
                        Pastikan GPS aktif dan Anda berada di lokasi sekolah/PKL saat melakukan presensi.
                        Batas waktu presensi masuk adalah pukul 07:30 WIB.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB PRESENSI MAPEL */}
              <TabsContent value="mapel" className="space-y-6">
                {isLoadingJadwal ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : jadwalHariIni.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-slate-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4">
                      <Calendar className="h-10 w-10 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">Tidak ada jadwal mata pelajaran untuk hari ini</p>
                    <p className="text-slate-400 text-sm mt-1">Selamat beristirahat! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Progress Section */}
                    <div className="bg-slate-50 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-slate-600" />
                          <span className="font-medium text-slate-700">Progress Presensi Hari Ini</span>
                        </div>
                        <span className="text-2xl font-bold text-blue-600">{attendanceProgress}%</span>
                      </div>
                      <Progress value={parseFloat(attendanceProgress as string)} className="h-2" />
                      <p className="text-xs text-slate-500 mt-2">
                        {jadwalHariIni.filter(j => j.sudah_presensi).length} dari {jadwalHariIni.length} mata pelajaran sudah dipresensi
                      </p>
                    </div>

                    {/* Schedule List */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <School className="h-5 w-5 text-blue-600" />
                        Jadwal Mata Pelajaran Hari Ini:
                      </h3>
                      <div className="grid gap-4">
                        {jadwalHariIni.map((jadwal, index) => (
                          <Card key={jadwal.id_jadwal} className="rounded-xl border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group relative">
                            <div className={`absolute top-0 left-0 w-1 h-full ${jadwal.sudah_presensi ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <CardContent className="pt-5 pb-5 pl-6">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={`rounded-full ${jadwal.sudah_presensi ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} border-0`}>
                                      {jadwal.sudah_presensi ? "✓ Selesai" : "⏳ Belum"}
                                    </Badge>
                                    <span className="text-xs text-slate-400">#{index + 1}</span>
                                  </div>
                                  <h4 className="font-bold text-slate-800 text-lg">{jadwal.mata_pelajaran}</h4>
                                  <div className="flex flex-wrap gap-3 mt-2">
                                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                      <Clock className="h-4 w-4" />
                                      {jadwal.jam}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                      <User className="h-4 w-4" />
                                      {jadwal.guru}
                                    </div>
                                  </div>
                                </div>
                                
                                <div>
                                  {jadwal.sudah_presensi ? (
                                    <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl">
                                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                                      <span className="text-emerald-700 font-medium">Sudah Presensi</span>
                                    </div>
                                  ) : scanningJadwalId === jadwal.id_jadwal ? (
                                    <div className="space-y-3">
                                      <div id={scannerContainerId} className="w-72 rounded-xl overflow-hidden"></div>
                                      <Button onClick={stopScanner} variant="outline" size="sm" className="rounded-xl w-full">
                                        Batal Scan
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button 
                                      onClick={() => startScanner(jadwal.id_jadwal)} 
                                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
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

                    {/* QR Info */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-100 p-2 rounded-xl">
                          <Shield className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">Informasi QR Code</p>
                          <p className="text-sm text-slate-600">
                            Scan QR Code yang ditampilkan oleh guru. QR Code hanya valid 1 jam dan dapat digunakan 
                            15 menit sebelum hingga 45 menit setelah jadwal dimulai.
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
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Sistem Presensi - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Gunakan fitur presensi dengan bijak
          </p>
        </div>
      </div>
    </div>
  );
}