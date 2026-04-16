import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  RefreshCw,
  Calendar,
  BookOpen,
  QrCode,
  Download,
  Sun,
  Moon,
  Cloud,
  Users,
  School,
  GraduationCap,
  UserCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import QRCode from "qrcode";


// Tipe data
interface Siswa {
  id_siswa: number;
  nama: string;
  nis: string;
  id_kelas: number;
  kelas_nama: string;
  id_pkl: number | null;
}

interface PresensiHarian {
  id_pres_harian: number;
  id_siswa: number;
  status_presensi: string;
  waktu_presensi: string;
  siswa?: Siswa;
}

interface Jadwal {
  id_jadwal: number;
  hari: string;
  jam: string;
  mata_pelajaran: string;
  guru: string;
  id_kelas: number;
  kelas_nama: string;
}

interface PresensiMapel {
  id_pre_siswa: number;
  id_siswa: number;
  id_jadwal: number;
  status: string;
  waktu_presensi: string;
  siswa?: Siswa;
}

// Konstanta status
const STATUS_HARIAN_SEKOLAH = ["Hadir", "Terlambat", "Izin", "Sakit", "Alfa"];
const STATUS_HARIAN_PKL = ["Hadir", "Izin", "Sakit", "Alfa"];
const STATUS_MAPEL = ["Hadir", "Izin", "Sakit", "Alfa"];

// Helper: konversi string jam "HH:MM - HH:MM" ke menit
const parseTimeRange = (jamStr: string) => {
  const [start, end] = jamStr.split(" - ");
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return { startMin: toMinutes(start), endMin: toMinutes(end) };
};

