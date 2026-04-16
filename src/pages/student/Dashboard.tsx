import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Loader2, 
  User, 
  GraduationCap, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  BookOpen,
  TrendingUp,
  Activity,
  Award,
  Bell,
  Home,
  Briefcase,
  Star,
  FileText,
  School,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  Info
} from "lucide-react";

// ==================== INTERFACES ====================
interface SiswaData {
  id_siswa: number;
  nama: string;
  nis: string;
  kelas_nama: string;
  id_pkl: number | null;
  tempat_pkl?: string;
}

interface MataPelajaran {
  id_mapel: number;
  nama: string;
}

interface PresensiHarian {
  tanggal: string;
  status: string;
  waktu: string;
}

interface PresensiMapel {
  mapel: string;
  status: string;
  tanggal: string;
}

// ==================== MAIN COMPONENT ====================
export default function StudentDashboard() {
  const { user } = useAuth();
  
  // ==================== STATE ====================
  const [siswa, setSiswa] = useState<SiswaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [statsHarian, setStatsHarian] = useState({ hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 });
  const [recentHarian, setRecentHarian] = useState<PresensiHarian[]>([]);
  
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [selectedMapel, setSelectedMapel] = useState<string>("all");
  const [statsMapel, setStatsMapel] = useState({ hadir: 0, izin: 0, sakit: 0, alfa: 0 });
  const [recentMapel, setRecentMapel] = useState<PresensiMapel[]>([]);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  // ==================== HELPER FUNCTIONS ====================
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString("id-ID", { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== GET STATUS STYLES ====================
  const getStatusColor = useCallback((status: string) => {
    const colors: Record<string, string> = {
      "Hadir": "bg-emerald-100 text-emerald-700",
      "Terlambat": "bg-amber-100 text-amber-700",
      "Izin": "bg-sky-100 text-sky-700",
      "Sakit": "bg-violet-100 text-violet-700",
      "Alfa": "bg-rose-100 text-rose-700"
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch(status) {
      case "Hadir": return <CheckCircle className="h-3 w-3" />;
      case "Terlambat": return <Clock className="h-3 w-3" />;
      case "Izin": return <FileText className="h-3 w-3" />;
      case "Sakit": return <Activity className="h-3 w-3" />;
      case "Alfa": return <XCircle className="h-3 w-3" />;
      default: return <AlertCircle className="h-3 w-3" />;
    }
  }, []);

  // ==================== FETCH DATA ====================
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id_siswa) return;
      try {
        const { data: siswaData, error: siswaError } = await supabase
          .from("siswa")
          .select("id_siswa, nama, nis, id_kelas, id_pkl, kelas:kelas(nama), pkl:pkl(tempat_pkl)")
          .eq("id_siswa", user.id_siswa)
          .single();
        if (siswaError) throw siswaError;
        setSiswa({
          id_siswa: siswaData.id_siswa,
          nama: siswaData.nama,
          nis: siswaData.nis?.toString() || "",
          kelas_nama: siswaData.kelas?.nama || "-",
          id_pkl: siswaData.id_pkl,
          tempat_pkl: siswaData.pkl?.tempat_pkl,
        });

        if (siswaData.id_kelas) {
          const { data: jadwalData, error: jadwalError } = await supabase
            .from("jadwal")
            .select("mapel:mata_pelajaran(id_mapel, nama)")
            .eq("id_kelas", siswaData.id_kelas)
            .eq("aktif", true);
          if (!jadwalError && jadwalData) {
            const uniqueMapel = new Map();
            jadwalData.forEach((item: any) => {
              if (item.mapel && !uniqueMapel.has(item.mapel.id_mapel)) {
                uniqueMapel.set(item.mapel.id_mapel, { 
                  id_mapel: item.mapel.id_mapel, 
                  nama: item.mapel.nama 
                });
              }
            });
            setMapelList(Array.from(uniqueMapel.values()));
          }
        }

        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const start = startDate.toISOString().split("T")[0];
        
        const { data: harianData, error: harianError } = await supabase
          .from("presensi_harian")
          .select("status_presensi, waktu_presensi")
          .eq("id_siswa", user.id_siswa)
          .gte("waktu_presensi", `${start}T00:00:00`)
          .lte("waktu_presensi", `${endDate}T23:59:59`);
        if (!harianError && harianData) {
          const stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
          const recent = harianData.slice(-5).reverse().map(p => ({
            tanggal: new Date(p.waktu_presensi).toLocaleDateString("id-ID"),
            status: p.status_presensi,
            waktu: new Date(p.waktu_presensi).toLocaleTimeString("id-ID"),
          }));
          harianData.forEach(p => {
            if (p.status_presensi === "Hadir") stats.hadir++;
            else if (p.status_presensi === "Terlambat") stats.terlambat++;
            else if (p.status_presensi === "Izin") stats.izin++;
            else if (p.status_presensi === "Sakit") stats.sakit++;
            else if (p.status_presensi === "Alfa") stats.alfa++;
          });
          setStatsHarian(stats);
          setRecentHarian(recent);
        }
      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // ==================== FETCH PRESENSI MAPEL ====================
  useEffect(() => {
    const fetchPresensiMapel = async () => {
      if (!user?.id_siswa || loading) return;
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const start = startDate.toISOString().split("T")[0];
      
      let query = supabase
        .from("presensi_siswa_mapel")
        .select("status, waktu_presensi, jadwal:jadwal(mapel:mata_pelajaran(id_mapel, nama))")
        .eq("id_siswa", user.id_siswa)
        .gte("waktu_presensi", `${start}T00:00:00`)
        .lte("waktu_presensi", `${endDate}T23:59:59`);
      
      if (selectedMapel !== "all") {
        const mapelId = parseInt(selectedMapel);
        query = query.eq("jadwal.mapel.id_mapel", mapelId);
      }
      
      const { data: mapelData, error: mapelError } = await query;
      if (!mapelError && mapelData) {
        const stats = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
        const recent = mapelData.slice(-5).reverse().map(p => ({
          mapel: p.jadwal?.mapel?.nama || "-",
          status: p.status,
          tanggal: new Date(p.waktu_presensi).toLocaleDateString("id-ID"),
        }));
        mapelData.forEach(p => {
          if (p.status === "Hadir") stats.hadir++;
          else if (p.status === "Izin") stats.izin++;
          else if (p.status === "Sakit") stats.sakit++;
          else if (p.status === "Alfa") stats.alfa++;
        });
        setStatsMapel(stats);
        setRecentMapel(recent);
      } else {
        setStatsMapel({ hadir: 0, izin: 0, sakit: 0, alfa: 0 });
        setRecentMapel([]);
      }
    };
    fetchPresensiMapel();
  }, [selectedMapel, user, loading]);

  // ==================== CALCULATIONS ====================
  const totalAttendance = useMemo(() => {
    const total = statsHarian.hadir + statsHarian.terlambat + statsHarian.izin + statsHarian.sakit + statsHarian.alfa;
    if (total === 0) return 0;
    return ((statsHarian.hadir + statsHarian.terlambat) / total * 100).toFixed(1);
  }, [statsHarian]);

  // ==================== HANDLE REFRESH ====================
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  // ==================== GET MAPEL NAME ====================
  const getMapelName = useCallback((mapelId: string): string => {
    if (mapelId === "all") return "semua mata pelajaran";
    const found = mapelList.find(m => m.id_mapel.toString() === mapelId);
    return found?.nama || "mata pelajaran terpilih";
  }, [mapelList]);

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

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      
      {/* HEADER - GRADIENT BANNER DENGAN SUDUT MELENGKUNG */}
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
                <h1 className="text-2xl lg:text-3xl font-bold">Dashboard Siswa</h1>
                <p className="text-blue-100 text-sm">
                  Selamat datang kembali, <span className="font-semibold">{siswa?.nama}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-xl font-semibold">{formatTime(currentTime)}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl"
                onClick={handleRefresh}
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
                  <p className="text-xl font-bold text-blue-900">{siswa?.nis}</p>
                </div>
                <User className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Kelas</p>
                  <p className="text-xl font-bold text-emerald-900">{siswa?.kelas_nama}</p>
                </div>
                <School className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Status</p>
                  <p className="text-xl font-bold text-purple-900">
                    {siswa?.id_pkl ? "PKL" : "Sekolah"}
                  </p>
                </div>
                {siswa?.id_pkl ? <Briefcase className="h-8 w-8 text-purple-500" /> : <Home className="h-8 w-8 text-purple-500" />}
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Kehadiran</p>
                  <p className="text-xl font-bold text-amber-900">{totalAttendance}%</p>
                </div>
                <Activity className="h-8 w-8 text-amber-500" />
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

        {/* STATS GRID */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* PRESENSI HARIAN CARD */}
          <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <CardTitle className="text-lg">Presensi Harian (30 hari)</CardTitle>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-xl text-center">
                  <p className="text-lg font-bold">{totalAttendance}%</p>
                  <p className="text-[10px]">Kehadiran</p>
                </div>
              </div>
              <CardDescription className="text-emerald-100 text-xs">
                Ringkasan kehadiran Anda dalam 30 hari terakhir
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
                  <span className="font-semibold text-emerald-600">{totalAttendance}%</span>
                </div>
                <Progress value={parseFloat(totalAttendance as string)} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* PRESENSI MAPEL CARD */}
          <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  <CardTitle className="text-lg">Presensi Mata Pelajaran</CardTitle>
                </div>
                <Select value={selectedMapel} onValueChange={setSelectedMapel}>
                  <SelectTrigger className="w-[160px] bg-white/20 border-white/30 text-white rounded-xl text-sm">
                    <SelectValue placeholder="Semua Mapel" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Semua Mata Pelajaran</SelectItem>
                    {mapelList.map((mapel) => (
                      <SelectItem key={mapel.id_mapel} value={mapel.id_mapel.toString()}>
                        {mapel.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <CardDescription className="text-blue-100 text-xs">
                Ringkasan kehadiran per mata pelajaran (30 hari)
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
              
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Menampilkan data untuk {getMapelName(selectedMapel)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABS SECTION */}
        <Tabs defaultValue="harian" className="space-y-5">
          <TabsList className="bg-slate-100 p-1 rounded-xl w-full max-w-md">
            <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Presensi Harian
            </TabsTrigger>
            <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Presensi Mapel
            </TabsTrigger>
          </TabsList>
          
          {/* TAB PRESENSI HARIAN */}
          <TabsContent value="harian">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <CardTitle className="text-lg">Riwayat Presensi Harian Terbaru</CardTitle>
                </div>
                <CardDescription className="text-slate-300 text-xs">
                  5 data presensi terakhir Anda
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentHarian.map((p, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-medium">{p.tanggal}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(p.status)} border-0 px-3 py-1 rounded-full flex items-center gap-1 w-fit text-xs`}>
                              {getStatusIcon(p.status)}
                              {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{p.waktu}</TableCell>
                        </TableRow>
                      ))}
                      {recentHarian.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                            Belum ada data presensi
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 py-3 px-5">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Menampilkan 5 data terbaru dari 30 hari terakhir
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* TAB PRESENSI MAPEL */}
          <TabsContent value="mapel">
            <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  <CardTitle className="text-lg">Riwayat Presensi Mata Pelajaran Terbaru</CardTitle>
                </div>
                <CardDescription className="text-slate-300 text-xs">
                  5 data presensi mata pelajaran terakhir Anda
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Mata Pelajaran</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentMapel.map((p, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-medium">{p.tanggal}</TableCell>
                          <TableCell>{p.mapel}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(p.status)} border-0 px-3 py-1 rounded-full flex items-center gap-1 w-fit text-xs`}>
                              {getStatusIcon(p.status)}
                              {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {recentMapel.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                            Belum ada data presensi mata pelajaran
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 py-3 px-5">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Menampilkan data untuk {getMapelName(selectedMapel)}
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>

        {/* BOTTOM CARDS */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-600" />
                Pencapaian
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl">
                  <span className="text-sm">Kehadiran &gt; 90%</span>
                  {parseFloat(totalAttendance as string) > 90 ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl">
                  <span className="text-sm">Tidak Ada Alfa</span>
                  {statsHarian.alfa === 0 ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-sky-50 to-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-sky-600" />
                Rekomendasi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {statsHarian.terlambat > 3 && (
                  <p className="text-sm text-amber-700 p-2 bg-amber-50 rounded-xl">⚠️ Tingkatkan kedisiplinan waktu datang</p>
                )}
                {statsHarian.alfa > 0 && (
                  <p className="text-sm text-rose-700 p-2 bg-rose-50 rounded-xl">⚠️ Hindari ketidakhadiran tanpa keterangan</p>
                )}
                {parseFloat(totalAttendance as string) > 90 && (
                  <p className="text-sm text-emerald-700 p-2 bg-emerald-50 rounded-xl">✅ Pertahankan kehadiran Anda!</p>
                )}
                {statsHarian.terlambat <= 3 && statsHarian.alfa === 0 && parseFloat(totalAttendance as string) <= 90 && (
                  <p className="text-sm text-sky-700 p-2 bg-sky-50 rounded-xl">📚 Tingkatkan kehadiran untuk hasil lebih baik</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Student Dashboard - Sistem Informasi Akademik
          </p>
        </div>
      </div>
    </div>
  );
}