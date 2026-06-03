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
import {
  Loader2,
  CalendarRange,
  Printer,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  BookOpen,
  Calendar,
  TrendingUp,
  FileText,
  Search,
  X,
  ChevronDown,
  AlertCircle,
  Brain,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
} from "lucide-react";
import { isAdminJurusan, isBK, isAdmin } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

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

interface EvaluasiPembelajaran {
  total_ekspresi: number;
  ekspresi_positif: number;
  ekspresi_negatif: number;
  ekspresi_detail: {
    neutral: number;
    happy: number;
    sad: number;
    angry: number;
    fearful: number;
    disgusted: number;
    surprised: number;
  };
  rekomendasi: "PERTAHANKAN" | "EVALUASI";
  pesan: string;
}

const SCHOOL_NAME = "SMK NEGERI 1 CONTOH";
const SCHOOL_ADDRESS = "Jl. Pendidikan No. 123, Kota Contoh, Provinsi Contoh";
const SCHOOL_PHONE = "(021) 1234567";
const SCHOOL_EMAIL = "info@smkn1contoh.sch.id";
const SCHOOL_NPSN = "12345678";

const EKSPRESI_POSITIF = ["neutral", "happy", "surprised"];
const EKSPRESI_NEGATIF = ["sad", "angry", "fearful", "disgusted"];

