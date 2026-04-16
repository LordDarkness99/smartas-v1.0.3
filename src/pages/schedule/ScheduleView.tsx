import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Calendar, 
  BookOpen, 
  User, 
  Clock, 
  MapPin,
  ChevronLeft,
  ChevronRight,
  School,
  Bell,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Timer,
  Users,
  LayoutGrid,
  List,
  Download,
  Share2,
  Printer,
  RefreshCw,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  Trophy,
  Award,
  Star,
  Heart,
  ThumbsUp,
  Smile,
  Coffee,
  Home,
  Briefcase,
  TrendingUp,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  FileText,
  Mail,
  Phone,
  MapPinIcon,
  Globe,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Github,
  Gitlab,
  Figma,
  Slack,
  Discord,
  Zoom,
  Google,
  Apple,
  Windows,
  Linux,
  Android,
  Ios,
  Chrome,
  Firefox,
  Safari,
  Edge,
  Opera
} from "lucide-react";

interface JadwalItem {
  id_jadwal: number;
  hari: string;
  jam: string;
  mata_pelajaran: string;
  guru: string;
  id_kelas: number;
  kelas_nama: string;
}

interface Kelas {
  id_kelas: number;
  nama: string;
}

interface StatistikJadwal {
  totalMapel: number;
  totalJam: number;
  hariTersibuk: string;
  jamTersibuk: string;
}

