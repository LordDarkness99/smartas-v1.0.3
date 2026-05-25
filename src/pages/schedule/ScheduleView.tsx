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
  School,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  List,
  RefreshCw,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  Trophy
} from "lucide-react";

// ----------------------------------------------------------------------
// INTERFACE / TYPE DEFINITIONS
// ----------------------------------------------------------------------

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

// ----------------------------------------------------------------------
// FUNGSI WARNA UNTUK MAPEL (KONSISTEN)
// ----------------------------------------------------------------------
const getColorForMapel = (mapel: string): string => {
  const colorPalette = [
    "border-l-blue-500",
    "border-l-emerald-500",
    "border-l-purple-500",
    "border-l-amber-500",
    "border-l-rose-500",
    "border-l-cyan-500",
    "border-l-indigo-500",
    "border-l-lime-500",
    "border-l-pink-500",
    "border-l-teal-500",
    "border-l-orange-500",
    "border-l-violet-500",
  ];
  let hash = 0;
  for (let i = 0; i < mapel.length; i++) {
    hash = ((hash << 5) - hash) + mapel.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
};

// ----------------------------------------------------------------------
// COMPONENT UTAMA
// ----------------------------------------------------------------------
export default function ScheduleView() {
  const { user } = useAuth();
  const { toast } = useToast();

  // STATE
  const [jadwal, setJadwal] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kelasSiswa, setKelasSiswa] = useState<Kelas | null>(null);
  const [activeDay, setActiveDay] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  
  // Helper functions
  const getCurrentDayInIndonesian = useCallback(() => {
    const date = new Date();
    const dayIndex = date.getDay();
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

  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  const getWaktuStatus = useCallback((jamMulai: string) => {
    const now = new Date();
    const [hour, minute] = jamMulai.split(":").map(Number);
    const jamDate = new Date();
    jamDate.setHours(hour, minute, 0);
    
    if (now > jamDate) {
      return { 
        status: "selesai", 
        bgBadge: "bg-slate-100 text-slate-600",
        icon: <CheckCircle2 className="h-3 w-3" />,
        label: "Selesai"
      };
    }
    const selisih = jamDate.getTime() - now.getTime();
    if (selisih < 3600000) {
      return { 
        status: "sebentar", 
        bgBadge: "bg-amber-100 text-amber-700",
        icon: <AlertCircle className="h-3 w-3" />,
        label: "Segera"
      };
    }
    return { 
      status: "akan datang", 
      bgBadge: "bg-emerald-100 text-emerald-700",
      icon: <Clock className="h-3 w-3" />,
      label: "Akan Datang"
    };
  }, []);

  const jadwalByDay = useCallback((hari: string) => {
    return jadwal.filter(j => j.hari === hari).sort((a, b) => {
      const aStart = a.jam.split(" - ")[0];
      const bStart = b.jam.split(" - ")[0];
      return aStart.localeCompare(bStart);
    });
  }, [jadwal]);

  // Effects (sama seperti sebelumnya)
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const today = getCurrentDayInIndonesian();
    setActiveDay(today === "Minggu" ? "Senin" : today);
  }, [getCurrentDayInIndonesian]);

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

  // --------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#C4E2F5]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#2C5EAD] mx-auto" />
          <p className="text-[#2C5EAD] font-medium">Memuat Jadwal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F7FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        
        {/* HEADER */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-xl">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
          <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-xl backdrop-blur-sm">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                  <span>{greeting}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Jadwal Mata Pelajaran</h1>
                <p className="text-blue-100 text-sm">
                  {user?.peran === "siswa" 
                    ? `Kelas: ${kelasSiswa?.nama || "-"}`
                    : "Jadwal mengajar Anda"}
                </p>
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

        {/* CARD UTAMA JADWAL */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-1.5 sm:p-2 rounded-xl">
                  <School className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-xl text-white">Jadwal Pelajaran</CardTitle>
                  <CardDescription className="text-blue-100 text-xs sm:text-sm">
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
                  className={`rounded-xl text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 transition-all ${
                    viewMode === "table" 
                      ? "bg-white text-[#2C5EAD] shadow-sm" 
                      : "bg-[#2C5EAD] text-white hover:bg-[#2C5EAD]/80"
                  }`}
                  onClick={() => setViewMode("table")}
                >
                  <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Tabel
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`rounded-xl text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 transition-all ${
                    viewMode === "card" 
                      ? "bg-white text-[#2C5EAD] shadow-sm" 
                      : "bg-[#2C5EAD] text-white hover:bg-[#2C5EAD]/80"
                  }`}
                  onClick={() => setViewMode("card")}
                >
                  <List className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Kartu
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-3 sm:p-6">
            <Tabs value={activeDay} onValueChange={setActiveDay} className="space-y-4 sm:space-y-6">
              <TabsList className="bg-[#C4E2F5]/50 p-1 rounded-xl w-full overflow-x-auto flex-nowrap flex h-auto">
                {days.map(day => {
                  const today = getCurrentDayInIndonesian();
                  const isToday = day === today;
                  return (
                    <TabsTrigger 
                      key={day} 
                      value={day}
                      className={`rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                        isToday && activeDay === day ? "ring-2 ring-[#1591DC] ring-offset-1" : ""
                      }`}
                    >
                      {day}
                      {isToday && (
                        <span className="ml-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full animate-pulse" />
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
                  <TabsContent key={day} value={day} className="space-y-3 sm:space-y-4">
                    {isToday && dayJadwal.length > 0 && isActive && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 sm:p-4 border border-emerald-200 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                          <p className="text-xs sm:text-sm text-emerald-700 font-medium">
                            🎉 Hari ini adalah {day}, semangat belajar! 🎉
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {dayJadwal.length === 0 ? (
                      <div className="text-center py-8 sm:py-12">
                        <div className="bg-slate-100 rounded-full w-16 h-16 sm:w-20 sm:h-20 mx-auto flex items-center justify-center mb-3 sm:mb-4">
                          <Calendar className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400" />
                        </div>
                        <p className="text-slate-500 font-medium text-sm sm:text-base">Tidak ada jadwal untuk hari {day}</p>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1">Istirahat atau libur 🎉</p>
                      </div>
                    ) : viewMode === "table" ? (
                      // ========== MODE TABEL DENGAN SPACING & WARNA KONSISTEN ==========
                      <div className="border rounded-xl overflow-hidden shadow-lg">
                        <Table className="min-w-[500px] sm:min-w-full border-collapse">
                          <TableHeader>
                            <TableRow className="bg-slate-100 border-b border-slate-200">
                              <TableHead className="w-28 sm:w-36 font-semibold text-xs sm:text-sm py-4">Jam</TableHead>
                              <TableHead className="font-semibold text-xs sm:text-sm py-4">Mata Pelajaran</TableHead>
                              <TableHead className="font-semibold text-xs sm:text-sm py-4">Guru</TableHead>
                              {user?.peran === "guru" && <TableHead className="font-semibold text-xs sm:text-sm py-4">Kelas</TableHead>}
                              <TableHead className="w-28 sm:w-32 font-semibold text-xs sm:text-sm py-4">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dayJadwal.map((item, idx) => {
                              const jamMulai = item.jam.split(" - ")[0];
                              const waktuStatus = getWaktuStatus(jamMulai);
                              const borderColor = getColorForMapel(item.mata_pelajaran);
                              const isLast = idx === dayJadwal.length - 1;
                              return (
                                <TableRow 
                                  key={item.id_jadwal} 
                                  className={`
                                    relative border-l-[6px] ${borderColor}
                                    ${!isLast ? 'border-b border-gray-100' : ''}
                                    hover:bg-slate-50/80 transition-colors group
                                  `}
                                >
                                  <TableCell className="font-mono text-sm py-4">{item.jam}</TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-blue-100 p-1.5 rounded-lg">
                                        <BookOpen className="h-4 w-4 text-blue-600" />
                                      </div>
                                      <span className="font-medium text-base">{item.mata_pelajaran}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-purple-100 p-1.5 rounded-lg">
                                        <User className="h-4 w-4 text-purple-600" />
                                      </div>
                                      <span className="text-sm">{item.guru}</span>
                                    </div>
                                  </TableCell>
                                  {user?.peran === "guru" && (
                                    <TableCell className="py-4">
                                      <Badge variant="outline" className="rounded-full text-xs px-2 py-0.5">
                                        {item.kelas_nama}
                                      </Badge>
                                    </TableCell>
                                  )}
                                  <TableCell className="py-4">
                                    <Badge className={`${waktuStatus.bgBadge} border-0 rounded-full flex items-center gap-1 w-fit text-xs px-3 py-1`}>
                                      {waktuStatus.icon}
                                      {waktuStatus.label}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      // ========== MODE KARTU ==========
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                        {dayJadwal.map((item) => {
                          const jamMulai = item.jam.split(" - ")[0];
                          const waktuStatus = getWaktuStatus(jamMulai);
                          const borderColor = getColorForMapel(item.mata_pelajaran);
                          return (
                            <div 
                              key={item.id_jadwal} 
                              className={`relative rounded-xl border border-gray-200 bg-white shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden ${borderColor} border-l-[6px]`}
                            >
                              <CardContent className="p-4 sm:p-5">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h4 className="font-bold text-slate-800 text-base sm:text-lg">{item.mata_pelajaran}</h4>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                      <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>{item.jam}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-xs text-slate-500">
                                        <User className="h-3.5 w-3.5" />
                                        <span>{item.guru}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Badge className={`${waktuStatus.bgBadge} border-0 rounded-full text-xs px-2 py-1`}>
                                    {waktuStatus.icon}
                                    <span className="ml-1">{waktuStatus.label}</span>
                                  </Badge>
                                </div>
                                {user?.peran === "guru" && (
                                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-2">
                                    <School className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-xs text-slate-500">Kelas: {item.kelas_nama}</span>
                                  </div>
                                )}
                              </CardContent>
                            </div>
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
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="bg-amber-100 p-2 sm:p-3 rounded-xl">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm sm:text-base mb-1">Tips Belajar Efektif</h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Persiapkan buku dan catatan 10 menit sebelum jam pelajaran dimulai. 
                  Jangan lupa untuk beristirahat sejenak di antara jam pelajaran agar tetap fokus!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-3 sm:pt-4">
          <Separator className="mb-3 sm:mb-4" />
          <p className="text-[10px] sm:text-xs text-slate-400">
            © {new Date().getFullYear()} Jadwal Pelajaran - Sistem Informasi Akademik
          </p>
          <p className="text-[8px] sm:text-[10px] text-slate-300 mt-1">
            Terakhir diperbarui: {currentTime.toLocaleTimeString("id-ID")}
          </p>
        </div>
      </div>
    </div>
  );
}