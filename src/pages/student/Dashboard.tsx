import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Loader2, 
  User, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  BookOpen,
  TrendingUp,
  Activity,
  Star,
  FileText,
  School,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  Info,
  GraduationCap,
  Home,
  Briefcase,
  ChevronDown,
  Search
} from "lucide-react";

// Import untuk searchable select
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

// ==================== FUNGSI SINGKAT NAMA MAPEL ====================
const shortenSubjectName = (name: string): string => {
  const shortMap: Record<string, string> = {
    "Pemrograman Web": "Pemweb",
    "Pemrograman Desktop": "Pemdes",
    "Pemrograman Mobile": "Pemob",
    "Basis Data": "Basisdata",
    "Bahasa Inggris": "B.Inggris",
    "Bahasa Indonesia": "B.Indonesia",
    "Matematika": "Mat",
    "Fisika": "Fis",
    "Kimia": "Kim",
    "Biologi": "Bio",
    "Sejarah": "Sej",
    "Geografi": "Geo",
    "Ekonomi": "Eko",
    "Sosiologi": "Sos",
    "Seni Budaya": "Seni",
    "Pendidikan Agama": "PAI",
    "Pendidikan Kewarganegaraan": "PKn",
    "Produktif": "Produktif",
    "Kewirausahaan": "KWU",
    "Simulasi Digital": "Simdig",
    "Komputer dan Jaringan Dasar": "KJD",
    "Sistem Operasi": "SO",
    "Pemrograman Dasar": "Pemdas",
  };
  if (shortMap[name]) return shortMap[name];
  // Jika panjang > 15 karakter, coba ambil akronim dari huruf kapital
  if (name.length > 15) {
    const acronym = name.split(' ').map(word => word[0]?.toUpperCase()).join('');
    if (acronym.length <= 5) return acronym;
  }
  return name;
};

