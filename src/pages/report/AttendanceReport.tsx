// src/pages/report/AttendanceReport.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, CalendarRange, Printer, Sun, Moon, Cloud, Sparkles, School, BookOpen, Calendar, Activity, TrendingUp, FileText, Users, Search, X, ChevronDown } from "lucide-react";

interface Siswa {
  id_siswa: number;
  nama: string;
  nis: string;
  kelas_nama: string;
}

interface RekapHarian {
  id_siswa: number;
  nama: string;
  nis: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
}

interface RekapMapel {
  id_siswa: number;
  nama: string;
  nis: string;
  mapel_nama: string;
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
}

// Konfigurasi sekolah
const SCHOOL_NAME = "SMK NEGERI 1 CONTOH";
const SCHOOL_ADDRESS = "Jl. Pendidikan No. 123, Kota Contoh, Provinsi Contoh";
const SCHOOL_PHONE = "(021) 1234567";
const SCHOOL_EMAIL = "info@smkn1contoh.sch.id";
const SCHOOL_NPSN = "12345678";

export default function AttendanceReport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  
  const [kelasList, setKelasList] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  
  const [jadwalList, setJadwalList] = useState<{ id_jadwal: number; nama: string; kelas_nama: string }[]>([]);
  const [selectedJadwal, setSelectedJadwal] = useState<string>("");
  
  const [rekapHarian, setRekapHarian] = useState<RekapHarian[]>([]);
  const [rekapMapel, setRekapMapel] = useState<RekapMapel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // State untuk popover filter kelas (harian & mapel)
  const [popoverKelasOpen, setPopoverKelasOpen] = useState(false);
  const [kelasSearchQuery, setKelasSearchQuery] = useState("");
  const [kelasJenjangFilter, setKelasJenjangFilter] = useState<string>("all");

  const filteredKelasOptions = kelasList.filter((kelas) => {
    if (kelasJenjangFilter !== "all") {
      const pattern = new RegExp(`^${kelasJenjangFilter}(\\s|$)`);
      if (!pattern.test(kelas.nama)) return false;
    }
    if (kelasSearchQuery) {
      return kelas.nama.toLowerCase().includes(kelasSearchQuery.toLowerCase());
    }
    return true;
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

  // ==================== FORMAT DATE ====================
  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const fetchKelas = async () => {
    const { data, error } = await supabase
      .from("kelas")
      .select("id_kelas, nama")
      .eq("aktif", true)
      .order("nama");
    if (error) console.error(error);
    else setKelasList(data || []);
  };

  const fetchJadwal = async () => {
    const { data, error } = await supabase
      .from("jadwal")
      .select(`
        id_jadwal,
        mapel:mata_pelajaran (nama),
        kelas:kelas (nama)
      `)
      .eq("aktif", true);
    if (error) console.error(error);
    else {
      const formatted = data.map((item: any) => ({
        id_jadwal: item.id_jadwal,
        nama: item.mapel?.nama || "-",
        kelas_nama: item.kelas?.nama || "-",
      }));
      setJadwalList(formatted);
    }
  };

  useEffect(() => {
    fetchKelas();
    fetchJadwal();
  }, []);

  const generateLaporanHarian = async () => {
    if (!selectedKelas) {
      toast({ title: "Error", description: "Pilih kelas terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const start = `${startDate}T00:00:00`;
      const end = `${endDate}T23:59:59`;
      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_harian")
        .select("id_siswa, status_presensi")
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      if (presensiError) throw presensiError;

      const rekap: RekapHarian[] = siswaData.map((siswa: any) => {
        const siswaPresensi = presensiData?.filter(p => p.id_siswa === siswa.id_siswa) || [];
        return {
          id_siswa: siswa.id_siswa,
          nama: siswa.nama,
          nis: siswa.nis?.toString() || "",
          hadir: siswaPresensi.filter(p => p.status_presensi === "Hadir").length,
          terlambat: siswaPresensi.filter(p => p.status_presensi === "Terlambat").length,
          izin: siswaPresensi.filter(p => p.status_presensi === "Izin").length,
          sakit: siswaPresensi.filter(p => p.status_presensi === "Sakit").length,
          alfa: siswaPresensi.filter(p => p.status_presensi === "Alfa").length,
        };
      });
      setRekapHarian(rekap);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const generateLaporanMapel = async () => {
    if (!selectedKelas) {
      toast({ title: "Error", description: "Pilih kelas terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      let query = supabase
        .from("presensi_siswa_mapel")
        .select(`
          id_siswa,
          status,
          jadwal:jadwal (
            id_jadwal,
            mapel:mata_pelajaran (nama)
          )
        `)
        .gte("waktu_presensi", `${startDate}T00:00:00`)
        .lte("waktu_presensi", `${endDate}T23:59:59`);

      if (selectedJadwal && selectedJadwal !== "all") {
        query = query.eq("jadwal.id_jadwal", parseInt(selectedJadwal));
      }

      const { data: presensiData, error: presensiError } = await query;
      if (presensiError) throw presensiError;

      const mapelMap = new Map<string, { hadir: number; izin: number; sakit: number; alfa: number }>();
      for (const pres of presensiData || []) {
        const mapelNama = pres.jadwal?.mapel?.nama || "Unknown";
        const key = `${pres.id_siswa}_${mapelNama}`;
        if (!mapelMap.has(key)) {
          mapelMap.set(key, { hadir: 0, izin: 0, sakit: 0, alfa: 0 });
        }
        const stat = mapelMap.get(key)!;
        switch (pres.status) {
          case "Hadir": stat.hadir++; break;
          case "Izin": stat.izin++; break;
          case "Sakit": stat.sakit++; break;
          case "Alfa": stat.alfa++; break;
        }
        mapelMap.set(key, stat);
      }

      const rekap: RekapMapel[] = [];
      for (const siswa of siswaData) {
        const studentKeys = Array.from(mapelMap.keys()).filter(k => k.startsWith(`${siswa.id_siswa}_`));
        if (studentKeys.length === 0) {
          rekap.push({
            id_siswa: siswa.id_siswa,
            nama: siswa.nama,
            nis: siswa.nis?.toString() || "",
            mapel_nama: "Tidak ada data",
            hadir: 0,
            izin: 0,
            sakit: 0,
            alfa: 0,
          });
        } else {
          for (const key of studentKeys) {
            const mapelNama = key.split("_")[1];
            const stats = mapelMap.get(key)!;
            rekap.push({
              id_siswa: siswa.id_siswa,
              nama: siswa.nama,
              nis: siswa.nis?.toString() || "",
              mapel_nama: mapelNama,
              hadir: stats.hadir,
              izin: stats.izin,
              sakit: stats.sakit,
              alfa: stats.alfa,
            });
          }
        }
      }
      setRekapMapel(rekap);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const getKelasName = () => {
    const kelas = kelasList.find(k => k.id_kelas.toString() === selectedKelas);
    return kelas?.nama || "";
  };

  // Hitung total keseluruhan untuk tampilan layar
  const totalHadir = rekapHarian.reduce((sum, s) => sum + s.hadir, 0);
  const totalTerlambat = rekapHarian.reduce((sum, s) => sum + s.terlambat, 0);
  const totalIzin = rekapHarian.reduce((sum, s) => sum + s.izin, 0);
  const totalSakit = rekapHarian.reduce((sum, s) => sum + s.sakit, 0);
  const totalAlfa = rekapHarian.reduce((sum, s) => sum + s.alfa, 0);
  const totalPresensi = totalHadir + totalTerlambat + totalIzin + totalSakit + totalAlfa;
  const persenHadir = totalPresensi > 0 ? ((totalHadir + totalTerlambat) / totalPresensi * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 overflow-x-hidden">
      
      {/* HEADER SECTION - Responsif Mobile */}
      <div className="print:hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-2xl backdrop-blur-sm">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-3 w-3 sm:h-4 sm:w-4" /> : 
                   <Cloud className="h-3 w-3 sm:h-4 sm:w-4" />}
                  <p className="text-xs sm:text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold">Laporan Presensi</h1>
                <p className="text-blue-100 text-xs sm:text-sm">
                  Rekap presensi harian dan mata pelajaran dalam rentang waktu tertentu
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-3 py-1 sm:px-4 sm:py-2 backdrop-blur-sm text-center">
                <p className="text-[10px] sm:text-xs text-blue-100">{formatDateHeader(currentTime)}</p>
                <p className="text-base sm:text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 print:px-0 print:py-0">
        
        {/* STATS CARDS - Responsif grid 2 kolom di HP */}
        <div className="print:hidden grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-blue-600 font-medium">Total Kelas</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-900">{kelasList.length}</p>
                </div>
                <School className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Total Mapel</p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-900">{jadwalList.length}</p>
                </div>
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-purple-600 font-medium">Periode</p>
                  <p className="text-[10px] sm:text-xs font-bold text-purple-900">
                    {formatDate(startDate)}<br />s.d.<br />{formatDate(endDate)}
                  </p>
                </div>
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-amber-600 font-medium">Total Presensi</p>
                  <p className="text-lg sm:text-2xl font-bold text-amber-900">{totalPresensi}</p>
                </div>
                <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FILTER CARD - Responsif Mobile dengan Popover untuk Kelas */}
        <div className="print:hidden">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-white/10 p-1.5 sm:p-2 rounded-xl">
                  <CalendarRange className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-xl">Filter Laporan</CardTitle>
                  <CardDescription className="text-slate-300 text-[10px] sm:text-sm">
                    Pilih kriteria untuk menampilkan laporan presensi
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-4 sm:p-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "harian" | "mapel")} className="space-y-4 sm:space-y-6">
                <div className="flex justify-center">
                  <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                    <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-3 sm:px-4 py-1 text-xs sm:text-sm">
                      <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Presensi Harian
                    </TabsTrigger>
                    <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-3 sm:px-4 py-1 text-xs sm:text-sm">
                      <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      Presensi Mapel
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="harian" className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 items-end">
                    {/* Popover untuk pilih kelas */}
                    <div className="w-full sm:w-48">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Kelas</Label>
                      <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1"
                          >
                            {selectedKelas
                              ? kelasList.find(k => k.id_kelas.toString() === selectedKelas)?.nama || "Pilih Kelas"
                              : "Pilih Kelas"}
                            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                          <div className="p-2 border-b bg-slate-50">
                            <div className="flex gap-1 mb-2">
                              {["all", "X", "XI", "XII"].map(jenjang => (
                                <Button
                                  key={jenjang}
                                  variant={kelasJenjangFilter === jenjang ? "default" : "ghost"}
                                  size="sm"
                                  className={`h-7 px-2 text-xs rounded-md ${
                                    kelasJenjangFilter === jenjang
                                      ? "bg-blue-600 text-white"
                                      : "text-slate-600 hover:bg-slate-100"
                                  }`}
                                  onClick={() => setKelasJenjangFilter(jenjang)}
                                >
                                  {jenjang === "all" ? "Semua" : jenjang}
                                </Button>
                              ))}
                            </div>
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                placeholder="Cari kelas..."
                                value={kelasSearchQuery}
                                onChange={(e) => setKelasSearchQuery(e.target.value)}
                                className="pl-7 h-8 text-sm rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {kelasSearchQuery && (
                                <button
                                  onClick={() => setKelasSearchQuery("")}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                >
                                  <X className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filteredKelasOptions.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div>
                            ) : (
                              filteredKelasOptions.map(kelas => (
                                <button
                                  key={kelas.id_kelas}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                    selectedKelas === kelas.id_kelas.toString()
                                      ? "bg-blue-50 text-blue-700 font-medium"
                                      : "text-slate-700"
                                  }`}
                                  onClick={() => {
                                    setSelectedKelas(kelas.id_kelas.toString());
                                    setPopoverKelasOpen(false);
                                    setKelasSearchQuery("");
                                    setKelasJenjangFilter("all");
                                  }}
                                >
                                  {kelas.nama}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-full sm:w-40">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Awal</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-40">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Akhir</Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                      <Button 
                        onClick={generateLaporanHarian} 
                        disabled={isLoading}
                        className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 flex-1 sm:flex-initial"
                      >
                        {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="mr-1.5 h-3.5 w-3.5" />}
                        Tampilkan
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handlePrint} 
                        disabled={rekapHarian.length === 0}
                        className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="mapel" className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 items-end">
                    {/* Popover untuk pilih kelas (sama seperti di atas) */}
                    <div className="w-full sm:w-48">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Kelas</Label>
                      <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1"
                          >
                            {selectedKelas
                              ? kelasList.find(k => k.id_kelas.toString() === selectedKelas)?.nama || "Pilih Kelas"
                              : "Pilih Kelas"}
                            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                          <div className="p-2 border-b bg-slate-50">
                            <div className="flex gap-1 mb-2">
                              {["all", "X", "XI", "XII"].map(jenjang => (
                                <Button
                                  key={jenjang}
                                  variant={kelasJenjangFilter === jenjang ? "default" : "ghost"}
                                  size="sm"
                                  className={`h-7 px-2 text-xs rounded-md ${
                                    kelasJenjangFilter === jenjang
                                      ? "bg-blue-600 text-white"
                                      : "text-slate-600 hover:bg-slate-100"
                                  }`}
                                  onClick={() => setKelasJenjangFilter(jenjang)}
                                >
                                  {jenjang === "all" ? "Semua" : jenjang}
                                </Button>
                              ))}
                            </div>
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                placeholder="Cari kelas..."
                                value={kelasSearchQuery}
                                onChange={(e) => setKelasSearchQuery(e.target.value)}
                                className="pl-7 h-8 text-sm rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {kelasSearchQuery && (
                                <button
                                  onClick={() => setKelasSearchQuery("")}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                >
                                  <X className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filteredKelasOptions.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div>
                            ) : (
                              filteredKelasOptions.map(kelas => (
                                <button
                                  key={kelas.id_kelas}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                    selectedKelas === kelas.id_kelas.toString()
                                      ? "bg-blue-50 text-blue-700 font-medium"
                                      : "text-slate-700"
                                  }`}
                                  onClick={() => {
                                    setSelectedKelas(kelas.id_kelas.toString());
                                    setPopoverKelasOpen(false);
                                    setKelasSearchQuery("");
                                    setKelasJenjangFilter("all");
                                  }}
                                >
                                  {kelas.nama}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-full sm:w-64">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Mata Pelajaran (Opsional)</Label>
                      <Select value={selectedJadwal} onValueChange={setSelectedJadwal}>
                        <SelectTrigger className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="Semua Mapel" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg">
                          <SelectItem value="all">Semua Mata Pelajaran</SelectItem>
                          {jadwalList.map(j => (
                            <SelectItem key={j.id_jadwal} value={j.id_jadwal.toString()}>
                              {j.nama} - {j.kelas_nama}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full sm:w-40">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Awal</Label>
                      <Input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)}
                        className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="w-full sm:w-40">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Akhir</Label>
                      <Input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)}
                        className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                      <Button 
                        onClick={generateLaporanMapel} 
                        disabled={isLoading}
                        className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 flex-1 sm:flex-initial"
                      >
                        {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="mr-1.5 h-3.5 w-3.5" />}
                        Tampilkan
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handlePrint} 
                        disabled={rekapMapel.length === 0}
                        className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-initial"
                      >
                        <Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* SUMMARY CARD - Responsif */}
        {(rekapHarian.length > 0 || rekapMapel.length > 0) && (
          <div className="print:hidden">
            <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-r from-slate-700 to-slate-800 text-white">
              <CardContent className="p-4 sm:p-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-slate-300">Hadir</p>
                    <p className="text-lg sm:text-2xl font-bold text-emerald-300">{totalHadir}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-slate-300">Terlambat</p>
                    <p className="text-lg sm:text-2xl font-bold text-amber-300">{totalTerlambat}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-slate-300">Izin</p>
                    <p className="text-lg sm:text-2xl font-bold text-sky-300">{totalIzin}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-slate-300">Sakit</p>
                    <p className="text-lg sm:text-2xl font-bold text-violet-300">{totalSakit}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-slate-300">Alfa</p>
                    <p className="text-lg sm:text-2xl font-bold text-rose-300">{totalAlfa}</p>
                  </div>
                </div>
                <hr className="my-3 sm:my-4 border-slate-600" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-slate-300" />
                    <span className="text-xs sm:text-sm text-slate-300">Total Kehadiran</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-2xl font-bold text-emerald-300">{persenHadir}%</span>
                    <span className="text-[10px] sm:text-xs text-slate-400">dari {totalPresensi} presensi</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AREA LAPORAN - Tabel dengan overflow-x-auto */}
        {(rekapHarian.length > 0 || rekapMapel.length > 0) && (
          <div className="print:mt-0 print:p-0">
            {/* Header Sekolah untuk cetak */}
            <div className="hidden print:block text-center mb-6" style={{ pageBreakInside: 'avoid' }}>
              <h1 className="text-2xl font-bold uppercase">{SCHOOL_NAME}</h1>
              <p className="text-sm">{SCHOOL_ADDRESS}</p>
              <p className="text-sm">Telp. {SCHOOL_PHONE} | Email: {SCHOOL_EMAIL} | NPSN: {SCHOOL_NPSN}</p>
              <div className="border-t-2 border-black mt-3"></div>
              <div className="border-b border-black"></div>
            </div>

            {/* Judul Laporan - Responsif */}
            <div className="text-center mb-4 print:mb-3">
              <h2 className="text-base sm:text-xl font-bold uppercase">
                {activeTab === "harian" ? "LAPORAN PRESENSI HARIAN" : "LAPORAN PRESENSI MATA PELAJARAN"}
              </h2>
              <p className="text-xs sm:text-sm mt-1">
                Kelas: {getKelasName()} | Periode: {formatDate(startDate)} s.d. {formatDate(endDate)}
              </p>
              {activeTab === "mapel" && selectedJadwal && selectedJadwal !== "all" && (
                <p className="text-xs sm:text-sm">
                  Mata Pelajaran: {jadwalList.find(j => j.id_jadwal.toString() === selectedJadwal)?.nama || "-"}
                </p>
              )}
            </div>

            {/* Tabel Laporan - overflow-x-auto untuk mobile */}
            <div className="border rounded-lg overflow-x-auto print:border-0 print:overflow-visible">
              <Table className="min-w-[700px] print:min-w-full print:w-full print:border-collapse">
                <TableHeader>
                  <TableRow className="bg-slate-50 print:bg-gray-100">
                    <TableHead className="font-semibold print:border print:border-black print:p-2 print:text-center text-xs sm:text-sm">NO</TableHead>
                    <TableHead className="font-semibold print:border print:border-black print:p-2 text-xs sm:text-sm">NIS</TableHead>
                    <TableHead className="font-semibold print:border print:border-black print:p-2 text-xs sm:text-sm">Nama Siswa</TableHead>
                    {activeTab === "harian" ? (
                      <>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Hadir</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Terlambat</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Izin</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Sakit</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Alfa</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Total</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="font-semibold print:border print:border-black print:p-2 text-xs sm:text-sm">Mata Pelajaran</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Hadir</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Izin</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Sakit</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Alfa</TableHead>
                        <TableHead className="font-semibold text-center print:border print:border-black print:p-2 text-xs sm:text-sm">Total</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeTab === "harian" && rekapHarian.map((siswa, index) => {
                    const total = siswa.hadir + siswa.terlambat + siswa.izin + siswa.sakit + siswa.alfa;
                    return (
                      <TableRow key={siswa.id_siswa} className="hover:bg-slate-50 print:hover:bg-transparent">
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs sm:text-sm print:border print:border-black print:p-2">{siswa.nis}</TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm print:border print:border-black print:p-2">{siswa.nama}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{siswa.hadir}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{siswa.terlambat}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{siswa.izin}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{siswa.sakit}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{siswa.alfa}</TableCell>
                        <TableCell className="text-center font-bold print:border print:border-black print:p-2 text-xs sm:text-sm">{total}</TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {activeTab === "mapel" && rekapMapel.map((item, index) => {
                    const total = item.hadir + item.izin + item.sakit + item.alfa;
                    return (
                      <TableRow key={index} className="hover:bg-slate-50 print:hover:bg-transparent">
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{index + 1}</TableCell>
                        <TableCell className="font-mono text-xs sm:text-sm print:border print:border-black print:p-2">{item.nis}</TableCell>
                        <TableCell className="font-medium text-xs sm:text-sm print:border print:border-black print:p-2">{item.nama}</TableCell>
                        <TableCell className="text-xs sm:text-sm print:border print:border-black print:p-2">{item.mapel_nama}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{item.hadir}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{item.izin}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{item.sakit}</TableCell>
                        <TableCell className="text-center print:border print:border-black print:p-2 text-xs sm:text-sm">{item.alfa}</TableCell>
                        <TableCell className="text-center font-bold print:border print:border-black print:p-2 text-xs sm:text-sm">{total}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Footer untuk cetak - DENGAN NAMA USER */}
            <div className="hidden print:block mt-8">
              <div className="flex justify-between mt-12">
                <div className="text-center w-1/2">
                  <p>Mengetahui,</p>
                  <p className="mt-6 font-semibold">Kepala Sekolah</p>
                  <div className="mt-8">
                    <p className="mt-8">_________________________</p>
                    <p className="text-sm">NIP. 196912311997021001</p>
                  </div>
                </div>
                <div className="text-center w-1/2">
                  <p>Petugas,</p>
                  <p className="mt-6 font-semibold">{user?.nama || "Admin / Guru"}</p>
                  <div className="mt-8">
                    <p className="mt-8">_________________________</p>
                    <p className="text-sm">NIP. 197501012005012001</p>
                  </div>
                </div>
              </div>
              <div className="text-center text-xs mt-8">
                <p>Dicetak pada: {new Date().toLocaleString("id-ID")}</p>
              </div>
            </div>
          </div>
        )}

        {/* TIPS SECTION - Responsif */}
        <div className="print:hidden">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 max-w-3xl mx-auto">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="bg-indigo-100 p-2 sm:p-3 rounded-xl flex-shrink-0">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm sm:text-base mb-1">Tips Laporan Presensi</h3>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Pilih kelas dan rentang waktu yang diinginkan, lalu klik tombol "Tampilkan" untuk melihat laporan.
                    Gunakan tombol "Cetak" untuk mencetak laporan dalam format yang rapi.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FOOTER - HANYA UNTUK LAYAR */}
        <div className="print:hidden text-center pt-4">
          <hr className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Laporan Presensi - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Sistem Informasi Akademik
          </p>
        </div>
      </div>

      {/* CSS untuk print - PROFESIONAL TANPA SCROLL */}
      <style>{`
        @media print {
          /* Reset semua margin dan padding */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white;
            font-size: 11pt;
            font-family: 'Times New Roman', Times, serif;
            overflow: visible !important;
          }
          
          /* Sembunyikan semua elemen yang tidak diperlukan saat print */
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          .print\\:mt-0 {
            margin-top: 0 !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .print\\:border-0 {
            border: 0 !important;
          }
          
          .print\\:overflow-visible {
            overflow: visible !important;
          }
          
          /* Hilangkan semua scrollbar */
          ::-webkit-scrollbar {
            display: none !important;
          }
          
          body {
            overflow-y: visible !important;
          }
          
          /* Style tabel untuk cetak profesional */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 0 auto;
            font-size: 10pt;
          }
          
          th, td {
            border: 1px solid #000;
            padding: 6px 8px;
            vertical-align: top;
          }
          
          th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
          }
          
          td {
            text-align: left;
          }
          
          td.text-center {
            text-align: center;
          }
          
          /* Page break handling */
          thead {
            display: table-header-group;
          }
          
          tr {
            page-break-inside: avoid;
          }
          
          /* Ukuran halaman A4 dengan margin standar dokumen */
          @page {
            size: A4;
            margin: 2cm;
          }
        }
      `}</style>
    </div>
  );
}