export default function ScheduleView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jadwal, setJadwal] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kelasSiswa, setKelasSiswa] = useState<Kelas | null>(null);
  const [activeDay, setActiveDay] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  // Mapping hari Indonesia ke bahasa Indonesia
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  
  // Mapping dari Date API ke hari Indonesia
  const getCurrentDayInIndonesian = useCallback(() => {
    const date = new Date();
    const dayIndex = date.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    const dayMap: Record<number, string> = {
      0: "Minggu",
      1: "Senin",
      2: "Selasa",
      3: "Rabu",
      4: "Kamis",
      5: "Jumat",
      6: "Sabtu"
    };
    return dayMap[dayIndex];
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

  // ==================== SET ACTIVE DAY BASED ON CURRENT DAY ====================
  useEffect(() => {
    const today = getCurrentDayInIndonesian();
    // Jika hari ini adalah Minggu, set ke Senin (karena biasanya tidak ada jadwal Minggu)
    if (today === "Minggu") {
      setActiveDay("Senin");
    } else {
      setActiveDay(today);
    }
  }, [getCurrentDayInIndonesian]);

  // ==================== FETCH SCHEDULE (SAMA PERSIS DENGAN ASLI) ====================
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!user) return;
      setLoading(true);
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

        if (user.peran === "siswa") {
          const { data: siswa, error: siswaError } = await supabase
            .from("siswa")
            .select("id_kelas, kelas:kelas(id_kelas, nama)")
            .eq("id_siswa", user.id_siswa)
            .single();
          if (siswaError) throw siswaError;
          if (siswa.id_kelas) {
            setKelasSiswa({ id_kelas: siswa.id_kelas, nama: siswa.kelas?.nama || "-" });
            query = query.eq("id_kelas", siswa.id_kelas);
          } else {
            setJadwal([]);
            setLoading(false);
            return;
          }
        } else if (user.peran === "guru" && user.id_guru) {
          query = query.eq("id_guru", user.id_guru);
        }

        const { data, error } = await query.order("jam");
        if (error) throw error;

        const formatted: JadwalItem[] = data.map((item: any) => ({
          id_jadwal: item.id_jadwal,
          hari: item.hari,
          jam: item.jam,
          mata_pelajaran: item.mapel?.nama || "-",
          guru: item.guru?.nama || "-",
          id_kelas: item.id_kelas,
          kelas_nama: item.kelas?.nama || "-",
        }));
        setJadwal(formatted);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [user, toast]);

  // ==================== STATISTICS ====================
  const statistik = useMemo<StatistikJadwal>(() => {
    const mapelSet = new Set(jadwal.map(j => j.mata_pelajaran));
    const totalJam = jadwal.length;
    
    const hariCount: Record<string, number> = {};
    const jamCount: Record<string, number> = {};
    
    jadwal.forEach(j => {
      hariCount[j.hari] = (hariCount[j.hari] || 0) + 1;
      const jamMulai = j.jam.split(" - ")[0];
      jamCount[jamMulai] = (jamCount[jamMulai] || 0) + 1;
    });
    
    const hariTersibuk = Object.entries(hariCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
    const jamTersibuk = Object.entries(jamCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
    
    return {
      totalMapel: mapelSet.size,
      totalJam,
      hariTersibuk,
      jamTersibuk
    };
  }, [jadwal]);

  // ==================== FILTER JADWAL (SAMA PERSIS DENGAN ASLI) ====================
  const jadwalByDay = useCallback((hari: string) => {
    return jadwal.filter(j => j.hari === hari).sort((a, b) => {
      const aStart = a.jam.split(" - ")[0];
      const bStart = b.jam.split(" - ")[0];
      return aStart.localeCompare(bStart);
    });
  }, [jadwal]);

  // ==================== HANDLE REFRESH ====================
  const handleRefresh = async () => {
    setRefreshing(true);
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

      if (user?.peran === "siswa" && kelasSiswa) {
        query = query.eq("id_kelas", kelasSiswa.id_kelas);
      } else if (user?.peran === "guru" && user.id_guru) {
        query = query.eq("id_guru", user.id_guru);
      }

      const { data, error } = await query.order("jam");
      if (error) throw error;

      const formatted: JadwalItem[] = data.map((item: any) => ({
        id_jadwal: item.id_jadwal,
        hari: item.hari,
        jam: item.jam,
        mata_pelajaran: item.mapel?.nama || "-",
        guru: item.guru?.nama || "-",
        id_kelas: item.id_kelas,
        kelas_nama: item.kelas?.nama || "-",
      }));
      setJadwal(formatted);
      toast({ title: "Berhasil", description: "Jadwal telah diperbarui", variant: "default" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  // ==================== GET STATUS WAKTU ====================
  const getWaktuStatus = useCallback((jamMulai: string) => {
    const now = new Date();
    const [hour, minute] = jamMulai.split(":").map(Number);
    const jamDate = new Date();
    jamDate.setHours(hour, minute, 0);
    
    if (now > jamDate) {
      return { status: "selesai", color: "bg-slate-100 text-slate-500", icon: <CheckCircle2 className="h-3 w-3" /> };
    }
    const selisih = jamDate.getTime() - now.getTime();
    if (selisih < 3600000) {
      return { status: "sebentar", color: "bg-amber-100 text-amber-700", icon: <AlertCircle className="h-3 w-3" /> };
    }
    return { status: "akan datang", color: "bg-emerald-100 text-emerald-700", icon: <Clock className="h-3 w-3" /> };
  }, []);

  // ==================== FORMAT DATE ====================
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500">Memuat Jadwal...</p>
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
                <h1 className="text-2xl lg:text-3xl font-bold">Jadwal Mata Pelajaran</h1>
                <p className="text-blue-100 text-sm">
                  {user?.peran === "siswa" 
                    ? `Kelas: ${kelasSiswa?.nama || "-"}`
                    : "Jadwal mengajar Anda"}
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
        
        {/* STATISTICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Mata Pelajaran</p>
                  <p className="text-2xl font-bold text-blue-900">{statistik.totalMapel}</p>
                </div>
                <BookOpen className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Total Jam Pelajaran</p>
                  <p className="text-2xl font-bold text-emerald-900">{statistik.totalJam}</p>
                </div>
                <Timer className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Hari Tersibuk</p>
                  <p className="text-xl font-bold text-purple-900">{statistik.hariTersibuk}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Jam Tersibuk</p>
                  <p className="text-xl font-bold text-amber-900">{statistik.jamTersibuk}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN SCHEDULE CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-xl">
                  <School className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Jadwal Pelajaran</CardTitle>
                  <CardDescription className="text-slate-300 text-sm">
                    {user?.peran === "siswa" 
                      ? `Jadwal untuk kelas ${kelasSiswa?.nama}`
                      : "Jadwal mengajar Anda"}
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`rounded-xl ${viewMode === "table" ? "bg-white/20" : "bg-white/10"}`}
                  onClick={() => setViewMode("table")}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Tabel
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`rounded-xl ${viewMode === "card" ? "bg-white/20" : "bg-white/10"}`}
                  onClick={() => setViewMode("card")}
                >
                  <List className="h-4 w-4 mr-1" />
                  Kartu
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <Tabs value={activeDay} onValueChange={setActiveDay} className="space-y-6">
              <TabsList className="bg-slate-100 p-1 rounded-xl w-full overflow-x-auto flex-wrap h-auto">
                {days.map(day => {
                  const today = getCurrentDayInIndonesian();
                  const isToday = day === today;
                  return (
                    <TabsTrigger 
                      key={day} 
                      value={day}
                      className={`rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2 transition-all duration-200 ${
                        isToday && activeDay === day ? "ring-2 ring-blue-400 ring-offset-1" : ""
                      }`}
                    >
                      {day}
                      {isToday && (
                        <span className="ml-1.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              
              {days.map(day => {
                const dayJadwal = jadwalByDay(day);
                const today = getCurrentDayInIndonesian();
                const isToday = day === today;
                const isActive = activeDay === day;
                
                return (
                  <TabsContent key={day} value={day} className="space-y-4">
                    {isToday && dayJadwal.length > 0 && isActive && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-emerald-600" />
                          <p className="text-sm text-emerald-700 font-medium">
                            🎉 Hari ini adalah {day}, semangat belajar! 🎉
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {dayJadwal.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="bg-slate-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4">
                          <Calendar className="h-10 w-10 text-slate-400" />
                        </div>
                        <p className="text-slate-500 font-medium">Tidak ada jadwal untuk hari {day}</p>
                        <p className="text-slate-400 text-sm mt-1">Istirahat atau libur 🎉</p>
                      </div>
                    ) : viewMode === "table" ? (
                      // TABLE VIEW
                      <div className="border rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="w-32 font-semibold">Jam</TableHead>
                              <TableHead className="font-semibold">Mata Pelajaran</TableHead>
                              <TableHead className="font-semibold">Guru</TableHead>
                              {user?.peran === "guru" && <TableHead className="font-semibold">Kelas</TableHead>}
                              <TableHead className="w-24 font-semibold">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dayJadwal.map((item) => {
                              const jamMulai = item.jam.split(" - ")[0];
                              const waktuStatus = getWaktuStatus(jamMulai);
                              return (
                                <TableRow key={item.id_jadwal} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="font-mono text-sm font-medium">{item.jam}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="bg-blue-100 p-1.5 rounded-lg">
                                        <BookOpen className="h-4 w-4 text-blue-600" />
                                      </div>
                                      <span className="font-medium">{item.mata_pelajaran}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="bg-purple-100 p-1.5 rounded-lg">
                                        <User className="h-4 w-4 text-purple-600" />
                                      </div>
                                      <span>{item.guru}</span>
                                    </div>
                                  </TableCell>
                                  {user?.peran === "guru" && (
                                    <TableCell>
                                      <Badge variant="outline" className="rounded-full">
                                        {item.kelas_nama}
                                      </Badge>
                                    </TableCell>
                                  )}
                                  <TableCell>
                                    <Badge className={`${waktuStatus.color} border-0 rounded-full flex items-center gap-1 w-fit text-xs`}>
                                      {waktuStatus.icon}
                                      {waktuStatus.status === "sebentar" ? "Segera" : 
                                       waktuStatus.status === "selesai" ? "Selesai" : "Akan Datang"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      // CARD VIEW
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {dayJadwal.map((item) => {
                          const jamMulai = item.jam.split(" - ")[0];
                          const waktuStatus = getWaktuStatus(jamMulai);
                          return (
                            <Card key={item.id_jadwal} className="rounded-xl border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group">
                              <div className={`absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rounded-full ${waktuStatus.color} opacity-20 group-hover:scale-150 transition-transform duration-500`} />
                              <CardContent className="p-4 relative z-10">
                                <div className="flex items-start justify-between mb-3">
                                  <Badge className={`${waktuStatus.color} border-0 rounded-full text-xs`}>
                                    {waktuStatus.icon}
                                    <span className="ml-1">
                                      {waktuStatus.status === "sebentar" ? "Segera" : 
                                       waktuStatus.status === "selesai" ? "Selesai" : "Akan Datang"}
                                    </span>
                                  </Badge>
                                  <span className="font-mono text-sm font-bold text-slate-700">{item.jam}</span>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-blue-100 p-2 rounded-xl">
                                      <BookOpen className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <span className="font-semibold text-slate-800">{item.mata_pelajaran}</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <div className="bg-purple-100 p-2 rounded-xl">
                                      <User className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <span className="text-sm text-slate-600">{item.guru}</span>
                                  </div>
                                  
                                  {user?.peran === "guru" && (
                                    <div className="flex items-center gap-2">
                                      <div className="bg-emerald-100 p-2 rounded-xl">
                                        <School className="h-4 w-4 text-emerald-600" />
                                      </div>
                                      <span className="text-sm text-slate-600">{item.kelas_nama}</span>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <Trophy className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Tips Belajar Efektif</h3>
                <p className="text-sm text-slate-600">
                  Persiapkan buku dan catatan 10 menit sebelum jam pelajaran dimulai. 
                  Jangan lupa untuk beristirahat sejenak di antara jam pelajaran agar tetap fokus!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Jadwal Pelajaran - Sistem Informasi Akademik
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Terakhir diperbarui: {currentTime.toLocaleTimeString("id-ID")}
          </p>
        </div>
      </div>
    </div>
  );
}