import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  School,
  BookOpen,
  UserCheck,
  Loader2,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  GraduationCap,
  Heart,
  FileText,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface PresensiHarian {
  tanggal: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // === STATS ===
  const [stats, setStats] = useState({
    siswa: 0,
    guru: 0,
    kelas: 0,
    mapel: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // === PRESENSI ===
  const [presensiData, setPresensiData] = useState<PresensiHarian[]>([]);
  const [summaryPresensi, setSummaryPresensi] = useState({
    hadir: 0,
    terlambat: 0,
    izin: 0,
    sakit: 0,
    alfa: 0,
  });
  const [periode, setPeriode] = useState<"minggu" | "bulan">("minggu");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  // === PIE CHART FILTER ===
  const [selectedCategories, setSelectedCategories] = useState({
    hadir: true,
    terlambat: true,
    izin: true,
    sakit: true,
    alfa: true,
  });

  // === MONITORING ===
  const [monitoringData, setMonitoringData] = useState<{
    kelasTanpaPresensi: { id_kelas: number; nama: string; jurusan: string }[];
    mapelTanpaPresensi: { kelas: string; mapel: string; guru: string; jam: string }[];
  }>({ kelasTanpaPresensi: [], mapelTanpaPresensi: [] });
  const [loadingMonitoring, setLoadingMonitoring] = useState(true);

  // === FILTER TINGKAT DAN PENCARIAN UNTUK KEDUA CARD ===
  const [filterLevel, setFilterLevel] = useState<"Semua" | "X" | "XI" | "XII">("Semua");
  const [searchKelas, setSearchKelas] = useState("");

  // === [PERBAIKAN] FUNGSI PEMBANDING TINGKAT YANG TEPAT ===
  const isLevelMatch = (namaKelas: string, level: string) => {
    if (level === "Semua") return true;
    if (level === "X") {
      return namaKelas.startsWith("X") && !namaKelas.startsWith("XI") && !namaKelas.startsWith("XII");
    }
    if (level === "XI") {
      return namaKelas.startsWith("XI") && !namaKelas.startsWith("XII");
    }
    if (level === "XII") {
      return namaKelas.startsWith("XII");
    }
    return false;
  };

  // === [PERBAIKAN] FILTER UNTUK KEDUA CARD ===
  const filteredKelasTanpaPresensi = monitoringData.kelasTanpaPresensi.filter((item) => {
    const matchLevel = isLevelMatch(item.nama, filterLevel);
    const matchSearch = searchKelas === "" || item.nama.toLowerCase().includes(searchKelas.toLowerCase());
    return matchLevel && matchSearch;
  });

  const filteredMapelTanpaPresensi = monitoringData.mapelTanpaPresensi.filter((item) => {
    const matchLevel = isLevelMatch(item.kelas, filterLevel);
    const matchSearch = searchKelas === "" || item.kelas.toLowerCase().includes(searchKelas.toLowerCase());
    return matchLevel && matchSearch;
  });

  // === HELPER: FORMAT TANGGAL ===
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // === GREETING ===
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // === FETCH PRESENSI DATA ===
  const fetchPresensiData = useCallback(async () => {
    try {
      const now = new Date();
      let startDate: Date;

      if (periode === "minggu") {
        startDate = new Date(now);
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(now.getDate() - daysToMonday);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);

      const start = formatLocalDate(startDate);
      const end = formatLocalDate(endDate);

      const { data, error } = await supabase
        .from("presensi_harian")
        .select("waktu_presensi, status_presensi")
        .gte("waktu_presensi", `${start}T00:00:00`)
        .lte("waktu_presensi", `${end}T23:59:59`);

      if (error) throw error;

      const presensiMap: Record<
        string,
        { hadir: number; terlambat: number; izin: number; sakit: number; alfa: number }
      > = {};

      for (const pres of data || []) {
        const tanggal = formatLocalDate(new Date(pres.waktu_presensi));
        if (!presensiMap[tanggal]) {
          presensiMap[tanggal] = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
        }
        switch (pres.status_presensi) {
          case "Hadir":
            presensiMap[tanggal].hadir++;
            break;
          case "Terlambat":
            presensiMap[tanggal].terlambat++;
            break;
          case "Izin":
            presensiMap[tanggal].izin++;
            break;
          case "Sakit":
            presensiMap[tanggal].sakit++;
            break;
          case "Alfa":
            presensiMap[tanggal].alfa++;
            break;
        }
      }

      const allDates: string[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        allDates.push(formatLocalDate(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const chartData = allDates.map((tanggal) => ({
        tanggal,
        hadir: presensiMap[tanggal]?.hadir || 0,
        terlambat: presensiMap[tanggal]?.terlambat || 0,
        izin: presensiMap[tanggal]?.izin || 0,
        sakit: presensiMap[tanggal]?.sakit || 0,
        alfa: presensiMap[tanggal]?.alfa || 0,
      }));

      let totalHadir = 0,
        totalTerlambat = 0,
        totalIzin = 0,
        totalSakit = 0,
        totalAlfa = 0;
      for (const item of chartData) {
        totalHadir += item.hadir;
        totalTerlambat += item.terlambat;
        totalIzin += item.izin;
        totalSakit += item.sakit;
        totalAlfa += item.alfa;
      }

      setPresensiData(chartData);
      setSummaryPresensi({
        hadir: totalHadir,
        terlambat: totalTerlambat,
        izin: totalIzin,
        sakit: totalSakit,
        alfa: totalAlfa,
      });
    } catch (error) {
      console.error("Error fetching presensi data:", error);
    }
  }, [periode]);

  // === FETCH MONITORING DATA ===
  const fetchMonitoringData = useCallback(async () => {
    setLoadingMonitoring(true);
    try {
      const now = new Date();
      const today = formatLocalDate(now);
      const hariIndo = now.toLocaleDateString("id-ID", { weekday: "long" });
      // Jika database menggunakan bahasa Inggris (Monday), ubah baris di atas menjadi:
      // const hariIndo = now.toLocaleDateString("en-US", { weekday: "long" });

      // Ambil data jurusan
      const { data: jurusanData } = await supabase
        .from("jurusan")
        .select("id_jurusan, nama_jurusan");
      const jurusanMap = new Map<number, string>((jurusanData || []).map((j) => [j.id_jurusan, j.nama_jurusan]));

      // ---- Ambil semua kelas ----
      let kelasQuery = supabase
        .from("kelas")
        .select("id_kelas, nama, id_jurusan")
        .eq("aktif", true);
      if (user?.peran === "kepala_jurusan" && user?.id_jurusan) {
        kelasQuery = kelasQuery.eq("id_jurusan", user.id_jurusan);
      }
      const { data: semuaKelas } = await kelasQuery;
      if (!semuaKelas) throw new Error("Gagal ambil data kelas");

      // ---- 1. Kelas yang belum presensi harian ----
      const { data: presensiHarianToday } = await supabase
        .from("presensi_harian")
        .select("id_siswa")
        .gte("waktu_presensi", `${today}T00:00:00`)
        .lte("waktu_presensi", `${today}T23:59:59`);

      let siswaQuery = supabase
        .from("siswa")
        .select("id_siswa, id_kelas")
        .eq("aktif", true);
      if (user?.peran === "kepala_jurusan" && user?.id_jurusan) {
        const kelasIds = semuaKelas.map((k) => k.id_kelas);
        if (kelasIds.length > 0) siswaQuery = siswaQuery.in("id_kelas", kelasIds);
        else siswaQuery = siswaQuery.eq("id_kelas", -1);
      }
      const { data: semuaSiswa } = await siswaQuery;

      const siswaSudahPresensi = new Set((presensiHarianToday || []).map((p) => p.id_siswa));

      const kelasPresensiMap = new Map<number, { total: number; sudah: number; belum: number }>();
      for (const siswa of semuaSiswa || []) {
        const idKelas = siswa.id_kelas;
        if (!idKelas) continue;
        if (!kelasPresensiMap.has(idKelas)) {
          kelasPresensiMap.set(idKelas, { total: 0, sudah: 0, belum: 0 });
        }
        const entry = kelasPresensiMap.get(idKelas)!;
        entry.total++;
        if (siswaSudahPresensi.has(siswa.id_siswa)) entry.sudah++;
        else entry.belum++;
      }

      const kelasTanpaPresensi = semuaKelas
        .filter((k) => {
          const stat = kelasPresensiMap.get(k.id_kelas);
          return stat && stat.belum > 0;
        })
        .map((k) => ({
          id_kelas: k.id_kelas,
          nama: k.nama,
          jurusan: k.id_jurusan ? jurusanMap.get(k.id_jurusan) || "-" : "-",
        }));

      // ---- 2. Mata pelajaran yang belum dipresensi ----
      let jadwalQuery = supabase
        .from("jadwal")
        .select(
          `
          id_jadwal,
          hari,
          jam,
          kelas:kelas (id_kelas, nama, id_jurusan),
          mata_pelajaran (id_mapel, nama),
          guru:guru (id_guru, nama)
        `
        )
        .eq("hari", hariIndo)
        .eq("aktif", true);

      if (user?.peran === "kepala_jurusan" && user?.id_jurusan) {
        const kelasIds = semuaKelas.map((k) => k.id_kelas);
        if (kelasIds.length > 0) {
          jadwalQuery = jadwalQuery.in("id_kelas", kelasIds);
        } else {
          jadwalQuery = jadwalQuery.eq("id_kelas", -1);
        }
      }
      const { data: jadwalHariIni } = await jadwalQuery;
      if (!jadwalHariIni) throw new Error("Gagal ambil jadwal");

      const { data: presensiMapelToday } = await supabase
        .from("presensi_siswa_mapel")
        .select("id_jadwal")
        .gte("waktu_presensi", `${today}T00:00:00`)
        .lte("waktu_presensi", `${today}T23:59:59`);

      // [PERBAIKAN] Konversi id_jadwal ke Number agar Map.get() berhasil
      const presensiMapelCount = new Map<number, number>();
      for (const p of presensiMapelToday || []) {
        const idJadwal = Number(p.id_jadwal);
        presensiMapelCount.set(idJadwal, (presensiMapelCount.get(idJadwal) || 0) + 1);
      }

      const mapelTanpaPresensi = (jadwalHariIni || [])
        .filter((j) => {
          const count = presensiMapelCount.get(Number(j.id_jadwal)) || 0;
          return count === 0;
        })
        .map((j) => {
          const kelas = j.kelas as any;
          return {
            kelas: kelas?.nama || "-",
            mapel: (j.mata_pelajaran as any)?.nama || "-",
            guru: (j.guru as any)?.nama || "-",
            jam: j.jam || "-",
          };
        });

      setMonitoringData({ kelasTanpaPresensi, mapelTanpaPresensi });
    } catch (error) {
      console.error("Error fetching monitoring data:", error);
      toast({
        title: "Gagal memuat monitoring",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoadingMonitoring(false);
    }
  }, [user, toast]);

  // === FETCH STATS ===
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [siswaRes, guruRes, kelasRes, mapelRes] = await Promise.all([
          supabase.from("siswa").select("*", { count: "exact", head: true }).eq("aktif", true),
          supabase.from("guru").select("*", { count: "exact", head: true }).eq("aktif", true),
          supabase.from("kelas").select("*", { count: "exact", head: true }).eq("aktif", true),
          supabase.from("mata_pelajaran").select("*", { count: "exact", head: true }).eq("aktif", true),
        ]);

        setStats({
          siswa: siswaRes.count || 0,
          guru: guruRes.count || 0,
          kelas: kelasRes.count || 0,
          mapel: mapelRes.count || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    fetchPresensiData();
    fetchMonitoringData();
  }, [periode, fetchPresensiData, fetchMonitoringData]);

  // === HANDLE REFRESH ===
  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchPresensiData(), fetchMonitoringData()]).finally(() => setRefreshing(false));
  };

  // === FORMAT DATE ===
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // === COLORS ===
  const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"];
  const categoryLabels = [
    { key: "hadir", label: "Hadir", color: "#10b981" },
    { key: "terlambat", label: "Terlambat", color: "#f59e0b" },
    { key: "izin", label: "Izin", color: "#3b82f6" },
    { key: "sakit", label: "Sakit", color: "#8b5cf6" },
    { key: "alfa", label: "Alfa", color: "#ef4444" },
  ];

  const pieData = categoryLabels
    .filter((cat) => selectedCategories[cat.key as keyof typeof selectedCategories])
    .map((cat) => ({
      name: cat.label,
      value: summaryPresensi[cat.key as keyof typeof summaryPresensi],
    }))
    .filter((item) => item.value > 0);

  const totalPresensi =
    summaryPresensi.hadir +
    summaryPresensi.terlambat +
    summaryPresensi.izin +
    summaryPresensi.sakit +
    summaryPresensi.alfa;
  const kehadiranPersen =
    totalPresensi > 0
      ? parseFloat(((summaryPresensi.hadir + summaryPresensi.terlambat) / totalPresensi * 100).toFixed(1))
      : 0;

  // === LOADING STATE ===
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#C4E2F5]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#2C5EAD] mx-auto" />
          <p className="text-[#2C5EAD] font-medium">Memuat Dashboard Admin...</p>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-[#F0F7FC]">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-xl mx-4 mt-4">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <div className="relative container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-white shadow-md rounded-xl">
                <AvatarFallback className="bg-white/30 text-white text-xl font-bold rounded-xl">
                  {user?.nama?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  {greeting === "Selamat Pagi" ? (
                    <Sun className="h-4 w-4" />
                  ) : greeting === "Selamat Malam" ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  <p className="text-sm">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard Admin</h1>
                <p className="text-blue-100 text-sm">
                  Selamat datang kembali, <span className="font-semibold">{user?.nama}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-[#2C5EAD] rounded-xl px-4 py-2 text-center shadow-md">
                <p className="text-xs text-white/90">{formatDate(currentTime)}</p>
                <p className="text-xl font-semibold text-white">
                  {currentTime.toLocaleTimeString("id-ID")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white rounded-xl shadow-md"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total Siswa</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.siswa}</p>
                </div>
                <div className="p-2 rounded-full bg-[#C4E2F5]">
                  <Users className="h-5 w-5 text-[#2C5EAD]" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Siswa aktif</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total Guru</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.guru}</p>
                </div>
                <div className="p-2 rounded-full bg-emerald-100">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Guru aktif</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total Kelas</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.kelas}</p>
                </div>
                <div className="p-2 rounded-full bg-purple-100">
                  <School className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Kelas aktif</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Mata Pelajaran</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.mapel}</p>
                </div>
                <div className="p-2 rounded-full bg-amber-100">
                  <BookOpen className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Total mapel</p>
            </CardContent>
          </Card>
        </div>

        {/* RINGKASAN PRESENSI */}
        <Card className="rounded-xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-5">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Ringkasan Presensi</CardTitle>
                <CardDescription className="text-blue-100 text-xs">
                  {periode === "minggu" ? "Senin s/d hari ini" : "1 s/d hari ini"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-emerald-700">{summaryPresensi.hadir}</div>
                <div className="text-xs text-emerald-600">Hadir</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-xl">
                <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-amber-700">{summaryPresensi.terlambat}</div>
                <div className="text-xs text-amber-600">Terlambat</div>
              </div>
              <div className="text-center p-3 bg-sky-50 rounded-xl">
                <FileText className="h-5 w-5 text-sky-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-sky-700">{summaryPresensi.izin}</div>
                <div className="text-xs text-sky-600">Izin</div>
              </div>
              <div className="text-center p-3 bg-violet-50 rounded-xl">
                <Heart className="h-5 w-5 text-violet-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-violet-700">{summaryPresensi.sakit}</div>
                <div className="text-xs text-violet-600">Sakit</div>
              </div>
              <div className="text-center p-3 bg-rose-50 rounded-xl">
                <XCircle className="h-5 w-5 text-rose-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-rose-700">{summaryPresensi.alfa}</div>
                <div className="text-xs text-rose-600">Alfa</div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#2C5EAD]" />
                <span className="text-sm text-slate-600">Total Kehadiran</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[#2C5EAD]">{kehadiranPersen}%</span>
                <span className="text-xs text-slate-400">dari {totalPresensi} presensi</span>
              </div>
            </div>
            <div className="mt-3">
              <Progress value={kehadiranPersen} className="h-2 [&>div]:bg-[#1591DC]" />
            </div>
          </CardContent>
        </Card>

        {/* GRAFIK */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LINE CHART */}
          <Card className="rounded-xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-[#4BB8FA] text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  <CardTitle className="text-lg">Tren Presensi</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPeriode("minggu")}
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-white text-xs transition-all ${
                      periode === "minggu"
                        ? "bg-[#2C5EAD] text-white shadow-md"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    1 Minggu
                  </Button>
                  <Button
                    onClick={() => setPeriode("bulan")}
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-white text-xs transition-all ${
                      periode === "bulan"
                        ? "bg-[#2C5EAD] text-white shadow-md"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    1 Bulan
                  </Button>
                </div>
              </div>
              <CardDescription className="text-blue-50 text-xs">
                {periode === "minggu" ? "Senin s/d hari ini" : "Tanggal 1 s/d hari ini"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="h-80">
                {presensiData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={presensiData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="tanggal"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 10, fill: "#64748b" }}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          backgroundColor: "white",
                        }}
                        cursor={{ stroke: "#94a3b8", strokeWidth: 1 }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                        iconType="circle"
                      />
                      <Line
                        type="monotone"
                        dataKey="hadir"
                        stroke="#10b981"
                        name="Hadir"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                        animationDuration={800}
                      />
                      <Line
                        type="monotone"
                        dataKey="terlambat"
                        stroke="#f59e0b"
                        name="Terlambat"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                        animationDuration={800}
                      />
                      <Line
                        type="monotone"
                        dataKey="izin"
                        stroke="#3b82f6"
                        name="Izin"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                        animationDuration={800}
                      />
                      <Line
                        type="monotone"
                        dataKey="sakit"
                        stroke="#8b5cf6"
                        name="Sakit"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                        animationDuration={800}
                      />
                      <Line
                        type="monotone"
                        dataKey="alfa"
                        stroke="#ef4444"
                        name="Alfa"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                        animationDuration={800}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                      <p>Belum ada data presensi</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PIE CHART */}
          <Card className="rounded-xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-[#4BB8FA] text-white p-5">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                <CardTitle className="text-lg">Distribusi Status Presensi</CardTitle>
              </div>
              <CardDescription className="text-blue-50 text-xs">
                Pilih kategori yang ingin ditampilkan
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-wrap gap-4 mb-6 justify-center">
                {categoryLabels.map((cat) => (
                  <div key={cat.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`pie-${cat.key}`}
                      checked={selectedCategories[cat.key as keyof typeof selectedCategories]}
                      onCheckedChange={(checked) =>
                        setSelectedCategories((prev) => ({
                          ...prev,
                          [cat.key]: checked === true,
                        }))
                      }
                      className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD]"
                    />
                    <Label
                      htmlFor={`pie-${cat.key}`}
                      className="text-sm text-slate-700 cursor-pointer"
                      style={{ color: cat.color }}
                    >
                      {cat.label}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="h-80">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        animationDuration={800}
                        animationBegin={0}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              categoryLabels.find((c) => c.label === entry.name)
                                ?.color || COLORS[index % COLORS.length]
                            }
                            stroke="white"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          backgroundColor: "white",
                        }}
                        formatter={(value: number, name: string) => [`${value} kali`, name]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <div className="text-center">
                      <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                      <p>Tidak ada data untuk kategori yang dipilih</p>
                      <p className="text-xs mt-1">Centang minimal satu kategori</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ==================== MONITORING PRESENSI HARI INI ==================== */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* KELAS BELUM PRESENSI (dengan filter) */}
          <Card className="rounded-xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-[#1591DC] text-white p-5">
              <div className="flex items-center gap-2">
                <School className="h-5 w-5" />
                <CardTitle className="text-lg">Kelas Belum Presensi Hari Ini</CardTitle>
              </div>
              <CardDescription className="text-blue-50 text-xs">
                {user?.peran === "kepala_jurusan" ? "Hanya kelas di jurusan Anda" : "Semua kelas"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Filter untuk card kelas */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Tingkat:</Label>
                  <Select value={filterLevel} onValueChange={(val) => setFilterLevel(val as any)}>
                    <SelectTrigger className="w-[120px] h-9 text-sm rounded-lg border-slate-200">
                      <SelectValue placeholder="Tingkat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semua">Semua</SelectItem>
                      <SelectItem value="X">X</SelectItem>
                      <SelectItem value="XI">XI</SelectItem>
                      <SelectItem value="XII">XII</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                  <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Cari Kelas:</Label>
                  <Input
                    placeholder="Nama kelas..."
                    value={searchKelas}
                    onChange={(e) => setSearchKelas(e.target.value)}
                    className="h-9 text-sm rounded-lg border-slate-200"
                  />
                </div>
              </div>

              {loadingMonitoring ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#2C5EAD]" />
                </div>
              ) : filteredKelasTanpaPresensi.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                  <p>Semua kelas sudah melakukan presensi hari ini</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Nama Kelas</TableHead>
                        <TableHead>Jurusan</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredKelasTanpaPresensi.map((kelas) => (
                        <TableRow key={kelas.id_kelas}>
                          <TableCell className="font-medium">{kelas.nama}</TableCell>
                          <TableCell>{kelas.jurusan}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive" className="bg-amber-100 text-amber-700">
                              <AlertCircle className="h-3 w-3 mr-1" /> Belum
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* MAPEL BELUM DIPRESENSI (dengan filter) */}
          <Card className="rounded-xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-[#4BB8FA] text-white p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                <CardTitle className="text-lg">Mata Pelajaran Belum Dipresensi</CardTitle>
              </div>
              <CardDescription className="text-blue-50 text-xs">
                Berdasarkan jadwal hari ini
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Filter untuk card mapel */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Tingkat:</Label>
                  <Select value={filterLevel} onValueChange={(val) => setFilterLevel(val as any)}>
                    <SelectTrigger className="w-[120px] h-9 text-sm rounded-lg border-slate-200">
                      <SelectValue placeholder="Tingkat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semua">Semua</SelectItem>
                      <SelectItem value="X">X</SelectItem>
                      <SelectItem value="XI">XI</SelectItem>
                      <SelectItem value="XII">XII</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                  <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Cari Kelas:</Label>
                  <Input
                    placeholder="Nama kelas..."
                    value={searchKelas}
                    onChange={(e) => setSearchKelas(e.target.value)}
                    className="h-9 text-sm rounded-lg border-slate-200"
                  />
                </div>
              </div>

              {loadingMonitoring ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#2C5EAD]" />
                </div>
              ) : monitoringData.mapelTanpaPresensi.length === 0 && !loadingMonitoring ? (
                // Cek apakah tidak ada jadwal sama sekali atau semua sudah dipresensi
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-400" />
                  <p>Semua mata pelajaran sudah dipresensi hari ini</p>
                </div>
              ) : filteredMapelTanpaPresensi.length === 0 && monitoringData.mapelTanpaPresensi.length > 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 text-amber-400" />
                  <p>Tidak ada jadwal yang sesuai dengan filter</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Kelas</TableHead>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Guru</TableHead>
                        <TableHead>Jam</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMapelTanpaPresensi.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.kelas}</TableCell>
                          <TableCell>{item.mapel}</TableCell>
                          <TableCell>{item.guru}</TableCell>
                          <TableCell>{item.jam}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive" className="bg-amber-100 text-amber-700">
                              <AlertCircle className="h-3 w-3 mr-1" /> Belum
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* TIPS */}
        <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-[#C4E2F5]/50 to-[#4BB8FA]/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="bg-[#2C5EAD]/10 p-3 rounded-xl">
                <Sparkles className="h-6 w-6 text-[#2C5EAD]" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Informasi Dashboard</h3>
                <p className="text-sm text-slate-600">
                  Dashboard ini menampilkan ringkasan data sekolah. Grafik presensi menunjukkan tren
                  kehadiran siswa dengan periode <strong>1 minggu (Senin s/d hari ini)</strong> atau{" "}
                  <strong>1 bulan (tanggal 1 s/d hari ini)</strong>. Pada diagram lingkaran, Anda
                  dapat memilih kategori yang ingin ditampilkan. Gunakan filter tingkat dan pencarian
                  untuk memantau presensi mata pelajaran per kelas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Dashboard - SmartAS</p>
          <p className="text-[10px] text-slate-300 mt-1">Sistem Informasi Akademik</p>
        </div>
      </div>
    </div>
  );
}