export default function AttendanceReport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel" | "evaluasi">("harian");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  
  const [kelasListMapel, setKelasListMapel] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [kelasListHarian, setKelasListHarian] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [kelasListEvaluasi, setKelasListEvaluasi] = useState<{ id_kelas: number; nama: string }[]>([]);
  
  const [selectedKelasHarian, setSelectedKelasHarian] = useState<string>("");
  const [selectedKelasMapel, setSelectedKelasMapel] = useState<string>("");
  const [selectedKelasEvaluasi, setSelectedKelasEvaluasi] = useState<string>("");
  
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  
  // Untuk tab mapel: daftar mata pelajaran unik berdasarkan kelas yang dipilih
  const [mapelOptions, setMapelOptions] = useState<{ nama: string }[]>([]);
  const [selectedMapelNama, setSelectedMapelNama] = useState<string>("");
  
  // State untuk popover mata pelajaran
  const [popoverMapelOpen, setPopoverMapelOpen] = useState(false);
  const [mapelSearchQuery, setMapelSearchQuery] = useState("");
  
  const [rekapHarian, setRekapHarian] = useState<RekapHarian[]>([]);
  const [rekapMapel, setRekapMapel] = useState<RekapMapel[]>([]);
  const [evaluasiPembelajaran, setEvaluasiPembelajaran] = useState<EvaluasiPembelajaran | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [popoverKelasOpen, setPopoverKelasOpen] = useState(false);
  const [kelasSearchQuery, setKelasSearchQuery] = useState("");
  const [kelasJenjangFilter, setKelasJenjangFilter] = useState<string>("all");

  const [waliKelasIds, setWaliKelasIds] = useState<number[]>([]);

  const filterKelasOptions = (kelasList: { id_kelas: number; nama: string }[]) => {
    return kelasList.filter((kelas) => {
      if (kelasJenjangFilter !== "all") {
        const pattern = new RegExp(`^${kelasJenjangFilter}(\\s|$)`);
        if (!pattern.test(kelas.nama)) return false;
      }
      if (kelasSearchQuery) {
        return kelas.nama.toLowerCase().includes(kelasSearchQuery.toLowerCase());
      }
      return true;
    });
  };

  const filteredKelasOptionsHarian = filterKelasOptions(kelasListHarian);
  const filteredKelasOptionsMapel = filterKelasOptions(kelasListMapel);
  const filteredKelasOptionsEvaluasi = filterKelasOptions(kelasListEvaluasi);

  const getKelasNameById = (id_kelas: number, list: { id_kelas: number; nama: string }[]) => {
    const kelas = list.find(k => k.id_kelas === id_kelas);
    return kelas?.nama || "";
  };

  // Fetch daftar mata pelajaran unik untuk kelas yang dipilih (tab mapel)
  useEffect(() => {
    if (!selectedKelasMapel) {
      setMapelOptions([]);
      setSelectedMapelNama("");
      setMapelSearchQuery("");
      return;
    }

    const fetchMapelOptions = async () => {
      const idKelas = parseInt(selectedKelasMapel);
      // Query jadwal untuk kelas tersebut
      let query = supabase
        .from("jadwal")
        .select(`
          id_jadwal,
          mapel:mata_pelajaran (nama)
        `)
        .eq("id_kelas", idKelas)
        .eq("aktif", true);

      // Filter berdasarkan role
      const isAdminRole = isAdmin(user);
      const isBkRole = isBK(user);
      const isAdminJurusanRole = isAdminJurusan(user);
      const isWali = waliKelasIds.includes(idKelas);
      const isGuru = user?.peran === 'guru';

      if (isGuru && !isWali && user?.id_guru) {
        query = query.eq("id_guru", user.id_guru);
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        return;
      }

      // Ambil nama mapel unik (case-insensitive, ambil yang pertama sebagai display)
      const mapelSet = new Map<string, string>();
      for (const item of data || []) {
        const rawNama = item.mapel?.nama;
        if (rawNama) {
          const key = rawNama.trim().toLowerCase();
          if (!mapelSet.has(key)) {
            mapelSet.set(key, rawNama.trim());
          }
        }
      }
      const uniqueMapel = Array.from(mapelSet.values()).sort().map(nama => ({ nama }));
      setMapelOptions(uniqueMapel);
      
      // Reset pilihan mapel jika tidak valid
      if (selectedMapelNama && !uniqueMapel.some(m => m.nama === selectedMapelNama)) {
        setSelectedMapelNama("");
      }
    };

    fetchMapelOptions();
  }, [selectedKelasMapel, user, waliKelasIds]);

  // Greeting effect
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const fetchKelas = async () => {
    if (!user) return;
    if (!user.id_akun) {
      console.error("User tidak memiliki id_akun");
      return;
    }

    const userRole = user.peran;
    const isAdminSuper = isAdmin(user);
    const isAdminJurusanRole = isAdminJurusan(user);
    const isBkRole = isBK(user);
    const isGuruRole = userRole === 'guru';

    if (isGuruRole) {
      if (!user.id_guru) {
        console.error("Guru tidak memiliki id_guru");
        setKelasListMapel([]);
        setKelasListHarian([]);
        setKelasListEvaluasi([]);
        return;
      }

      const id_guru = user.id_guru;

      const { data: waliKelas, error: waliError } = await supabase
        .from("kelas")
        .select("id_kelas, nama")
        .eq("id_guru", id_guru)
        .eq("aktif", true);

      if (waliError) console.error(waliError);
      const waliIds = waliKelas?.map(k => k.id_kelas) || [];
      setWaliKelasIds(waliIds);

      const { data: jadwalKelas, error: jadwalError } = await supabase
        .from("jadwal")
        .select("kelas:id_kelas(id_kelas, nama)")
        .eq("id_guru", id_guru)
        .eq("aktif", true);

      if (jadwalError) console.error(jadwalError);

      const kelasMap = new Map();
      if (waliKelas) {
        waliKelas.forEach(k => kelasMap.set(k.id_kelas, k));
      }
      if (jadwalKelas) {
        jadwalKelas.forEach((item: any) => {
          if (item.kelas) {
            kelasMap.set(item.kelas.id_kelas, {
              id_kelas: item.kelas.id_kelas,
              nama: item.kelas.nama,
            });
          }
        });
      }

      const kelasListUnik = Array.from(kelasMap.values()).sort((a, b) =>
        a.nama.localeCompare(b.nama)
      );
      setKelasListMapel(kelasListUnik);
      setKelasListHarian(waliKelas || []);
      setKelasListEvaluasi(waliKelas || []);
    } else if (isAdminJurusanRole) {
      const { data, error } = await supabase
        .from("kelas")
        .select("id_kelas, nama")
        .eq("id_jurusan", user.id_jurusan)
        .eq("aktif", true)
        .order("nama");
      if (error) console.error(error);
      else {
        setKelasListMapel(data || []);
        setKelasListHarian(data || []);
        setKelasListEvaluasi(data || []);
      }
      setWaliKelasIds([]);
    } else if (isAdminSuper || isBkRole) {
      const { data, error } = await supabase
        .from("kelas")
        .select("id_kelas, nama")
        .eq("aktif", true)
        .order("nama");
      if (error) console.error(error);
      else {
        setKelasListMapel(data || []);
        setKelasListHarian(data || []);
        setKelasListEvaluasi(data || []);
      }
      setWaliKelasIds([]);
    } else {
      setKelasListMapel([]);
      setKelasListHarian([]);
      setKelasListEvaluasi([]);
    }
  };

  useEffect(() => {
    if (selectedKelasHarian && kelasListHarian.length > 0) {
      const isValid = kelasListHarian.some(k => k.id_kelas.toString() === selectedKelasHarian);
      if (!isValid) setSelectedKelasHarian("");
    }
  }, [kelasListHarian, selectedKelasHarian]);

  useEffect(() => {
    if (selectedKelasMapel && kelasListMapel.length > 0) {
      const isValid = kelasListMapel.some(k => k.id_kelas.toString() === selectedKelasMapel);
      if (!isValid) setSelectedKelasMapel("");
    }
  }, [kelasListMapel, selectedKelasMapel]);

  useEffect(() => {
    if (selectedKelasEvaluasi && kelasListEvaluasi.length > 0) {
      const isValid = kelasListEvaluasi.some(k => k.id_kelas.toString() === selectedKelasEvaluasi);
      if (!isValid) setSelectedKelasEvaluasi("");
    }
  }, [kelasListEvaluasi, selectedKelasEvaluasi]);

  useEffect(() => {
    if (user) {
      fetchKelas();
    }
  }, [user]);

  const generateLaporanHarian = async () => {
    if (!selectedKelasHarian) {
      toast({ title: "Error", description: "Pilih kelas terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis")
        .eq("id_kelas", parseInt(selectedKelasHarian))
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
    if (!selectedKelasMapel) {
      toast({ title: "Error", description: "Pilih kelas terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const idKelas = parseInt(selectedKelasMapel);
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis")
        .eq("id_kelas", idKelas)
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      // Query presensi mapel dengan join ke jadwal dan mapel
      let query = supabase
        .from("presensi_siswa_mapel")
        .select(`
          id_siswa,
          status,
          jadwal:jadwal!inner (
            id_jadwal,
            id_kelas,
            mapel:mata_pelajaran (nama)
          )
        `)
        .gte("waktu_presensi", `${startDate}T00:00:00`)
        .lte("waktu_presensi", `${endDate}T23:59:59`)
        .eq("jadwal.id_kelas", idKelas);

      // Filter berdasarkan mata pelajaran yang dipilih (jika bukan "all")
      if (selectedMapelNama && selectedMapelNama !== "all") {
        query = query.eq("jadwal.mapel.nama", selectedMapelNama);
      }

      const { data: presensiData, error: presensiError } = await query;
      if (presensiError) throw presensiError;

      // Akumulasi per siswa dan nama mapel (normalisasi)
      const mapelMap = new Map<string, { hadir: number; izin: number; sakit: number; alfa: number; displayName: string }>();
      
      for (const pres of presensiData || []) {
        const rawMapelName = pres.jadwal?.mapel?.nama;
        if (!rawMapelName) continue; // abaikan presensi tanpa mapel
        
        const normalized = rawMapelName.trim().toLowerCase();
        const key = `${pres.id_siswa}_${normalized}`;
        
        if (!mapelMap.has(key)) {
          mapelMap.set(key, {
            hadir: 0,
            izin: 0,
            sakit: 0,
            alfa: 0,
            displayName: rawMapelName.trim(),
          });
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
            const stats = mapelMap.get(key)!;
            rekap.push({
              id_siswa: siswa.id_siswa,
              nama: siswa.nama,
              nis: siswa.nis?.toString() || "",
              mapel_nama: stats.displayName,
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

  const generateEvaluasiPembelajaran = async () => {
    if (!selectedKelasEvaluasi) {
      toast({ title: "Error", description: "Pilih kelas terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const start = `${startDate}T00:00:00`;
      const end = `${endDate}T23:59:59`;
      
      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_harian")
        .select("id_siswa, ekspresi, status_presensi, waktu_presensi")
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);

      if (presensiError) throw presensiError;

      const { data: siswaKelas, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis")
        .eq("id_kelas", parseInt(selectedKelasEvaluasi))
        .eq("aktif", true);

      if (siswaError) throw siswaError;

      const siswaIds = siswaKelas.map(s => s.id_siswa);
      const presensiKelas = presensiData?.filter(p => siswaIds.includes(p.id_siswa)) || [];

      const ekspresiDetail = {
        neutral: 0,
        happy: 0,
        sad: 0,
        angry: 0,
        fearful: 0,
        disgusted: 0,
        surprised: 0,
      };

      for (const pres of presensiKelas) {
        if (pres.ekspresi && ekspresiDetail.hasOwnProperty(pres.ekspresi)) {
          ekspresiDetail[pres.ekspresi as keyof typeof ekspresiDetail]++;
        }
      }

      const totalEkspresi = Object.values(ekspresiDetail).reduce((a, b) => a + b, 0);
      
      let ekspresiPositif = 0;
      let ekspresiNegatif = 0;

      for (const [ekspresi, count] of Object.entries(ekspresiDetail)) {
        if (EKSPRESI_POSITIF.includes(ekspresi)) {
          ekspresiPositif += count;
        } else if (EKSPRESI_NEGATIF.includes(ekspresi)) {
          ekspresiNegatif += count;
        }
      }

      let rekomendasi: "PERTAHANKAN" | "EVALUASI";
      let pesan: string;

      if (totalEkspresi === 0) {
        rekomendasi = "PERTAHANKAN";
        pesan = "Belum terdapat data ekspresi untuk periode ini. Lanjutkan metode pembelajaran yang ada.";
      } else if (ekspresiPositif > ekspresiNegatif) {
        rekomendasi = "PERTAHANKAN";
        const persenPositif = ((ekspresiPositif / totalEkspresi) * 100).toFixed(1);
        pesan = `Berdasarkan analisis ekspresi wajah siswa, ${persenPositif}% menunjukkan ekspresi positif (${ekspresiPositif} dari ${totalEkspresi} ekspresi). Metode pembelajaran saat ini sudah efektif dan perlu dipertahankan.`;
      } else if (ekspresiNegatif > ekspresiPositif) {
        rekomendasi = "EVALUASI";
        const persenNegatif = ((ekspresiNegatif / totalEkspresi) * 100).toFixed(1);
        pesan = `Peringatan! Berdasarkan analisis ekspresi wajah siswa, ${persenNegatif}% menunjukkan ekspresi negatif (${ekspresiNegatif} dari ${totalEkspresi} ekspresi). Diperlukan evaluasi mendalam terhadap metode pembelajaran.`;
      } else {
        rekomendasi = "EVALUASI";
        pesan = `Hasil ekspresi positif dan negatif seimbang (${ekspresiPositif}:${ekspresiNegatif}). Disarankan untuk melakukan evaluasi dan observasi lebih lanjut terhadap proses pembelajaran.`;
      }

      setEvaluasiPembelajaran({
        total_ekspresi: totalEkspresi,
        ekspresi_positif: ekspresiPositif,
        ekspresi_negatif: ekspresiNegatif,
        ekspresi_detail: ekspresiDetail,
        rekomendasi: rekomendasi,
        pesan: pesan,
      });

      toast({
        title: "Analisis Selesai",
        description: `Evaluasi pembelajaran untuk kelas ${getKelasNameEvaluasi()} telah dianalisis.`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const getKelasNameHarian = () => {
    const kelas = kelasListHarian.find(k => k.id_kelas.toString() === selectedKelasHarian);
    return kelas?.nama || "";
  };

  const getKelasNameMapel = () => {
    const kelas = kelasListMapel.find(k => k.id_kelas.toString() === selectedKelasMapel);
    return kelas?.nama || "";
  };

  const getKelasNameEvaluasi = () => {
    const kelas = kelasListEvaluasi.find(k => k.id_kelas.toString() === selectedKelasEvaluasi);
    return kelas?.nama || "";
  };

  const showAllMapelOption = () => {
    if (!selectedKelasMapel) return false;
    const isAdminRole = isAdmin(user);
    const isBkRole = isBK(user);
    const isAdminJurusanRole = isAdminJurusan(user);
    const isWali = waliKelasIds.includes(parseInt(selectedKelasMapel));
    return isAdminRole || isBkRole || isAdminJurusanRole || isWali;
  };

  const totalHadirHarian = rekapHarian.reduce((sum, s) => sum + s.hadir, 0);
  const totalTerlambat = rekapHarian.reduce((sum, s) => sum + s.terlambat, 0);
  const totalIzinHarian = rekapHarian.reduce((sum, s) => sum + s.izin, 0);
  const totalSakitHarian = rekapHarian.reduce((sum, s) => sum + s.sakit, 0);
  const totalAlfaHarian = rekapHarian.reduce((sum, s) => sum + s.alfa, 0);
  const totalPresensiHarian = totalHadirHarian + totalTerlambat + totalIzinHarian + totalSakitHarian + totalAlfaHarian;
  const persenHadirHarian = totalPresensiHarian > 0 ? ((totalHadirHarian + totalTerlambat) / totalPresensiHarian * 100).toFixed(1) : 0;

  const totalHadirMapel = rekapMapel.reduce((sum, item) => sum + item.hadir, 0);
  const totalIzinMapel = rekapMapel.reduce((sum, item) => sum + item.izin, 0);
  const totalSakitMapel = rekapMapel.reduce((sum, item) => sum + item.sakit, 0);
  const totalAlfaMapel = rekapMapel.reduce((sum, item) => sum + item.alfa, 0);
  const totalPresensiMapel = totalHadirMapel + totalIzinMapel + totalSakitMapel + totalAlfaMapel;
  const persenHadirMapel = totalPresensiMapel > 0 ? ((totalHadirMapel) / totalPresensiMapel * 100).toFixed(1) : 0;

  const userRoleDisplay = () => {
    if (isAdmin(user)) return "Admin";
    if (isBK(user)) return "BK";
    if (isAdminJurusan(user)) return "Admin Jurusan";
    if (user?.peran === "guru") return "Guru";
    return "Pengguna";
  };

  // Filter mapel berdasarkan pencarian
  const filteredMapelOptions = mapelOptions.filter(m =>
    m.nama.toLowerCase().includes(mapelSearchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F0F7FC] overflow-x-hidden">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-xl mx-4 mt-4 print:hidden">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <div className="relative container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-xl backdrop-blur-sm">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  {greeting === "Selamat Pagi" ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-3 w-3 sm:h-4 sm:w-4" /> : 
                   <Cloud className="h-3 w-3 sm:h-4 sm:w-4" />}
                  <p className="text-xs sm:text-sm">{greeting}</p>
                </div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold text-white">Laporan Presensi</h1>
                <p className="text-blue-100 text-xs sm:text-sm">
                  Rekap presensi harian dan mata pelajaran dalam rentang waktu tertentu
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-[#2C5EAD] rounded-xl px-3 py-1 sm:px-4 sm:py-2 text-center shadow-md">
                <p className="text-[10px] sm:text-xs text-white/90">{formatDateHeader(currentTime)}</p>
                <p className="text-base sm:text-xl font-semibold text-white">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8 print:px-0 print:py-0">
        
        {/* Filter Card */}
        <div className="print:hidden">
          <Card className="rounded-xl border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-[#1591DC] text-white p-4 sm:p-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-white/20 p-1.5 sm:p-2 rounded-xl"><CalendarRange className="h-5 w-5 sm:h-6 sm:w-6" /></div>
                <div><CardTitle className="text-base sm:text-xl">Filter Laporan</CardTitle><CardDescription className="text-blue-100 text-[10px] sm:text-sm">Pilih kriteria untuk menampilkan laporan presensi</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "harian" | "mapel" | "evaluasi")} className="space-y-4 sm:space-y-6">
                <div className="flex justify-center">
                  <TabsList className="bg-[#2C5EAD] p-1 rounded-xl">
                    <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-3 sm:px-4 py-1.5 text-xs sm:text-sm gap-2 text-white/80">
                      <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Harian
                    </TabsTrigger>
                    <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-3 sm:px-4 py-1.5 text-xs sm:text-sm gap-2 text-white/80">
                      <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Mapel
                    </TabsTrigger>
                    <TabsTrigger value="evaluasi" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-3 sm:px-4 py-1.5 text-xs sm:text-sm gap-2 text-white/80">
                      <Brain className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Evaluasi Pembelajaran
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab Presensi Harian */}
                <TabsContent value="harian" className="space-y-4 sm:space-y-6">
                  {kelasListHarian.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <p className="text-sm text-amber-700">Anda tidak memiliki akses ke laporan presensi harian.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 items-end">
                      <div className="w-full sm:w-48">
                        <Label className="text-slate-700 text-xs sm:text-sm font-medium">Kelas</Label>
                        <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1">
                              {selectedKelasHarian ? getKelasNameHarian() || "Pilih Kelas" : "Pilih Kelas"}
                              <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                            <div className="p-2 border-b bg-slate-50">
                              <div className="flex gap-1 mb-2">
                                {["all", "X", "XI", "XII"].map(jenjang => (
                                  <Button key={jenjang} variant={kelasJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasJenjangFilter === jenjang ? "bg-[#2C5EAD] text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasJenjangFilter(jenjang)}>
                                    {jenjang === "all" ? "Semua" : jenjang}
                                  </Button>
                                ))}
                              </div>
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input placeholder="Cari kelas..." value={kelasSearchQuery} onChange={(e) => setKelasSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e) => e.stopPropagation()} />
                                {kelasSearchQuery && <button onClick={() => setKelasSearchQuery("")} className="absolute right-2 top-1/2 transform -translate-y-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
                              </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {filteredKelasOptionsHarian.length === 0 ? <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div> : filteredKelasOptionsHarian.map(kelas => (
                                <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelasHarian === kelas.id_kelas.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelasHarian(kelas.id_kelas.toString()); setPopoverKelasOpen(false); setKelasSearchQuery(""); setKelasJenjangFilter("all"); }}>
                                  {kelas.nama}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="w-full sm:w-40"><Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Awal</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm" /></div>
                      <div className="w-full sm:w-40"><Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Akhir</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm" /></div>
                      <div className="flex gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                        <Button onClick={generateLaporanHarian} disabled={isLoading || !selectedKelasHarian} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 flex-1 sm:flex-initial">
                          {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="mr-1.5 h-3.5 w-3.5" />} Tampilkan
                        </Button>
                        <Button variant="outline" onClick={handlePrint} disabled={rekapHarian.length === 0} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-initial border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"><Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak</Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab Presensi Mapel */}
                <TabsContent value="mapel" className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 items-end">
                    <div className="w-full sm:w-48">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Kelas</Label>
                      <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1">
                            {selectedKelasMapel ? getKelasNameMapel() || "Pilih Kelas" : "Pilih Kelas"}
                            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                          <div className="p-2 border-b bg-slate-50">
                            <div className="flex gap-1 mb-2">
                              {["all", "X", "XI", "XII"].map(jenjang => (
                                <Button key={jenjang} variant={kelasJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasJenjangFilter === jenjang ? "bg-[#2C5EAD] text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasJenjangFilter(jenjang)}>
                                  {jenjang === "all" ? "Semua" : jenjang}
                                </Button>
                              ))}
                            </div>
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <Input placeholder="Cari kelas..." value={kelasSearchQuery} onChange={(e) => setKelasSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e) => e.stopPropagation()} />
                              {kelasSearchQuery && <button onClick={() => setKelasSearchQuery("")} className="absolute right-2 top-1/2 transform -translate-y-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filteredKelasOptionsMapel.length === 0 ? <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div> : filteredKelasOptionsMapel.map(kelas => (
                              <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelasMapel === kelas.id_kelas.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelasMapel(kelas.id_kelas.toString()); setPopoverKelasOpen(false); setKelasSearchQuery(""); setKelasJenjangFilter("all"); }}>
                                {kelas.nama}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-full sm:w-64">
                      <Label className="text-slate-700 text-xs sm:text-sm font-medium">Mata Pelajaran (Opsional)</Label>
                      <Popover open={popoverMapelOpen} onOpenChange={setPopoverMapelOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal">
                            {selectedMapelNama ? (selectedMapelNama === "all" ? "Semua Mata Pelajaran" : selectedMapelNama) : "Pilih Mata Pelajaran"}
                            <ChevronDown className="h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start" sideOffset={5}>
                          <div className="p-2 border-b bg-slate-50">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                placeholder="Cari mata pelajaran..."
                                value={mapelSearchQuery}
                                onChange={(e) => setMapelSearchQuery(e.target.value)}
                                className="pl-7 h-8 text-sm rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {mapelSearchQuery && (
                                <button
                                  onClick={() => setMapelSearchQuery("")}
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                >
                                  <X className="h-3.5 w-3.5 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {showAllMapelOption() && (
                              <button
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                  selectedMapelNama === "all" ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : ""
                                }`}
                                onClick={() => {
                                  setSelectedMapelNama("all");
                                  setPopoverMapelOpen(false);
                                  setMapelSearchQuery("");
                                }}
                              >
                                Semua Mata Pelajaran
                              </button>
                            )}
                            {filteredMapelOptions.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-slate-500">
                                Tidak ada mata pelajaran yang cocok
                              </div>
                            ) : (
                              filteredMapelOptions.map((m) => (
                                <button
                                  key={m.nama}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                    selectedMapelNama === m.nama ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : ""
                                  }`}
                                  onClick={() => {
                                    setSelectedMapelNama(m.nama);
                                    setPopoverMapelOpen(false);
                                    setMapelSearchQuery("");
                                  }}
                                >
                                  {m.nama}
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="w-full sm:w-40"><Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Awal</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm" /></div>
                    <div className="w-full sm:w-40"><Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Akhir</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm" /></div>
                    <div className="flex gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                      <Button onClick={generateLaporanMapel} disabled={isLoading || !selectedKelasMapel} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 flex-1 sm:flex-initial">
                        {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CalendarRange className="mr-1.5 h-3.5 w-3.5" />} Tampilkan
                      </Button>
                      <Button variant="outline" onClick={handlePrint} disabled={rekapMapel.length === 0} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-initial border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"><Printer className="mr-1.5 h-3.5 w-3.5" /> Cetak</Button>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab Evaluasi Pembelajaran */}
                <TabsContent value="evaluasi" className="space-y-4 sm:space-y-6">
                  {kelasListEvaluasi.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <p className="text-sm text-amber-700">Anda tidak memiliki akses ke evaluasi pembelajaran.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 items-end">
                        <div className="w-full sm:w-48">
                          <Label className="text-slate-700 text-xs sm:text-sm font-medium">Kelas</Label>
                          <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1">
                                {selectedKelasEvaluasi ? getKelasNameEvaluasi() || "Pilih Kelas" : "Pilih Kelas"}
                                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                              <div className="p-2 border-b bg-slate-50">
                                <div className="flex gap-1 mb-2">
                                  {["all", "X", "XI", "XII"].map(jenjang => (
                                    <Button key={jenjang} variant={kelasJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasJenjangFilter === jenjang ? "bg-[#2C5EAD] text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasJenjangFilter(jenjang)}>
                                      {jenjang === "all" ? "Semua" : jenjang}
                                    </Button>
                                  ))}
                                </div>
                                <div className="relative">
                                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                  <Input placeholder="Cari kelas..." value={kelasSearchQuery} onChange={(e) => setKelasSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e) => e.stopPropagation()} />
                                  {kelasSearchQuery && <button onClick={() => setKelasSearchQuery("")} className="absolute right-2 top-1/2 transform -translate-y-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto">
                                {filteredKelasOptionsEvaluasi.length === 0 ? <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div> : filteredKelasOptionsEvaluasi.map(kelas => (
                                  <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelasEvaluasi === kelas.id_kelas.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelasEvaluasi(kelas.id_kelas.toString()); setPopoverKelasOpen(false); setKelasSearchQuery(""); setKelasJenjangFilter("all"); }}>
                                    {kelas.nama}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="w-full sm:w-40"><Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Awal</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm" /></div>
                        <div className="w-full sm:w-40"><Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal Akhir</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm" /></div>
                        <div className="flex gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
                          <Button onClick={generateEvaluasiPembelajaran} disabled={isLoading || !selectedKelasEvaluasi} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm bg-[#1591DC] hover:bg-[#1591DC]/80 flex-1 sm:flex-initial">
                            {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Brain className="mr-1.5 h-3.5 w-3.5" />} Analisis Ekspresi
                          </Button>
                        </div>
                      </div>

                      {evaluasiPembelajaran && (
                        <div className="mt-6 space-y-4">
                          {/* Rekomendasi Card */}
                          <Card className={`rounded-xl border-0 shadow-lg overflow-hidden ${
                            evaluasiPembelajaran.rekomendasi === "PERTAHANKAN" 
                              ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-l-8 border-l-emerald-500" 
                              : "bg-gradient-to-r from-rose-50 to-orange-50 border-l-8 border-l-rose-500"
                          }`}>
                            <CardContent className="p-5">
                              <div className="flex items-center gap-3 mb-3">
                                {evaluasiPembelajaran.rekomendasi === "PERTAHANKAN" ? (
                                  <ThumbsUp className="h-8 w-8 text-emerald-600" />
                                ) : (
                                  <ThumbsDown className="h-8 w-8 text-rose-600" />
                                )}
                                <h3 className="text-lg font-bold">
                                  Rekomendasi: {evaluasiPembelajaran.rekomendasi === "PERTAHANKAN" ? "Pertahankan Metode Pembelajaran" : "Evaluasi Metode Pembelajaran"}
                                </h3>
                              </div>
                              <p className="text-slate-700 text-sm leading-relaxed">
                                {evaluasiPembelajaran.pesan}
                              </p>
                            </CardContent>
                          </Card>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="rounded-xl border-0 shadow-lg">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4" />
                                  Ringkasan Analisis
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="text-slate-600">Total Ekspresi Terekam</span>
                                  <span className="font-bold text-lg">{evaluasiPembelajaran.total_ekspresi}</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="text-emerald-600 flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" /> Ekspresi Positif
                                  </span>
                                  <span className="font-bold text-emerald-600">{evaluasiPembelajaran.ekspresi_positif}</span>
                                </div>
                                <div className="flex justify-between items-center border-b pb-2">
                                  <span className="text-rose-600 flex items-center gap-1">
                                    <ThumbsDown className="h-3 w-3" /> Ekspresi Negatif
                                  </span>
                                  <span className="font-bold text-rose-600">{evaluasiPembelajaran.ekspresi_negatif}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                  <span className="text-slate-600">Rasio Positif:Negatif</span>
                                  <span className="font-mono font-bold">
                                    {evaluasiPembelajaran.ekspresi_positif}:{evaluasiPembelajaran.ekspresi_negatif}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="rounded-xl border-0 shadow-lg">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <Brain className="h-4 w-4" />
                                  Detail Ekspresi Wajah
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span>😐 Netral</span>
                                    <span className="font-medium">{evaluasiPembelajaran.ekspresi_detail.neutral}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>😊 Bahagia</span>
                                    <span className="font-medium text-emerald-600">{evaluasiPembelajaran.ekspresi_detail.happy}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>😲 Terkejut</span>
                                    <span className="font-medium text-blue-600">{evaluasiPembelajaran.ekspresi_detail.surprised}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>😢 Sedih</span>
                                    <span className="font-medium text-amber-600">{evaluasiPembelajaran.ekspresi_detail.sad}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>😠 Marah</span>
                                    <span className="font-medium text-rose-600">{evaluasiPembelajaran.ekspresi_detail.angry}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>😨 Takut</span>
                                    <span className="font-medium text-purple-600">{evaluasiPembelajaran.ekspresi_detail.fearful}</span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span>🤢 Jijik</span>
                                    <span className="font-medium text-orange-600">{evaluasiPembelajaran.ekspresi_detail.disgusted}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {evaluasiPembelajaran.total_ekspresi > 0 && (
                            <Card className="rounded-xl border-0 shadow-lg">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base">Visualisasi Ekspresi</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-3">
                                  <div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span>Positif ({evaluasiPembelajaran.ekspresi_positif})</span>
                                      <span>{((evaluasiPembelajaran.ekspresi_positif / evaluasiPembelajaran.total_ekspresi) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                      <div 
                                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${(evaluasiPembelajaran.ekspresi_positif / evaluasiPembelajaran.total_ekspresi) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span>Negatif ({evaluasiPembelajaran.ekspresi_negatif})</span>
                                      <span>{((evaluasiPembelajaran.ekspresi_negatif / evaluasiPembelajaran.total_ekspresi) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                      <div 
                                        className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${(evaluasiPembelajaran.ekspresi_negatif / evaluasiPembelajaran.total_ekspresi) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          <div className="flex justify-end">
                            <Button onClick={handlePrint} variant="outline" className="rounded-lg border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                              <Printer className="mr-2 h-4 w-4" /> Cetak Evaluasi
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Summary Card */}
        {((activeTab === "harian" && rekapHarian.length > 0) || (activeTab === "mapel" && rekapMapel.length > 0)) && (
          <div className="print:hidden">
            <Card className="rounded-xl border-0 shadow-lg bg-white">
              <CardContent className="p-4 sm:p-5">
                {activeTab === "harian" ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Hadir</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalHadirHarian}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Terlambat</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalTerlambat}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Izin</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalIzinHarian}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Sakit</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalSakitHarian}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Alfa</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalAlfaHarian}</p>
                      </div>
                    </div>
                    <hr className="my-3 sm:my-4 border-slate-200" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
                        <span className="text-xs sm:text-sm text-slate-600">Total Kehadiran</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-2xl font-bold text-slate-800">{persenHadirHarian}%</span>
                        <span className="text-[10px] sm:text-xs text-slate-400">dari {totalPresensiHarian} presensi</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Hadir</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalHadirMapel}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Izin</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalIzinMapel}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Sakit</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalSakitMapel}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Alfa</p>
                        <p className="text-lg sm:text-2xl font-bold text-slate-800">{totalAlfaMapel}</p>
                      </div>
                    </div>
                    <hr className="my-3 sm:my-4 border-slate-200" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
                        <span className="text-xs sm:text-sm text-slate-600">Tingkat Kehadiran</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg sm:text-2xl font-bold text-slate-800">{persenHadirMapel}%</span>
                        <span className="text-[10px] sm:text-xs text-slate-400">dari {totalPresensiMapel} presensi</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabel Laporan */}
        {(rekapHarian.length > 0 || rekapMapel.length > 0) && activeTab !== "evaluasi" && (
          <div className="print:mt-0 print:p-0">
            <div className="hidden print:block text-center mb-6" style={{ pageBreakInside: 'avoid' }}>
              <h1 className="text-2xl font-bold uppercase">{SCHOOL_NAME}</h1>
              <p className="text-sm">{SCHOOL_ADDRESS}</p>
              <p className="text-sm">Telp. {SCHOOL_PHONE} | Email: {SCHOOL_EMAIL} | NPSN: {SCHOOL_NPSN}</p>
              <div className="border-t-2 border-black mt-3"></div><div className="border-b border-black"></div>
            </div>
            <div className="text-center mb-4 print:mb-3">
              <h2 className="text-base sm:text-xl font-bold uppercase">{activeTab === "harian" ? "LAPORAN PRESENSI HARIAN" : "LAPORAN PRESENSI MATA PELAJARAN"}</h2>
              {activeTab === "harian" ? (
                <p className="text-xs sm:text-sm mt-1">Kelas: {getKelasNameHarian()} | Periode: {formatDate(startDate)} s.d. {formatDate(endDate)}</p>
              ) : (
                <>
                  <p className="text-xs sm:text-sm mt-1">Kelas: {getKelasNameMapel()} | Periode: {formatDate(startDate)} s.d. {formatDate(endDate)}</p>
                  {selectedMapelNama && selectedMapelNama !== "all" && <p className="text-xs sm:text-sm">Mata Pelajaran: {selectedMapelNama}</p>}
                </>
              )}
            </div>
            <div className="border rounded-lg overflow-x-auto print:border-0 print:overflow-visible shadow-sm">
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
            <div className="hidden print:block mt-8">
              <div className="flex justify-between mt-12">
                <div className="text-center w-1/2"><p>Mengetahui,</p><p className="mt-6 font-semibold">Kepala Sekolah</p><div className="mt-8"><p className="mt-8">_________________________</p><p className="text-sm">NIP. 196912311997021001</p></div></div>
                <div className="text-center w-1/2"><p>Petugas,</p><p className="mt-6 font-semibold">{user?.nama || userRoleDisplay()}</p><div className="mt-8"><p className="mt-8">_________________________</p><p className="text-sm">NIP. 197501012005012001</p></div></div>
              </div>
              <div className="text-center text-xs mt-8"><p>Dicetak pada: {new Date().toLocaleString("id-ID")}</p></div>
            </div>
          </div>
        )}

        {evaluasiPembelajaran && activeTab === "evaluasi" && (
          <div className="print:block hidden">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold uppercase">{SCHOOL_NAME}</h1>
              <p className="text-sm">{SCHOOL_ADDRESS}</p>
              <p className="text-sm">Telp. {SCHOOL_PHONE} | Email: {SCHOOL_EMAIL} | NPSN: {SCHOOL_NPSN}</p>
              <div className="border-t-2 border-black mt-3"></div><div className="border-b border-black"></div>
            </div>
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold uppercase">EVALUASI PEMBELAJARAN</h2>
              <p className="text-sm mt-1">Kelas: {getKelasNameEvaluasi()} | Periode: {formatDate(startDate)} s.d. {formatDate(endDate)}</p>
            </div>
            <div className="mb-4 p-4 border rounded-lg">
              <h3 className="font-bold text-lg">Rekomendasi: {evaluasiPembelajaran.rekomendasi === "PERTAHANKAN" ? "Pertahankan Metode Pembelajaran" : "Evaluasi Metode Pembelajaran"}</h3>
              <p className="mt-2">{evaluasiPembelajaran.pesan}</p>
            </div>
            <div className="mb-4">
              <h3 className="font-bold">Ringkasan Analisis</h3>
              <table className="w-full border-collapse mt-2">
                <tbody>
                  <tr><td className="border p-2">Total Ekspresi Terekam</td><td className="border p-2">{evaluasiPembelajaran.total_ekspresi}</td></tr>
                  <tr><td className="border p-2">Ekspresi Positif</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_positif}</td></tr>
                  <tr><td className="border p-2">Ekspresi Negatif</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_negatif}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="font-bold">Detail Ekspresi</h3>
              <table className="w-full border-collapse mt-2">
                <tbody>
                  <tr><td className="border p-2">Netral</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_detail.neutral}</td></tr>
                  <tr><td className="border p-2">Bahagia</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_detail.happy}</td></tr>
                  <tr><td className="border p-2">Terkejut</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_detail.surprised}</td></tr>
                  <tr><td className="border p-2">Sedih</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_detail.sad}</td></tr>
                  <tr><td className="border p-2">Marah</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_detail.angry}</td></tr>
                  <tr><td className="border p-2">Takut</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_detail.fearful}</td></tr>
                  <tr><td className="border p-2">Jijik</td><td className="border p-2">{evaluasiPembelajaran.ekspresi_detail.disgusted}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="flex justify-between mt-8">
              <div className="text-center w-1/2"><p>Mengetahui,</p><p className="mt-6 font-semibold">Kepala Sekolah</p><div className="mt-8"><p className="mt-8">_________________________</p><p className="text-sm">NIP. 196912311997021001</p></div></div>
              <div className="text-center w-1/2"><p>Petugas,</p><p className="mt-6 font-semibold">{user?.nama || userRoleDisplay()}</p><div className="mt-8"><p className="mt-8">_________________________</p><p className="text-sm">NIP. 197501012005012001</p></div></div>
            </div>
          </div>
        )}

        <div className="print:hidden">
          <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-[#C4E2F5]/50 to-[#4BB8FA]/20 max-w-3xl mx-auto">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="bg-[#2C5EAD]/10 p-2 sm:p-3 rounded-xl flex-shrink-0"><Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-[#2C5EAD]" /></div>
                <div><h3 className="font-semibold text-slate-800 text-sm sm:text-base mb-1">Tips Laporan Presensi</h3><p className="text-xs sm:text-sm text-slate-600">Pilih kelas dan rentang waktu yang diinginkan, lalu klik tombol "Tampilkan" untuk melihat laporan. Gunakan tombol "Cetak" untuk mencetak laporan dalam format yang rapi. Fitur Evaluasi Pembelajaran menganalisis ekspresi wajah siswa untuk memberikan rekomendasi metode pembelajaran.</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="print:hidden text-center pt-4"><Separator className="mb-4" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Laporan Presensi - SmartAS</p><p className="text-[10px] text-slate-300 mt-1">Sistem Informasi Akademik</p></div>
      </div>

      <style>{`
        @media print {
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { margin: 0 !important; padding: 0 !important; background: white; font-size: 11pt; font-family: 'Times New Roman', Times, serif; overflow: visible !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:mt-0 { margin-top: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:border-0 { border: 0 !important; }
          .print\\:overflow-visible { overflow: visible !important; }
          ::-webkit-scrollbar { display: none !important; }
          body { overflow-y: visible !important; }
          table { width: 100%; border-collapse: collapse; margin: 0 auto; font-size: 10pt; }
          th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
          td { text-align: left; }
          td.text-center { text-align: center; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          @page { size: A4; margin: 2cm; }
        }
      `}</style>
    </div>
  );
}