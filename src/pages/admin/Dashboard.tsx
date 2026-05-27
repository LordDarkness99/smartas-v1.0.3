import { useState, useEffect, useCallback, SVGProps } from "react";
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
  ThumbsUp,
  FileText
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

  // State untuk toggle kategori pie chart
  const [selectedCategories, setSelectedCategories] = useState({
    hadir: true,
    terlambat: true,
    izin: true,
    sakit: true,
    alfa: true,
  });

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== FETCH PRESENSI DATA (dengan semua tanggal dalam rentang) ====================
  const fetchPresensiData = useCallback(async () => {
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
      // Set ke 00:00:00 untuk konsistensi
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      
      const start = startDate.toISOString().split("T")[0];
      const end = endDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("presensi_harian")
        .select("waktu_presensi, status_presensi")
        .gte("waktu_presensi", `${start}T00:00:00`)
        .lte("waktu_presensi", `${end}T23:59:59`);

      if (error) throw error;

      // Map untuk menyimpan data per tanggal
      const presensiMap: Record<string, { hadir: number; terlambat: number; izin: number; sakit: number; alfa: number }> = {};
      
      for (const pres of data || []) {
        const tanggal = new Date(pres.waktu_presensi).toISOString().split("T")[0];
        if (!presensiMap[tanggal]) {
          presensiMap[tanggal] = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
        }
        switch (pres.status_presensi) {
          case "Hadir": presensiMap[tanggal].hadir++; break;
          case "Terlambat": presensiMap[tanggal].terlambat++; break;
          case "Izin": presensiMap[tanggal].izin++; break;
          case "Sakit": presensiMap[tanggal].sakit++; break;
          case "Alfa": presensiMap[tanggal].alfa++; break;
        }
      }

      // Buat seluruh tanggal dalam rentang
      const allDates: string[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        allDates.push(currentDate.toISOString().split("T")[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Gabungkan dengan data presensi (isi 0 jika tidak ada)
      const chartData = allDates.map(tanggal => ({
        tanggal,
        hadir: presensiMap[tanggal]?.hadir || 0,
        terlambat: presensiMap[tanggal]?.terlambat || 0,
        izin: presensiMap[tanggal]?.izin || 0,
        sakit: presensiMap[tanggal]?.sakit || 0,
        alfa: presensiMap[tanggal]?.alfa || 0,
      }));

      // Hitung total summary
      let totalHadir = 0, totalTerlambat = 0, totalIzin = 0, totalSakit = 0, totalAlfa = 0;
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
  }, [periode, fetchPresensiData]);

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
  const categoryLabels = [
    { key: "hadir", label: "Hadir", color: "#10b981" },
    { key: "terlambat", label: "Terlambat", color: "#f59e0b" },
    { key: "izin", label: "Izin", color: "#3b82f6" },
    { key: "sakit", label: "Sakit", color: "#8b5cf6" },
    { key: "alfa", label: "Alfa", color: "#ef4444" },
  ];

  // Filter pie data berdasarkan kategori yang dipilih
  const pieData = categoryLabels
    .filter(cat => selectedCategories[cat.key as keyof typeof selectedCategories])
    .map(cat => ({
      name: cat.label,
      value: summaryPresensi[cat.key as keyof typeof summaryPresensi],
    }))
    .filter(item => item.value > 0);

  const totalPresensi = summaryPresensi.hadir + summaryPresensi.terlambat + summaryPresensi.izin + summaryPresensi.sakit + summaryPresensi.alfa;
  // Perbaikan: kehadiranPersen bertipe number (bukan string)
  const kehadiranPersen = totalPresensi > 0
    ? parseFloat(((summaryPresensi.hadir + summaryPresensi.terlambat) / totalPresensi * 100).toFixed(1))
    : 0;

  // ==================== LOADING STATE ====================
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
      
      {/* HEADER SECTION - gradasi palette */}
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
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
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
                <p className="text-xl font-semibold text-white">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white rounded-xl shadow-md"
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
        
        {/* STATS CARDS - background putih dengan shadow tebal */}
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

        {/* SUMMARY CARD - Header solid #1591DC */}
        <Card className="rounded-xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-5">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Ringkasan Presensi</CardTitle>
                <CardDescription className="text-blue-100 text-xs">
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

        {/* CHARTS GRID */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* LINE CHART CARD - Header solid #4BB8FA */}
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
                        cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
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

          {/* PIE CHART CARD - Interaktif dengan checkbox filter */}
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
              {/* Filter checkboxes */}
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
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        animationDuration={800}
                        animationBegin={0}
                      >
                        {pieData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={categoryLabels.find(c => c.label === entry.name)?.color || COLORS[index % COLORS.length]} 
                            stroke="white"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: 'none', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'white'
                        }}
                        formatter={(value: number, name: string) => [`${value} kali`, name]}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
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

        {/* TIPS SECTION - menggunakan warna palette */}
        <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-[#C4E2F5]/50 to-[#4BB8FA]/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="bg-[#2C5EAD]/10 p-3 rounded-xl">
                <Sparkles className="h-6 w-6 text-[#2C5EAD]" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Informasi Dashboard</h3>
                <p className="text-sm text-slate-600">
                  Dashboard ini menampilkan ringkasan data sekolah, termasuk jumlah siswa, guru, kelas, 
                  dan mata pelajaran. Grafik presensi menunjukkan tren kehadiran siswa dalam periode yang dipilih.
                  Pada diagram lingkaran, Anda dapat memilih kategori yang ingin ditampilkan.
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