// ==================== SEARCHABLE SELECT COMPONENT ====================
interface SearchableSelectProps {
  items: MataPelajaran[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

function SearchableSelect({ items, value, onValueChange, placeholder = "Pilih Mapel" }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  
  const filteredItems = useMemo(() => {
    if (!search) return items;
    return items.filter(item => 
      item.nama.toLowerCase().includes(search.toLowerCase()) ||
      shortenSubjectName(item.nama).toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);
  
  const selectedItem = items.find(item => item.id_mapel.toString() === value);
  const displayValue = selectedItem ? shortenSubjectName(selectedItem.nama) : "Semua Mata Pelajaran";
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[180px] justify-between bg-[#2C5EAD] text-white border-none hover:bg-[#2C5EAD]/90 focus:ring-0"
        >
          {value === "all" ? "Semua Mapel" : displayValue}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Cari mapel..." className="h-9" />
          <CommandEmpty>Tidak ditemukan.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="all"
              onSelect={() => {
                onValueChange("all");
                setOpen(false);
              }}
              className="cursor-pointer"
            >
              <span>Semua Mata Pelajaran</span>
            </CommandItem>
            {filteredItems.map((item) => (
              <CommandItem
                key={item.id_mapel}
                value={item.id_mapel.toString()}
                onSelect={() => {
                  onValueChange(item.id_mapel.toString());
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <span>{shortenSubjectName(item.nama)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
  
  // STATE (tetap sama)
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

  // Helper functions (sama)
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, []);

  // Greeting effect
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Status styles
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

  // Fetch data (sama, tidak diubah)
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
                uniqueMapel.set(item.mapel.id_mapel, { id_mapel: item.mapel.id_mapel, nama: item.mapel.nama });
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

  const totalAttendance = useMemo(() => {
    const total = statsHarian.hadir + statsHarian.terlambat + statsHarian.izin + statsHarian.sakit + statsHarian.alfa;
    if (total === 0) return 0;
    return ((statsHarian.hadir + statsHarian.terlambat) / total * 100).toFixed(1);
  }, [statsHarian]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const getMapelName = useCallback((mapelId: string): string => {
    if (mapelId === "all") return "semua mata pelajaran";
    const found = mapelList.find(m => m.id_mapel.toString() === mapelId);
    return found ? shortenSubjectName(found.nama) : "mata pelajaran terpilih";
  }, [mapelList]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#C4E2F5]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#2C5EAD] mx-auto" />
          <p className="text-[#2C5EAD] font-medium">Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  // ==================== RENDER UTAMA DENGAN DESAIN BARU ====================
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
                <p className="text-blue-100 text-sm">Dashboard Akademik & Kehadiran</p>
              </div>
            </div>
            {/* Jam dan Refresh dengan background #2C5EAD */}
            <div className="flex items-center gap-3">
              <div className="bg-[#2C5EAD] rounded-xl px-4 py-2 text-center shadow-md">
                <div className="text-xs text-white/90">{formatDate(currentTime)}</div>
                <div className="text-lg font-semibold text-white">{formatTime(currentTime)}</div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white rounded-xl h-10 w-10 shadow-md"
                onClick={handleRefresh}
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* INFO CARDS - Compact */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "NIS", value: siswa?.nis, icon: User, color: "#2C5EAD" },
            { label: "Kelas", value: siswa?.kelas_nama, icon: School, color: "#1591DC" },
            { label: "Status", value: siswa?.id_pkl ? "PKL" : "Sekolah", icon: siswa?.id_pkl ? Briefcase : Home, color: "#4BB8FA" },
            { label: "Kehadiran", value: `${totalAttendance}%`, icon: Activity, color: "#2C5EAD" }
          ].map((item, idx) => (
            <Card key={idx} className="border-0 shadow-md rounded-xl hover:shadow-lg transition-all duration-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                    <p className="text-base sm:text-lg font-bold text-gray-800 truncate">{item.value}</p>
                  </div>
                  <div className="p-2 rounded-full" style={{ backgroundColor: `${item.color}15` }}>
                    <item.icon className="h-5 w-5" style={{ color: item.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* PKL Info */}
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

        {/* DUA CARD STATISTIK UTAMA - Header dengan #1591DC */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Statistik Presensi Harian */}
          <Card className="border-0 shadow-md rounded-xl overflow-hidden">
            <CardHeader className="bg-[#1591DC] text-white pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-white" />
                  <CardTitle className="text-base sm:text-lg text-white">Presensi Harian</CardTitle>
                </div>
                {/* Badge 30 hari terakhir diubah background #2C5EAD */}
                <Badge variant="outline" className="border-white/30 bg-[#2C5EAD] text-white">30 hari terakhir</Badge>
              </div>
              <CardDescription className="text-blue-100">
                Ringkasan kehadiran harian Anda
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { name: "Hadir", value: statsHarian.hadir, icon: CheckCircle, color: "emerald" },
                  { name: "Terlambat", value: statsHarian.terlambat, icon: Clock, color: "amber" },
                  { name: "Izin", value: statsHarian.izin, icon: FileText, color: "sky" },
                  { name: "Sakit", value: statsHarian.sakit, icon: Activity, color: "violet" },
                  { name: "Alfa", value: statsHarian.alfa, icon: XCircle, color: "rose" }
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className={`bg-${item.color}-100 p-2 rounded-xl inline-block w-full`}>
                      <item.icon className={`h-4 w-4 text-${item.color}-600 mx-auto`} />
                      <div className={`text-sm font-bold text-${item.color}-700`}>{item.value}</div>
                    </div>
                    <p className={`text-[10px] font-medium text-${item.color}-600`}>{item.name}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Total Kehadiran Efektif</span>
                  <span className="font-bold text-[#2C5EAD]">{totalAttendance}%</span>
                </div>
                <Progress value={parseFloat(totalAttendance as string)} className="h-2 [&>div]:bg-[#1591DC]" />
              </div>
            </CardContent>
          </Card>

          {/* Statistik Presensi Mata Pelajaran dengan SearchableSelect */}
          <Card className="border-0 shadow-md rounded-xl overflow-hidden">
            <CardHeader className="bg-[#1591DC] text-white pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-white" />
                  <CardTitle className="text-base sm:text-lg text-white">Presensi Mapel</CardTitle>
                </div>
                <SearchableSelect 
                  items={mapelList}
                  value={selectedMapel}
                  onValueChange={setSelectedMapel}
                  placeholder="Pilih Mapel"
                />
              </div>
              <CardDescription className="text-blue-100">
                Ringkasan per mata pelajaran (30 hari)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { name: "Hadir", value: statsMapel.hadir, icon: CheckCircle, color: "emerald" },
                  { name: "Izin", value: statsMapel.izin, icon: FileText, color: "sky" },
                  { name: "Sakit", value: statsMapel.sakit, icon: Activity, color: "violet" },
                  { name: "Alfa", value: statsMapel.alfa, icon: XCircle, color: "rose" }
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className={`bg-${item.color}-100 p-2 rounded-xl`}>
                      <item.icon className={`h-4 w-4 text-${item.color}-600 mx-auto`} />
                      <div className={`text-sm font-bold text-${item.color}-700`}>{item.value}</div>
                    </div>
                    <p className={`text-[10px] font-medium text-${item.color}-600`}>{item.name}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#C4E2F5]/30 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-600 flex items-center justify-center gap-1">
                  <Info className="h-3 w-3" /> Menampilkan data untuk {getMapelName(selectedMapel)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* TABEL RIWAYAT DENGAN TABS - Background tabs diubah menjadi #2C5EAD */}
        <Tabs defaultValue="harian" className="space-y-4">
          <div className="flex justify-center">
            <TabsList className="bg-[#2C5EAD] p-1 rounded-xl">
              <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-4 py-1.5 text-sm gap-2 text-white/80">
                <Calendar className="h-4 w-4" /> Riwayat Harian
              </TabsTrigger>
              <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-4 py-1.5 text-sm gap-2 text-white/80">
                <BookOpen className="h-4 w-4" /> Riwayat Mapel
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB PRESENSI HARIAN TERBARU - Header #4BB8FA */}
          <TabsContent value="harian">
            <Card className="border-0 shadow-md rounded-xl overflow-hidden">
              <CardHeader className="bg-[#4BB8FA] text-white pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <Clock className="h-4 w-4 text-white" /> Presensi Harian Terbaru
                </CardTitle>
                <CardDescription className="text-blue-50">
                  5 data terakhir dari 30 hari
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentHarian.map((p, idx) => (
                        <TableRow key={idx} className="hover:bg-gray-50/50">
                          <TableCell className="text-sm">{p.tanggal}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(p.status)} border-0 rounded-full px-2 py-0.5 text-xs flex items-center gap-1 w-fit`}>
                              {getStatusIcon(p.status)} {p.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.waktu}</TableCell>
                        </TableRow>
                      ))}
                      {recentHarian.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-6 text-gray-500">Belum ada data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB PRESENSI MAPEL TERBARU - Header #4BB8FA */}
          <TabsContent value="mapel">
            <Card className="border-0 shadow-md rounded-xl overflow-hidden">
              <CardHeader className="bg-[#4BB8FA] text-white pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <BookOpen className="h-4 w-4 text-white" /> Presensi Mapel Terbaru
                </CardTitle>
                <CardDescription className="text-blue-50">
                  5 data terakhir untuk {getMapelName(selectedMapel)}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs font-semibold">Tanggal</TableHead>
                        <TableHead className="text-xs font-semibold">Mata Pelajaran</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentMapel.map((p, idx) => (
                        <TableRow key={idx} className="hover:bg-gray-50/50">
                          <TableCell className="text-sm">{p.tanggal}</TableCell>
                          <TableCell className="text-sm">{shortenSubjectName(p.mapel)}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(p.status)} border-0 rounded-full px-2 py-0.5 text-xs flex items-center gap-1 w-fit`}>
                              {getStatusIcon(p.status)} {p.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {recentMapel.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center py-6 text-gray-500">Belum ada data</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* BOTTOM CARDS: Pencapaian & Rekomendasi */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-md rounded-xl bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-5 w-5 text-[#1591DC]" /> Pencapaian
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#C4E2F5]/30 rounded-xl">
                <span className="text-sm font-medium">Kehadiran &gt; 90%</span>
                {parseFloat(totalAttendance as string) > 90 ? 
                  <CheckCircle className="h-5 w-5 text-emerald-500" /> : 
                  <Clock className="h-5 w-5 text-amber-500" />
                }
              </div>
              <div className="flex items-center justify-between p-3 bg-[#C4E2F5]/30 rounded-xl">
                <span className="text-sm font-medium">Tidak Ada Alfa</span>
                {statsHarian.alfa === 0 ? 
                  <CheckCircle className="h-5 w-5 text-emerald-500" /> : 
                  <XCircle className="h-5 w-5 text-rose-500" />
                }
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md rounded-xl bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#1591DC]" /> Rekomendasi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {statsHarian.terlambat > 3 && (
                  <p className="text-sm text-amber-700 p-2 bg-amber-50 rounded-lg">⚠️ Tingkatkan kedisiplinan waktu datang</p>
                )}
                {statsHarian.alfa > 0 && (
                  <p className="text-sm text-rose-700 p-2 bg-rose-50 rounded-lg">⚠️ Hindari ketidakhadiran tanpa keterangan</p>
                )}
                {parseFloat(totalAttendance as string) > 90 && (
                  <p className="text-sm text-emerald-700 p-2 bg-emerald-50 rounded-lg">✅ Pertahankan kehadiran Anda!</p>
                )}
                {statsHarian.terlambat <= 3 && statsHarian.alfa === 0 && parseFloat(totalAttendance as string) <= 90 && (
                  <p className="text-sm text-sky-700 p-2 bg-sky-50 rounded-lg">📚 Tingkatkan kehadiran untuk hasil lebih baik</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Student Dashboard - Sistem Informasi Akademik</p>
        </div>
      </div>
    </div>
  );
}