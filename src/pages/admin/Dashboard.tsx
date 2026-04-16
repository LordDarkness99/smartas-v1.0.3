import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  Trophy,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  GraduationCap,
  Home,
  Briefcase,
  Star,
  Heart,
  Smile,
  ThumbsUp
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts";

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
  const [stats, setStats] = useState({
    siswa: 0,
    guru: 0,
    kelas: 0,
    mapel: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== FETCH STATS ====================
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
  }, [periode]);

  // ==================== FETCH PRESENSI DATA ====================
  const fetchPresensiData = async () => {
    try {
      const now = new Date();
      let startDate: Date;
      if (periode === "minggu") {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
      } else {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      }
      const start = startDate.toISOString().split("T")[0];
      const end = now.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("presensi_harian")
        .select("waktu_presensi, status_presensi")
        .gte("waktu_presensi", `${start}T00:00:00`)
        .lte("waktu_presensi", `${end}T23:59:59`);

      if (error) throw error;

      const grouped: Record<string, { hadir: number; terlambat: number; izin: number; sakit: number; alfa: number }> = {};
      let totalHadir = 0, totalTerlambat = 0, totalIzin = 0, totalSakit = 0, totalAlfa = 0;

      for (const pres of data || []) {
        const tanggal = new Date(pres.waktu_presensi).toISOString().split("T")[0];
        if (!grouped[tanggal]) {
          grouped[tanggal] = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
        }
        switch (pres.status_presensi) {
          case "Hadir": grouped[tanggal].hadir++; totalHadir++; break;
          case "Terlambat": grouped[tanggal].terlambat++; totalTerlambat++; break;
          case "Izin": grouped[tanggal].izin++; totalIzin++; break;
          case "Sakit": grouped[tanggal].sakit++; totalSakit++; break;
          case "Alfa": grouped[tanggal].alfa++; totalAlfa++; break;
        }
      }

      const chartData = Object.entries(grouped).map(([tanggal, counts]) => ({
        tanggal,
        ...counts,
      })).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

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
  };

  // ==================== HANDLE REFRESH ====================
  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchPresensiData()]).finally(() => setRefreshing(false));
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

  // ==================== COLORS ====================
  const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"];

  const pieData = [
    { name: "Hadir", value: summaryPresensi.hadir },
    { name: "Terlambat", value: summaryPresensi.terlambat },
    { name: "Izin", value: summaryPresensi.izin },
    { name: "Sakit", value: summaryPresensi.sakit },
    { name: "Alfa", value: summaryPresensi.alfa },
  ].filter(item => item.value > 0);

  const totalPresensi = summaryPresensi.hadir + summaryPresensi.terlambat + summaryPresensi.izin + summaryPresensi.sakit + summaryPresensi.alfa;
  const kehadiranPersen = totalPresensi > 0 ? ((summaryPresensi.hadir + summaryPresensi.terlambat) / totalPresensi * 100).toFixed(1) : 0;

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse" />
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 relative mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-slate-600 font-medium">Memuat Dashboard Admin</p>
            <div className="flex gap-1 justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
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
              <Avatar className="h-14 w-14 border-2 border-white/30 rounded-2xl">
                <AvatarFallback className="bg-white/20 text-white text-xl font-bold rounded-2xl">
                  {user?.nama?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Dashboard Admin</h1>
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
        
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Siswa</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.siswa}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-xs text-blue-500 mt-1">Siswa aktif</p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Total Guru</p>
                  <p className="text-2xl font-bold text-emerald-900">{stats.guru}</p>
                </div>
                <UserCheck className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-xs text-emerald-500 mt-1">Guru aktif</p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Total Kelas</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.kelas}</p>
                </div>
                <School className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-xs text-purple-500 mt-1">Kelas aktif</p>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Mata Pelajaran</p>
                  <p className="text-2xl font-bold text-amber-900">{stats.mapel}</p>
                </div>
                <BookOpen className="h-8 w-8 text-amber-500" />
              </div>
              <p className="text-xs text-amber-500 mt-1">Total mapel</p>
            </CardContent>
          </Card>
        </div>

        {/* SUMMARY CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Ringkasan Presensi</CardTitle>
                <CardDescription className="text-slate-300 text-xs">
                  {periode === "minggu" ? "7 Hari Terakhir" : "30 Hari Terakhir"}
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
                <TrendingUp className="h-5 w-5 text-slate-600" />
                <span className="text-sm text-slate-600">Total Kehadiran</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-600">{kehadiranPersen}%</span>
                <span className="text-xs text-slate-400">dari {totalPresensi} presensi</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CHARTS GRID */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* LINE CHART CARD */}
          <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
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
                    className={`rounded-lg text-white ${periode === "minggu" ? "bg-white/20" : "bg-white/10"}`}
                  >
                    1 Minggu
                  </Button>
                  <Button
                    onClick={() => setPeriode("bulan")}
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-white ${periode === "bulan" ? "bg-white/20" : "bg-white/10"}`}
                  >
                    1 Bulan
                  </Button>
                </div>
              </div>
              <CardDescription className="text-slate-300 text-xs">
                Grafik perkembangan presensi siswa
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
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'white'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                      <Line type="monotone" dataKey="hadir" stroke="#10b981" name="Hadir" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="terlambat" stroke="#f59e0b" name="Terlambat" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="izin" stroke="#3b82f6" name="Izin" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="sakit" stroke="#8b5cf6" name="Sakit" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="alfa" stroke="#ef4444" name="Alfa" strokeWidth={2} dot={{ r: 3 }} />
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

          {/* PIE CHART CARD */}
          <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-5">
              <div className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                <CardTitle className="text-lg">Distribusi Status Presensi</CardTitle>
              </div>
              <CardDescription className="text-slate-300 text-xs">
                Persentase berdasarkan total presensi
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="h-80">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'white'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <div className="text-center">
                      <PieChartIcon className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                      <p>Belum ada data presensi</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TIPS SECTION */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl">
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Informasi Dashboard</h3>
                <p className="text-sm text-slate-600">
                  Dashboard ini menampilkan ringkasan data sekolah, termasuk jumlah siswa, guru, kelas, 
                  dan mata pelajaran. Grafik presensi menunjukkan tren kehadiran siswa dalam periode yang dipilih.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Dashboard Admin - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Sistem Informasi Akademik
          </p>
        </div>
      </div>
    </div>
  );
}

// Missing FileText component
const FileText = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);