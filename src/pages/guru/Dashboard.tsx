// src/pages/guru/Dashboard.tsx (VERSI FULL SIAP SALIN - REDESAIN MODERN)
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  Users, 
  BookOpen, 
  Calendar, 
  Clock,
  User,
  School,
  TrendingUp,
  Activity,
  Award,
  Bell,
  Home,
  Briefcase,
  Star,
  FileText,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  Info,
  Trophy,
  Sparkles,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  BarChart3,
  PieChart,
  LineChart,
  GraduationCap
} from "lucide-react";

interface Kelas {
  id_kelas: number;
  nama: string;
}

interface SiswaPresensi {
  id_siswa: number;
  nama: string;
  nis: string;
  status_harian: string;
  waktu_harian: string;
  status_mapel_terakhir: string;
  mapel_terakhir: string;
}

interface StatistikHarian {
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
  total: number;
}

interface StatistikMapel {
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
  total: number;
}

export default function GuruDashboard() {
  const { user } = useAuth();
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [siswaList, setSiswaList] = useState<SiswaPresensi[]>([]);
  const [statsHarian, setStatsHarian] = useState<StatistikHarian>({ hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0, total: 0 });
  const [statsMapel, setStatsMapel] = useState<StatistikMapel>({ hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 });
  const [recentHarian, setRecentHarian] = useState<any[]>([]);
  const [jadwalHariIni, setJadwalHariIni] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== FETCH KELAS (LOGIKA ASLI) ====================
  useEffect(() => {
    const fetchKelas = async () => {
      if (!user?.id_guru) return;
      try {
        const { data, error } = await supabase
          .from("jadwal")
          .select("kelas:id_kelas(id_kelas, nama)")
          .eq("id_guru", user.id_guru)
          .eq("aktif", true);
        if (error) throw error;
        const uniqueKelas = new Map();
        data.forEach((item: any) => {
          if (item.kelas && !uniqueKelas.has(item.kelas.id_kelas)) {
            uniqueKelas.set(item.kelas.id_kelas, { id_kelas: item.kelas.id_kelas, nama: item.kelas.nama });
          }
        });
        const kelasArray = Array.from(uniqueKelas.values());
        setKelasList(kelasArray);
        if (kelasArray.length > 0) {
          setSelectedKelas(kelasArray[0].id_kelas.toString());
        }
      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchKelas();
  }, [user]);

  // ==================== FETCH DATA PRESENSI (LOGIKA ASLI) ====================
  useEffect(() => {
    if (!selectedKelas) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const kelasId = parseInt(selectedKelas);
        
        const { data: siswaData, error: siswaError } = await supabase
          .from("siswa")
          .select("id_siswa, nama, nis")
          .eq("id_kelas", kelasId)
          .eq("aktif", true);
        if (siswaError) throw siswaError;
        
        const siswaIds = siswaData.map(s => s.id_siswa);
        
        const today = new Date().toISOString().split("T")[0];
        const { data: harianToday, error: harianError } = await supabase
          .from("presensi_harian")
          .select("id_siswa, status_presensi, waktu_presensi")
          .in("id_siswa", siswaIds)
          .gte("waktu_presensi", `${today}T00:00:00`)
          .lte("waktu_presensi", `${today}T23:59:59`);
        
        const mapHarian = new Map();
        if (harianToday) {
          harianToday.forEach(p => mapHarian.set(p.id_siswa, { status: p.status_presensi, waktu: p.waktu_presensi }));
        }
        
        const { data: mapelData, error: mapelError } = await supabase
          .from("presensi_siswa_mapel")
          .select("id_siswa, status, waktu_presensi, jadwal:jadwal(mapel:mata_pelajaran(nama))")
          .in("id_siswa", siswaIds)
          .order("waktu_presensi", { ascending: false });
        
        const mapMapel = new Map();
        if (mapelData) {
          mapelData.forEach(p => {
            if (!mapMapel.has(p.id_siswa)) {
              mapMapel.set(p.id_siswa, {
                status: p.status,
                mapel: p.jadwal?.mapel?.nama || "-"
              });
            }
          });
        }
        
        const combined = siswaData.map(s => ({
          id_siswa: s.id_siswa,
          nama: s.nama,
          nis: s.nis?.toString() || "",
          status_harian: mapHarian.get(s.id_siswa)?.status || "-",
          waktu_harian: mapHarian.get(s.id_siswa)?.waktu ? new Date(mapHarian.get(s.id_siswa).waktu).toLocaleTimeString("id-ID") : "-",
          status_mapel_terakhir: mapMapel.get(s.id_siswa)?.status || "-",
          mapel_terakhir: mapMapel.get(s.id_siswa)?.mapel || "-",
        }));
        setSiswaList(combined);
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const start = startDate.toISOString().split("T")[0];
        
        const { data: harian30, error: harian30Error } = await supabase
          .from("presensi_harian")
          .select("status_presensi")
          .in("id_siswa", siswaIds)
          .gte("waktu_presensi", `${start}T00:00:00`)
          .lte("waktu_presensi", `${today}T23:59:59`);
        
        if (!harian30Error && harian30) {
          const stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0, total: 0 };
          harian30.forEach(p => {
            stats.total++;
            if (p.status_presensi === "Hadir") stats.hadir++;
            else if (p.status_presensi === "Terlambat") stats.terlambat++;
            else if (p.status_presensi === "Izin") stats.izin++;
            else if (p.status_presensi === "Sakit") stats.sakit++;
            else if (p.status_presensi === "Alfa") stats.alfa++;
          });
          setStatsHarian(stats);
        }
        
        const { data: jadwalIds, error: jadwalError } = await supabase
          .from("jadwal")
          .select("id_jadwal")
          .eq("id_guru", user?.id_guru)
          .eq("aktif", true);
        if (!jadwalError && jadwalIds) {
          const ids = jadwalIds.map(j => j.id_jadwal);
          const { data: mapel30, error: mapel30Error } = await supabase
            .from("presensi_siswa_mapel")
            .select("status")
            .in("id_jadwal", ids)
            .in("id_siswa", siswaIds)
            .gte("waktu_presensi", `${start}T00:00:00`)
            .lte("waktu_presensi", `${today}T23:59:59`);
          if (!mapel30Error && mapel30) {
            const stats = { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 };
            mapel30.forEach(p => {
              stats.total++;
              if (p.status === "Hadir") stats.hadir++;
              else if (p.status === "Izin") stats.izin++;
              else if (p.status === "Sakit") stats.sakit++;
              else if (p.status === "Alfa") stats.alfa++;
            });
            setStatsMapel(stats);
          }
        }
        
        const { data: recent, error: recentError } = await supabase
          .from("presensi_harian")
          .select("id_siswa, status_presensi, waktu_presensi, siswa:siswa(nama, nis)")
          .in("id_siswa", siswaIds)
          .order("waktu_presensi", { ascending: false })
          .limit(5);
        if (!recentError && recent) {
          setRecentHarian(recent.map(r => ({
            nama: r.siswa?.nama,
            nis: r.siswa?.nis,
            status: r.status_presensi,
            waktu: new Date(r.waktu_presensi).toLocaleString("id-ID"),
          })));
        }
        
        const daysMap: Record<string, string> = {
          "Sunday": "Minggu", "Monday": "Senin", "Tuesday": "Selasa", "Wednesday": "Rabu",
          "Thursday": "Kamis", "Friday": "Jumat", "Saturday": "Sabtu"
        };
        const todayName = daysMap[new Date().toLocaleDateString('en-US', { weekday: 'long' })];
        const { data: jadwalToday, error: jadwalTodayError } = await supabase
          .from("jadwal")
          .select("jam, mapel:mata_pelajaran(nama), kelas:kelas(nama)")
          .eq("id_guru", user?.id_guru)
          .eq("hari", todayName)
          .eq("aktif", true)
          .order("jam");
        if (!jadwalTodayError && jadwalToday) {
          setJadwalHariIni(jadwalToday.map(j => ({
            jam: j.jam,
            mapel: j.mapel?.nama || "-",
            kelas: j.kelas?.nama || "-",
          })));
        }
        
      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedKelas, user]);

  // ==================== HANDLE REFRESH ====================
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  // ==================== FORMAT DATE ====================
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  // ==================== GET STATUS COLOR ====================
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      "Hadir": "bg-emerald-100 text-emerald-700",
      "Terlambat": "bg-amber-100 text-amber-700",
      "Izin": "bg-sky-100 text-sky-700",
      "Sakit": "bg-violet-100 text-violet-700",
      "Alfa": "bg-rose-100 text-rose-700",
      "-": "bg-slate-100 text-slate-500"
    };
    return colors[status] || "bg-slate-100 text-slate-500";
  };

  // ==================== CALCULATIONS ====================
  const attendancePercentage = useMemo(() => {
    if (statsHarian.total === 0) return 0;
    return ((statsHarian.hadir + statsHarian.terlambat) / statsHarian.total * 100).toFixed(1);
  }, [statsHarian]);

  const mapelPercentage = useMemo(() => {
    if (statsMapel.total === 0) return 0;
    return (statsMapel.hadir / statsMapel.total * 100).toFixed(1);
  }, [statsMapel]);

  const presentToday = useMemo(() => {
    return siswaList.filter(s => s.status_harian === "Hadir" || s.status_harian === "Terlambat").length;
  }, [siswaList]);

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500">Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-white/30 rounded-2xl">
                <AvatarFallback className="bg-white/20 text-white text-xl font-bold rounded-2xl">
                  {user?.nama?.charAt(0) || "G"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Dashboard Guru</h1>
                <p className="text-blue-100 text-sm">
                  Selamat datang kembali, <span className="font-semibold">{user?.nama}</span>
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
        
        {kelasList.length === 0 ? (
          <Card className="rounded-2xl border-0 shadow-xl">
            <CardContent className="text-center py-16">
              <div className="bg-slate-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4">
                <School className="h-10 w-10 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium">Anda belum memiliki jadwal mengajar.</p>
              <p className="text-slate-400 text-sm mt-1">Hubungi administrator untuk penjadwalan.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* CLASS SELECTOR */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white rounded-2xl shadow-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-xl">
                  <School className="h-5 w-5 text-blue-600" />
                </div>
                <label className="text-sm font-semibold text-slate-700">Pilih Kelas:</label>
              </div>
              <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                <SelectTrigger className="w-56 rounded-xl border-slate-200">
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {kelasList.map(k => (
                    <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>
                      {k.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Total Siswa</p>
                      <p className="text-2xl font-bold text-blue-900">{siswaList.length}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-emerald-600 font-medium">Hadir Hari Ini</p>
                      <p className="text-2xl font-bold text-emerald-900">{presentToday}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">Kehadiran 30 Hari</p>
                      <p className="text-2xl font-bold text-purple-900">{attendancePercentage}%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-600 font-medium">Mapel Hari Ini</p>
                      <p className="text-2xl font-bold text-amber-900">{jadwalHariIni.length}</p>
                    </div>
                    <BookOpen className="h-8 w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* STATISTICS GRID */}
            <div className="grid gap-6 lg:grid-cols-2">
              
              {/* Statistik Presensi Harian Card */}
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      <CardTitle className="text-lg">Statistik Presensi Harian (30 hari)</CardTitle>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-xl text-center">
                      <p className="text-lg font-bold">{attendancePercentage}%</p>
                      <p className="text-[10px]">Kehadiran</p>
                    </div>
                  </div>
                  <CardDescription className="text-emerald-100 text-xs">
                    Ringkasan kehadiran siswa dalam 30 hari terakhir
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-5 gap-3">
                    <div className="text-center space-y-1">
                      <div className="bg-emerald-100 p-2 rounded-xl">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto" />
                        <div className="text-xl font-bold text-emerald-700">{statsHarian.hadir}</div>
                      </div>
                      <p className="text-[10px] font-medium text-emerald-600">Hadir</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="bg-amber-100 p-2 rounded-xl">
                        <Clock className="h-5 w-5 text-amber-600 mx-auto" />
                        <div className="text-xl font-bold text-amber-700">{statsHarian.terlambat}</div>
                      </div>
                      <p className="text-[10px] font-medium text-amber-600">Terlambat</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="bg-sky-100 p-2 rounded-xl">
                        <FileText className="h-5 w-5 text-sky-600 mx-auto" />
                        <div className="text-xl font-bold text-sky-700">{statsHarian.izin}</div>
                      </div>
                      <p className="text-[10px] font-medium text-sky-600">Izin</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="bg-violet-100 p-2 rounded-xl">
                        <Activity className="h-5 w-5 text-violet-600 mx-auto" />
                        <div className="text-xl font-bold text-violet-700">{statsHarian.sakit}</div>
                      </div>
                      <p className="text-[10px] font-medium text-violet-600">Sakit</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="bg-rose-100 p-2 rounded-xl">
                        <XCircle className="h-5 w-5 text-rose-600 mx-auto" />
                        <div className="text-xl font-bold text-rose-700">{statsHarian.alfa}</div>
                      </div>
                      <p className="text-[10px] font-medium text-rose-600">Alfa</p>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Total Kehadiran</span>
                      <span className="font-semibold text-emerald-600">{attendancePercentage}%</span>
                    </div>
                    <Progress value={parseFloat(attendancePercentage as string)} className="h-2" />
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-3">
                    Total presensi: {statsHarian.total}
                  </p>
                </CardContent>
              </Card>

              {/* Statistik Presensi Mapel Card */}
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      <CardTitle className="text-lg">Statistik Presensi Mapel (30 hari)</CardTitle>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-xl text-center">
                      <p className="text-lg font-bold">{mapelPercentage}%</p>
                      <p className="text-[10px]">Kehadiran</p>
                    </div>
                  </div>
                  <CardDescription className="text-blue-100 text-xs">
                    Ringkasan kehadiran siswa per mata pelajaran
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center space-y-1">
                      <div className="bg-emerald-100 p-2 rounded-xl">
                        <CheckCircle className="h-5 w-5 text-emerald-600 mx-auto" />
                        <div className="text-xl font-bold text-emerald-700">{statsMapel.hadir}</div>
                      </div>
                      <p className="text-[10px] font-medium text-emerald-600">Hadir</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="bg-sky-100 p-2 rounded-xl">
                        <FileText className="h-5 w-5 text-sky-600 mx-auto" />
                        <div className="text-xl font-bold text-sky-700">{statsMapel.izin}</div>
                      </div>
                      <p className="text-[10px] font-medium text-sky-600">Izin</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="bg-violet-100 p-2 rounded-xl">
                        <Activity className="h-5 w-5 text-violet-600 mx-auto" />
                        <div className="text-xl font-bold text-violet-700">{statsMapel.sakit}</div>
                      </div>
                      <p className="text-[10px] font-medium text-violet-600">Sakit</p>
                    </div>
                    <div className="text-center space-y-1">
                      <div className="bg-rose-100 p-2 rounded-xl">
                        <XCircle className="h-5 w-5 text-rose-600 mx-auto" />
                        <div className="text-xl font-bold text-rose-700">{statsMapel.alfa}</div>
                      </div>
                      <p className="text-[10px] font-medium text-rose-600">Alfa</p>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Total Kehadiran Mapel</span>
                      <span className="font-semibold text-blue-600">{mapelPercentage}%</span>
                    </div>
                    <Progress value={parseFloat(mapelPercentage as string)} className="h-2" />
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-3">
                    Total presensi: {statsMapel.total}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* JADWAL & RECENT PRESENSI GRID */}
            <div className="grid gap-6 lg:grid-cols-2">
              
              {/* Jadwal Hari Ini Card */}
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <CardTitle className="text-lg">Jadwal Mengajar Hari Ini</CardTitle>
                  </div>
                  <CardDescription className="text-slate-300 text-xs">
                    {formatDate(currentTime)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {jadwalHariIni.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="bg-slate-100 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-3">
                        <Calendar className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500">Tidak ada jadwal hari ini</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {jadwalHariIni.map((j, idx) => (
                        <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-100 p-2 rounded-xl">
                                <Clock className="h-4 w-4 text-blue-600" />
                              </div>
                              <span className="font-mono text-sm font-semibold text-slate-700">{j.jam}</span>
                            </div>
                            <div className="flex-1 mx-4">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-purple-500" />
                                <span className="font-medium text-slate-800">{j.mapel}</span>
                              </div>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-700 rounded-full">
                              <Users className="h-3 w-3 mr-1" />
                              {j.kelas}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Presensi Harian Terbaru Card */}
              <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <CardTitle className="text-lg">Presensi Harian Terbaru</CardTitle>
                  </div>
                  <CardDescription className="text-slate-300 text-xs">
                    5 data presensi terakhir
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">NIS</TableHead>
                          <TableHead className="font-semibold">Nama</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Waktu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentHarian.map((p, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-mono text-sm">{p.nis}</TableCell>
                            <TableCell className="font-medium">{p.nama}</TableCell>
                            <TableCell>
                              <Badge className={`${getStatusColor(p.status)} border-0 rounded-full px-2 py-0.5 text-xs`}>
                                {p.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-500 text-sm">{p.waktu}</TableCell>
                          </TableRow>
                        ))}
                        {recentHarian.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                              Belum ada data presensi
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* MAIN PRESENSI SISWA TABLE */}
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle className="text-lg">Presensi Siswa Hari Ini</CardTitle>
                </div>
                <CardDescription className="text-slate-300 text-xs">
                  Daftar presensi harian dan mapel terakhir siswa
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">NIS</TableHead>
                        <TableHead className="font-semibold">Nama</TableHead>
                        <TableHead className="font-semibold">Presensi Harian</TableHead>
                        <TableHead className="font-semibold">Waktu</TableHead>
                        <TableHead className="font-semibold">Presensi Mapel Terakhir</TableHead>
                        <TableHead className="font-semibold">Mapel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {siswaList.map(s => (
                        <TableRow key={s.id_siswa} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-mono text-sm">{s.nis}</TableCell>
                          <TableCell className="font-medium">{s.nama}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(s.status_harian)} border-0 rounded-full px-2 py-0.5 text-xs`}>
                              {s.status_harian}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">{s.waktu_harian}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(s.status_mapel_terakhir)} border-0 rounded-full px-2 py-0.5 text-xs`}>
                              {s.status_mapel_terakhir}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">{s.mapel_terakhir}</TableCell>
                        </TableRow>
                      ))}
                      {siswaList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                            Belum ada data siswa
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* TIPS SECTION */}
            <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="bg-indigo-100 p-3 rounded-xl">
                    <Sparkles className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-1">Tips untuk Guru</h3>
                    <p className="text-sm text-slate-600">
                      Pantau kehadiran siswa secara berkala. Gunakan fitur filter kelas untuk melihat data 
                      per kelas. Pastikan untuk selalu mengaktifkan QR Code presensi 15 menit sebelum jadwal dimulai.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Dashboard Guru - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Sistem Informasi Akademik
          </p>
        </div>
      </div>
    </div>
  );
}