export default function AttendanceManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);

  // State presensi harian
  const [kelasList, setKelasList] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedTanggal, setSelectedTanggal] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [presensiHarian, setPresensiHarian] = useState<PresensiHarian[]>([]);
  const [isFetchingHarian, setIsFetchingHarian] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<{ id: number; type: string } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [selectedBulkStatus, setSelectedBulkStatus] = useState<string | null>(null);

  // State presensi mapel
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [selectedKelasMapel, setSelectedKelasMapel] = useState<string>("");
  const [filteredJadwalList, setFilteredJadwalList] = useState<Jadwal[]>([]);
  const [selectedJadwal, setSelectedJadwal] = useState<string>("");
  const [presensiMapel, setPresensiMapel] = useState<PresensiMapel[]>([]);
  const [isFetchingMapel, setIsFetchingMapel] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [selectedJadwalForQR, setSelectedJadwalForQR] = useState<Jadwal | null>(null);
  const [isBulkUpdatingMapel, setIsBulkUpdatingMapel] = useState(false);
  const [selectedBulkStatusMapel, setSelectedBulkStatusMapel] = useState<string | null>(null);

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== FORMAT DATE ====================
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // ==================== FETCH KELAS ====================
  const fetchKelas = async () => {
    const { data, error } = await supabase
      .from("kelas")
      .select("id_kelas, nama")
      .eq("aktif", true)
      .order("nama");
    if (error) console.error(error);
    else setKelasList(data || []);
  };

  // ==================== FETCH JADWAL ====================
  const fetchJadwal = async () => {
    if (!user) return;
    try {
      let query = supabase
        .from("jadwal")
        .select(`
          id_jadwal,
          hari,
          jam,
          id_kelas,
          kelas:kelas (nama),
          mapel:mata_pelajaran (nama),
          guru:guru (nama)
        `)
        .eq("aktif", true);
      if (user.peran === "guru" && user.id_guru) {
        query = query.eq("id_guru", user.id_guru);
      }
      const { data, error } = await query.order("hari").order("jam");
      if (error) throw error;
      const formatted: Jadwal[] = data.map((item: any) => ({
        id_jadwal: item.id_jadwal,
        hari: item.hari,
        jam: item.jam,
        mata_pelajaran: item.mapel?.nama || "-",
        guru: item.guru?.nama || "-",
        id_kelas: item.id_kelas,
        kelas_nama: item.kelas?.nama || "-",
      }));
      setJadwalList(formatted);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ==================== FILTER JADWAL BERDASARKAN KELAS ====================
  useEffect(() => {
    if (selectedKelasMapel && selectedKelasMapel !== "all") {
      const filtered = jadwalList.filter(j => j.id_kelas.toString() === selectedKelasMapel);
      setFilteredJadwalList(filtered);
      setSelectedJadwal(""); // Reset pilihan jadwal saat kelas berubah
    } else {
      setFilteredJadwalList([]);
      setSelectedJadwal("");
    }
  }, [selectedKelasMapel, jadwalList]);

  // ==================== FETCH PRESENSI HARIAN ====================
  const fetchPresensiHarian = async () => {
    if (!selectedKelas) return;
    setIsFetchingHarian(true);
    setSelectedBulkStatus(null);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, id_pkl, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const siswaList: Siswa[] = siswaData.map((s: any) => ({
        id_siswa: s.id_siswa,
        nama: s.nama,
        nis: s.nis?.toString() || "",
        id_kelas: s.id_kelas,
        kelas_nama: s.kelas?.nama || "-",
        id_pkl: s.id_pkl,
      }));

      const startDate = `${selectedTanggal}T00:00:00`;
      const endDate = `${selectedTanggal}T23:59:59`;
      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_harian")
        .select("*")
        .gte("waktu_presensi", startDate)
        .lte("waktu_presensi", endDate);
      if (presensiError) throw presensiError;

      const combined = siswaList.map((siswa) => {
        const existing = presensiData?.find((p) => p.id_siswa === siswa.id_siswa);
        return {
          id_pres_harian: existing?.id_pres_harian || null,
          id_siswa: siswa.id_siswa,
          status_presensi: existing?.status_presensi || null,
          waktu_presensi: existing?.waktu_presensi || null,
          siswa: siswa,
        };
      });
      setPresensiHarian(combined);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingHarian(false);
    }
  };

  // ==================== UPDATE PRESENSI HARIAN (SINGLE) ====================
  const updatePresensiHarian = async (siswaId: number, currentAttendance: any, newStatus: string) => {
    setUpdatingStatus({ id: siswaId, type: "harian" });
    try {
      if (currentAttendance.id_pres_harian) {
        const { error } = await supabase
          .from("presensi_harian")
          .update({ status_presensi: newStatus, waktu_presensi: new Date().toISOString() })
          .eq("id_pres_harian", currentAttendance.id_pres_harian);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("presensi_harian").insert({
          id_siswa: siswaId,
          status_presensi: newStatus,
          waktu_presensi: new Date().toISOString(),
        });
        if (error) throw error;
      }
      setPresensiHarian(prev =>
        prev.map(item =>
          item.id_siswa === siswaId
            ? { ...item, status_presensi: newStatus, waktu_presensi: new Date().toISOString() }
            : item
        )
      );
      toast({ title: "Berhasil", description: "Status presensi diperbarui" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ==================== BULK UPDATE PRESENSI HARIAN (CHECKBOX) ====================
  const handleBulkCheckbox = async (status: string) => {
    if (selectedBulkStatus === status) return;
    
    setSelectedBulkStatus(status);
    setIsBulkUpdating(true);
    try {
      for (const item of presensiHarian) {
        const isPKL = item.siswa?.id_pkl !== null;
        const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
        if (availableStatus.includes(status)) {
          if (item.id_pres_harian) {
            await supabase
              .from("presensi_harian")
              .update({ status_presensi: status, waktu_presensi: new Date().toISOString() })
              .eq("id_pres_harian", item.id_pres_harian);
          } else {
            await supabase.from("presensi_harian").insert({
              id_siswa: item.id_siswa,
              status_presensi: status,
              waktu_presensi: new Date().toISOString(),
            });
          }
        }
      }
      
      setPresensiHarian(prev =>
        prev.map(item => {
          const isPKL = item.siswa?.id_pkl !== null;
          const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
          if (availableStatus.includes(status)) {
            return { ...item, status_presensi: status, waktu_presensi: new Date().toISOString() };
          }
          return item;
        })
      );
      
      toast({ title: "Berhasil", description: `Semua siswa telah diubah menjadi ${status}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // ==================== FETCH PRESENSI MAPEL ====================
  const fetchPresensiMapel = async () => {
    if (!selectedJadwal) return;
    setIsFetchingMapel(true);
    setSelectedBulkStatusMapel(null);
    try {
      const jadwal = filteredJadwalList.find((j) => j.id_jadwal.toString() === selectedJadwal);
      if (!jadwal) return;

      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, kelas:kelas(nama)")
        .eq("id_kelas", jadwal.id_kelas)
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const siswaList: Siswa[] = siswaData.map((s: any) => ({
        id_siswa: s.id_siswa,
        nama: s.nama,
        nis: s.nis?.toString() || "",
        id_kelas: s.id_kelas,
        kelas_nama: s.kelas?.nama || "-",
        id_pkl: null,
      }));

      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_siswa_mapel")
        .select("*")
        .eq("id_jadwal", parseInt(selectedJadwal));
      if (presensiError) throw presensiError;

      const combined = siswaList.map((siswa) => {
        const existing = presensiData?.find((p) => p.id_siswa === siswa.id_siswa);
        return {
          id_pre_siswa: existing?.id_pre_siswa || null,
          id_siswa: siswa.id_siswa,
          id_jadwal: parseInt(selectedJadwal),
          status: existing?.status || null,
          waktu_presensi: existing?.waktu_presensi || null,
          siswa: siswa,
        };
      });
      setPresensiMapel(combined);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingMapel(false);
    }
  };

  // ==================== UPDATE PRESENSI MAPEL (SINGLE) ====================
  const updatePresensiMapel = async (siswaId: number, currentAttendance: any, newStatus: string) => {
    setUpdatingStatus({ id: siswaId, type: "mapel" });
    try {
      if (currentAttendance.id_pre_siswa) {
        const { error } = await supabase
          .from("presensi_siswa_mapel")
          .update({ status: newStatus, waktu_presensi: new Date().toISOString() })
          .eq("id_pre_siswa", currentAttendance.id_pre_siswa);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("presensi_siswa_mapel").insert({
          id_siswa: siswaId,
          id_jadwal: currentAttendance.id_jadwal,
          status: newStatus,
          waktu_presensi: new Date().toISOString(),
        });
        if (error) throw error;
      }
      setPresensiMapel(prev =>
        prev.map(item =>
          item.id_siswa === siswaId
            ? { ...item, status: newStatus, waktu_presensi: new Date().toISOString() }
            : item
        )
      );
      toast({ title: "Berhasil", description: "Status presensi diperbarui" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // ==================== BULK UPDATE MAPEL (CHECKBOX) ====================
  const handleBulkCheckboxMapel = async (status: string) => {
    if (selectedBulkStatusMapel === status) return;
    
    setSelectedBulkStatusMapel(status);
    setIsBulkUpdatingMapel(true);
    try {
      for (const item of presensiMapel) {
        if (item.id_pre_siswa) {
          await supabase
            .from("presensi_siswa_mapel")
            .update({ status: status, waktu_presensi: new Date().toISOString() })
            .eq("id_pre_siswa", item.id_pre_siswa);
        } else {
          await supabase.from("presensi_siswa_mapel").insert({
            id_siswa: item.id_siswa,
            id_jadwal: item.id_jadwal,
            status: status,
            waktu_presensi: new Date().toISOString(),
          });
        }
      }
      
      setPresensiMapel(prev =>
        prev.map(item => ({
          ...item,
          status: status,
          waktu_presensi: new Date().toISOString()
        }))
      );
      
      toast({ title: "Berhasil", description: `Semua siswa telah diubah menjadi ${status}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdatingMapel(false);
    }
  };

  // ==================== GENERATE QR ====================
  const generateQRCode = async (jadwal: Jadwal) => {
    const daysMap: Record<string, number> = {
      Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 0
    };
    const now = new Date();
    const currentDay = now.getDay();
    const expectedDay = daysMap[jadwal.hari];
    if (currentDay !== expectedDay) {
      toast({
        title: "Tidak dapat generate QR",
        description: `QR Code hanya dapat digenerate pada hari ${jadwal.hari} (hari ini ${now.toLocaleDateString('id-ID', { weekday: 'long' })})`,
        variant: "destructive",
      });
      return;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const { startMin, endMin } = parseTimeRange(jadwal.jam);
    const tolerance = 15;
    if (currentMinutes < startMin - tolerance) {
      toast({
        title: "Terlalu awal",
        description: `QR Code dapat digenerate mulai ${tolerance} menit sebelum jadwal dimulai (${jadwal.jam})`,
        variant: "destructive",
      });
      return;
    }
    if (currentMinutes > endMin + tolerance) {
      toast({
        title: "Waktu habis",
        description: `QR Code tidak dapat digenerate lagi karena sudah melewati ${tolerance} menit setelah jadwal berakhir (${jadwal.jam})`,
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingQR(true);
    setSelectedJadwalForQR(jadwal);
    try {
      const payload = { id_jadwal: jadwal.id_jadwal, timestamp: Date.now() };
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));
      setQrCodeDataUrl(qrDataUrl);
      setQrDialogOpen(true);
    } catch (error) {
      toast({ title: "Error", description: "Gagal generate QR Code", variant: "destructive" });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // ==================== INITIAL FETCH ====================
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchKelas(), fetchJadwal()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === "harian" && selectedKelas) fetchPresensiHarian();
  }, [selectedKelas, selectedTanggal, activeTab]);

  useEffect(() => {
    if (activeTab === "mapel" && selectedJadwal) fetchPresensiMapel();
  }, [selectedJadwal, activeTab]);

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500">Memuat Manajemen Presensi...</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <Calendar className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Manajemen Presensi</h1>
                <p className="text-blue-100 text-sm">
                  Kelola presensi harian dan presensi mata pelajaran siswa
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Kelas</p>
                  <p className="text-2xl font-bold text-blue-900">{kelasList.length}</p>
                </div>
                <School className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Total Jadwal</p>
                  <p className="text-2xl font-bold text-emerald-900">{jadwalList.length}</p>
                </div>
                <BookOpen className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Status</p>
                  <p className="text-xl font-bold text-purple-900">Aktif</p>
                </div>
                <UserCheck className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Role</p>
                  <p className="text-xl font-bold text-amber-900">{user?.peran === "guru" ? "Guru" : "Admin"}</p>
                </div>
                <GraduationCap className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN TABS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Manajemen Presensi</CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  Kelola presensi harian dan presensi mata pelajaran siswa
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-5">
              {/* TABS LIST */}
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    Presensi Harian
                  </TabsTrigger>
                  <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <BookOpen className="h-3.5 w-3.5" />
                    Presensi Mapel
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB PRESENSI HARIAN */}
              <TabsContent value="harian" className="space-y-5">
                {/* FILTER FORM - RATA KIRI */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-56">
                    <Label className="text-slate-700 text-sm font-medium">Kelas</Label>
                    <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                      <SelectTrigger className="rounded-lg border-slate-200 h-9 text-sm">
                        <SelectValue placeholder="Pilih Kelas" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {kelasList.map((k) => (
                          <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>
                            {k.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label className="text-slate-700 text-sm font-medium">Tanggal</Label>
                    <Input 
                      type="date" 
                      value={selectedTanggal} 
                      onChange={(e) => setSelectedTanggal(e.target.value)}
                      className="rounded-lg border-slate-200 h-9 text-sm"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={fetchPresensiHarian} 
                    disabled={!selectedKelas || isFetchingHarian}
                    className="rounded-lg h-9 px-3 text-sm"
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingHarian ? "animate-spin" : ""}`} /> 
                    Refresh
                  </Button>
                </div>

                {!selectedKelas && (
                  <Alert className="rounded-lg bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-sm">
                      Silakan pilih kelas ter dahulu
                    </AlertDescription>
                  </Alert>
                )}

                {selectedKelas && (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold text-center text-sm w-24">NIS</TableHead>
                            <TableHead className="font-semibold text-center text-sm min-w-[140px]">Nama Siswa</TableHead>
                            <TableHead className="font-semibold text-center text-sm w-28">Status PKL</TableHead>
                            {STATUS_HARIAN_SEKOLAH.map(status => (
                              <TableHead key={status} className="text-center font-semibold text-sm min-w-[80px]">
                                <div className="flex flex-col items-center gap-1">
                                  <span>{status}</span>
                                  <Checkbox
                                    checked={selectedBulkStatus === status}
                                    onCheckedChange={() => handleBulkCheckbox(status)}
                                    disabled={isBulkUpdating}
                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 h-4 w-4"
                                  />
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isFetchingHarian ? (
                            <TableRow>
                              <TableCell colSpan={3 + STATUS_HARIAN_SEKOLAH.length} className="text-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                              </TableCell>
                            </TableRow>
                          ) : presensiHarian.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3 + STATUS_HARIAN_SEKOLAH.length} className="text-center py-10 text-slate-500">
                                Tidak ada data siswa
                              </TableCell>
                            </TableRow>
                          ) : (
                            presensiHarian.map((item) => {
                              const isPKL = item.siswa?.id_pkl !== null;
                              const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
                              return (
                                <TableRow key={item.id_siswa} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="text-center font-mono text-sm">{item.siswa?.nis}</TableCell>
                                  <TableCell className="text-center text-sm font-medium">{item.siswa?.nama}</TableCell>
                                  <TableCell className="text-center">
                                    {isPKL ? (
                                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">PKL</span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Sekolah</span>
                                    )}
                                  </TableCell>
                                  {STATUS_HARIAN_SEKOLAH.map(status => {
                                    const isAvailable = availableStatus.includes(status);
                                    if (!isAvailable) {
                                      return <TableCell key={status} className="text-center bg-slate-50/30"></TableCell>;
                                    }
                                    return (
                                      <TableCell key={status} className="text-center align-middle">
                                        <div className="flex justify-center items-center">
                                          <RadioGroup
                                            value={item.status_presensi || ""}
                                            onValueChange={(val) => updatePresensiHarian(item.id_siswa, item, val)}
                                            disabled={updatingStatus?.id === item.id_siswa && updatingStatus?.type === "harian"}
                                            className="flex justify-center"
                                          >
                                            <RadioGroupItem 
                                              value={status} 
                                              id={`harian-${item.id_siswa}-${status}`}
                                              className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 h-4 w-4"
                                            />
                                          </RadioGroup>
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* TAB PRESENSI MAPEL */}
              <TabsContent value="mapel" className="space-y-5">
                {/* FILTER FORM - RATA KIRI */}
                <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
                  <div className="w-56">
                    <Label className="text-slate-700 text-sm font-medium">Pilih Kelas</Label>
                    <Select value={selectedKelasMapel} onValueChange={setSelectedKelasMapel}>
                      <SelectTrigger className="rounded-lg border-slate-200 h-9 text-sm">
                        <SelectValue placeholder="Pilih Kelas" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {kelasList.map((k) => (
                          <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>
                            {k.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-64">
                    <Label className="text-slate-700 text-sm font-medium">Pilih Jadwal</Label>
                    <Select 
                      value={selectedJadwal} 
                      onValueChange={setSelectedJadwal}
                      disabled={!selectedKelasMapel || filteredJadwalList.length === 0}
                    >
                      <SelectTrigger className="rounded-lg border-slate-200 h-9 text-sm">
                        <SelectValue placeholder={!selectedKelasMapel ? "Pilih kelas dulu" : "Pilih Jadwal"} />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        {filteredJadwalList.map((j) => (
                          <SelectItem key={j.id_jadwal} value={j.id_jadwal.toString()}>
                            {j.mata_pelajaran} ({j.hari}, {j.jam})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={fetchPresensiMapel} 
                    disabled={!selectedJadwal || isFetchingMapel}
                    className="rounded-lg h-9 px-3 text-sm"
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingMapel ? "animate-spin" : ""}`} /> 
                    Refresh
                  </Button>
                  {selectedJadwal && (
                    <Button 
                      variant="default" 
                      onClick={() => {
                        const jadwal = filteredJadwalList.find(j => j.id_jadwal.toString() === selectedJadwal);
                        if (jadwal) generateQRCode(jadwal);
                      }} 
                      disabled={isGeneratingQR}
                      className="rounded-lg h-9 px-3 text-sm bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      <QrCode className="mr-1.5 h-3.5 w-3.5" /> 
                      {isGeneratingQR ? "Generating..." : "Generate QR"}
                    </Button>
                  )}
                </div>

                {!selectedKelasMapel && (
                  <Alert className="rounded-lg bg-amber-50 border-amber-200">
                    <School className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-sm">
                      Silakan pilih kelas terlebih dahulu
                    </AlertDescription>
                  </Alert>
                )}

                {selectedKelasMapel && filteredJadwalList.length === 0 && (
                  <Alert className="rounded-lg bg-amber-50 border-amber-200">
                    <BookOpen className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-sm">
                      Tidak ada jadwal untuk kelas yang dipilih
                    </AlertDescription>
                  </Alert>
                )}

                {selectedJadwal && (
                  <div className="border rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold text-center text-sm w-24">NIS</TableHead>
                            <TableHead className="font-semibold text-center text-sm min-w-[140px]">Nama Siswa</TableHead>
                            {STATUS_MAPEL.map(status => (
                              <TableHead key={status} className="text-center font-semibold text-sm min-w-[80px]">
                                <div className="flex flex-col items-center gap-1">
                                  <span>{status}</span>
                                  <Checkbox
                                    checked={selectedBulkStatusMapel === status}
                                    onCheckedChange={() => handleBulkCheckboxMapel(status)}
                                    disabled={isBulkUpdatingMapel}
                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 h-4 w-4"
                                  />
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isFetchingMapel ? (
                            <TableRow>
                              <TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                              </TableCell>
                            </TableRow>
                          ) : presensiMapel.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center py-10 text-slate-500">
                                Tidak ada data siswa
                              </TableCell>
                            </TableRow>
                          ) : (
                            presensiMapel.map((item) => (
                              <TableRow key={item.id_siswa} className="hover:bg-slate-50 transition-colors">
                                <TableCell className="text-center font-mono text-sm">{item.siswa?.nis}</TableCell>
                                <TableCell className="text-center text-sm font-medium">{item.siswa?.nama}</TableCell>
                                {STATUS_MAPEL.map(status => (
                                  <TableCell key={status} className="text-center align-middle">
                                    <div className="flex justify-center items-center">
                                      <RadioGroup
                                        value={item.status || ""}
                                        onValueChange={(val) => updatePresensiMapel(item.id_siswa, item, val)}
                                        disabled={updatingStatus?.id === item.id_siswa && updatingStatus?.type === "mapel"}
                                        className="flex justify-center"
                                      >
                                        <RadioGroupItem 
                                          value={status} 
                                          id={`mapel-${item.id_siswa}-${status}`}
                                          className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 h-4 w-4"
                                        />
                                      </RadioGroup>
                                    </div>
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        <Card className="rounded-xl border-0 shadow-md bg-gradient-to-br from-indigo-50 to-purple-50 max-w-2xl mx-auto">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="bg-indigo-100 p-2 rounded-lg flex-shrink-0">
                <Sparkles className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm mb-0.5">Tips Mengelola Presensi</h3>
                <p className="text-xs text-slate-600">
                  Centang checkbox di bawah setiap status untuk mengabsen semua siswa sekaligus (hanya satu status yang bisa dipilih). 
                  Radio button di samping nama siswa untuk mengubah status satu per satu.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-3">
          <hr className="mb-3 border-slate-200" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Manajemen Presensi - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            Sistem Informasi Akademik
          </p>
        </div>
      </div>

      {/* DIALOG QR CODE */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              QR Code Presensi
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-3 py-3">
            {qrCodeDataUrl && (
              <div className="bg-white p-3 rounded-xl shadow-md">
                <img src={qrCodeDataUrl} alt="QR Code" className="w-56 h-56" />
              </div>
            )}
            <div className="text-center space-y-0.5">
              <p className="font-semibold text-slate-800 text-sm">
                {selectedJadwalForQR?.kelas_nama} - {selectedJadwalForQR?.mata_pelajaran}
              </p>
              <p className="text-xs text-slate-500">
                Hari: {selectedJadwalForQR?.hari}, Jam: {selectedJadwalForQR?.jam}
              </p>
              <p className="text-[11px] text-amber-600 mt-1">
                ⚠️ QR Code hanya valid 15 menit sebelum hingga 45 menit setelah jadwal dimulai
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                const link = document.createElement("a");
                link.download = `qr_${selectedJadwalForQR?.id_jadwal}.png`;
                link.href = qrCodeDataUrl;
                link.click();
              }}
              className="rounded-lg h-9 text-sm"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download QR Code
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)} className="rounded-lg h-9 text-sm">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}