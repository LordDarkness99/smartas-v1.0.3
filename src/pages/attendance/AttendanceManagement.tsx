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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  RefreshCw,
  Calendar,
  BookOpen,
  QrCode,
  Download,
  Sun,
  Moon,
  Cloud,
  Users,
  School,
  GraduationCap,
  UserCheck,
  AlertCircle,
  Sparkles,
  Search,
  X,
  ChevronDown,
} from "lucide-react";
import QRCode from "qrcode";

interface Siswa {
  id_siswa: number;
  nama: string;
  nis: string;
  id_kelas: number;
  kelas_nama: string;
  id_pkl: number | null;
}

interface PresensiHarian {
  id_pres_harian: number;
  id_siswa: number;
  status_presensi: string;
  waktu_presensi: string;
  siswa?: Siswa;
}

interface Jadwal {
  id_jadwal: number;
  hari: string;
  jam: string;
  mata_pelajaran: string;
  guru: string;
  id_guru: number; // tambahan
  id_kelas: number;
  kelas_nama: string;
}

interface PresensiMapel {
  id_pre_siswa: number;
  id_siswa: number;
  id_jadwal: number;
  status: string;
  waktu_presensi: string;
  siswa?: Siswa;
}

const STATUS_HARIAN_SEKOLAH = ["Hadir", "Terlambat", "Izin", "Sakit", "Alfa"];
const STATUS_HARIAN_PKL = ["Hadir", "Izin", "Sakit", "Alfa"];
const STATUS_MAPEL = ["Hadir", "Izin", "Sakit", "Alfa"];

const parseTimeRange = (jamStr: string) => {
  const [start, end] = jamStr.split(" - ");
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return { startMin: toMinutes(start), endMin: toMinutes(end) };
};

export default function AttendanceManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);

  // State untuk daftar kelas (dipisah antara harian dan mapel)
  const [kelasListHarian, setKelasListHarian] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [kelasListMapel, setKelasListMapel] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [selectedKelasHarian, setSelectedKelasHarian] = useState<string>("");
  const [selectedKelasMapel, setSelectedKelasMapel] = useState<string>("");
  const [waliKelasIds, setWaliKelasIds] = useState<number[]>([]);

  const [selectedTanggal, setSelectedTanggal] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [presensiHarian, setPresensiHarian] = useState<PresensiHarian[]>([]);
  const [isFetchingHarian, setIsFetchingHarian] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<{ id: number; type: string } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [selectedBulkStatus, setSelectedBulkStatus] = useState<string | null>(null);
  const [autoAlfaProcessedHarian, setAutoAlfaProcessedHarian] = useState(false);

  const [popoverHarianOpen, setPopoverHarianOpen] = useState(false);
  const [kelasHarianSearchQuery, setKelasHarianSearchQuery] = useState("");
  const [kelasHarianJenjangFilter, setKelasHarianJenjangFilter] = useState<string>("all");

  const filteredKelasHarianOptions = kelasListHarian.filter((kelas) => {
    if (kelasHarianJenjangFilter !== "all") {
      const pattern = new RegExp(`^${kelasHarianJenjangFilter}(\\s|$)`);
      if (!pattern.test(kelas.nama)) return false;
    }
    if (kelasHarianSearchQuery) {
      return kelas.nama.toLowerCase().includes(kelasHarianSearchQuery.toLowerCase());
    }
    return true;
  });

  // State Presensi Mapel
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [filteredJadwalList, setFilteredJadwalList] = useState<Jadwal[]>([]);
  const [selectedJadwal, setSelectedJadwal] = useState<Jadwal | null>(null);
  const [presensiMapel, setPresensiMapel] = useState<PresensiMapel[]>([]);
  const [isFetchingMapel, setIsFetchingMapel] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [selectedJadwalForQR, setSelectedJadwalForQR] = useState<Jadwal | null>(null);
  const [isBulkUpdatingMapel, setIsBulkUpdatingMapel] = useState(false);
  const [selectedBulkStatusMapel, setSelectedBulkStatusMapel] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [autoAlfaProcessedMapel, setAutoAlfaProcessedMapel] = useState(false);

  const [qrRefreshInterval, setQrRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const [popoverMapelOpen, setPopoverMapelOpen] = useState(false);
  const [kelasMapelSearchQuery, setKelasMapelSearchQuery] = useState("");
  const [kelasMapelJenjangFilter, setKelasMapelJenjangFilter] = useState<string>("all");

  const filteredKelasMapelOptions = kelasListMapel.filter((kelas) => {
    if (kelasMapelJenjangFilter !== "all") {
      const pattern = new RegExp(`^${kelasMapelJenjangFilter}(\\s|$)`);
      if (!pattern.test(kelas.nama)) return false;
    }
    if (kelasMapelSearchQuery) {
      return kelas.nama.toLowerCase().includes(kelasMapelSearchQuery.toLowerCase());
    }
    return true;
  });

  // Greeting & clock
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Fetch kelas berdasarkan role (untuk kedua tab)
  const fetchKelas = async () => {
    if (!user) return;
    if (!user.id_akun) {
      console.error("User tidak memiliki id_akun");
      return;
    }

    const userRole = user.peran;

    if (userRole === 'guru') {
      if (!user.id_guru) {
        console.error("Guru tidak memiliki id_guru");
        setKelasListHarian([]);
        setKelasListMapel([]);
        setWaliKelasIds([]);
        return;
      }

      const id_guru = user.id_guru;

      // 1. Kelas sebagai wali kelas
      const { data: waliKelas, error: waliError } = await supabase
        .from("kelas")
        .select("id_kelas, nama")
        .eq("id_guru", id_guru)
        .eq("aktif", true);
      if (waliError) console.error(waliError);
      const waliIds = waliKelas?.map(k => k.id_kelas) || [];
      setWaliKelasIds(waliIds);

      // 2. Kelas yang diampu melalui jadwal
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
    } else {
      // Admin: ambil semua kelas aktif
      const { data, error } = await supabase
        .from("kelas")
        .select("id_kelas, nama")
        .eq("aktif", true)
        .order("nama");
      if (error) console.error(error);
      else {
        setKelasListMapel(data || []);
        setKelasListHarian(data || []);
      }
      setWaliKelasIds([]);
    }
  };

  // Reset pilihan kelas jika tidak valid
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

  // Fetch jadwal dengan akses wali kelas
  const fetchJadwal = async () => {
    if (!user) return;
    try {
      let query = supabase
        .from("jadwal")
        .select(`
          id_jadwal,
          id_guru,
          hari,
          jam,
          id_kelas,
          kelas:kelas (nama),
          mapel:mata_pelajaran (nama),
          guru:guru (nama)
        `)
        .eq("aktif", true);

      if (user.peran === "guru" && user.id_guru) {
        // Ambil id_kelas yang menjadi wali
        const { data: waliKelas, error: waliError } = await supabase
          .from("kelas")
          .select("id_kelas")
          .eq("id_guru", user.id_guru)
          .eq("aktif", true);
        const waliIds = waliKelas?.map(k => k.id_kelas) || [];

        // Ambil id_kelas yang diampu (dari jadwal yang id_guru-nya sama)
        const { data: diampuKelas, error: diampuError } = await supabase
          .from("jadwal")
          .select("id_kelas")
          .eq("id_guru", user.id_guru)
          .eq("aktif", true);
        const diampuIds = diampuKelas?.map(j => j.id_kelas) || [];

        const allowedKelasIds = [...new Set([...waliIds, ...diampuIds])];
        if (allowedKelasIds.length > 0) {
          query = query.in("id_kelas", allowedKelasIds);
        } else {
          setJadwalList([]);
          return;
        }
      }

      const { data, error } = await query.order("hari").order("jam");
      if (error) throw error;
      const formatted: Jadwal[] = data.map((item: any) => ({
        id_jadwal: item.id_jadwal,
        id_guru: item.id_guru,
        hari: item.hari,
        jam: item.jam,
        mata_pelajaran: item.mapel?.nama || "-",
        guru: item.guru?.nama || "-",
        id_kelas: item.id_kelas,
        kelas_nama: item.kelas?.nama || "-",
      }));
      setJadwalList(formatted);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Filter jadwal berdasarkan kelas dan role
  useEffect(() => {
    if (!selectedKelasMapel) {
      setFilteredJadwalList([]);
      setSelectedJadwal(null);
      setSelectedDay("");
      return;
    }

    const kelasId = parseInt(selectedKelasMapel);
    let filtered = jadwalList.filter(j => j.id_kelas === kelasId);

    // Jika guru dan bukan wali kelas untuk kelas ini, hanya tampilkan mapel yang diampu
    if (user?.peran === 'guru' && !waliKelasIds.includes(kelasId)) {
      filtered = filtered.filter(j => j.id_guru === user.id_guru);
    }

    setFilteredJadwalList(filtered);
    setSelectedJadwal(null);
    setSelectedDay("");
  }, [selectedKelasMapel, jadwalList, user, waliKelasIds]);

  const uniqueDays = Array.from(new Set(filteredJadwalList.map((j) => j.hari))).sort((a, b) => {
    const dayOrder: Record<string, number> = {
      Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 0,
    };
    return (dayOrder[a] ?? 0) - (dayOrder[b] ?? 0);
  });

  const jadwalByDay = selectedDay ? filteredJadwalList.filter((j) => j.hari === selectedDay) : [];

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchKelas();
      await fetchJadwal();
      setLoading(false);
    };
    init();
  }, []);

  // Presensi Harian
  const fetchPresensiHarian = async (skipAutoAlfa = false) => {
    if (!selectedKelasHarian) return;
    setIsFetchingHarian(true);
    setSelectedBulkStatus(null);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, id_pkl, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(selectedKelasHarian))
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const siswaList: Siswa[] = siswaData.map((s: any) => ({
        id_siswa: s.id_siswa,
        nama: s.nama,
        nis: s.nis?.toString() || "",
        id_kelas: s.id_kelas,
        kelas_nama: s.kelas?.nama || "-",
        id_pkl: s.id_pkl,
      }));

      const startDate = `${selectedTanggal}T00:00:00`;
      const endDate = `${selectedTanggal}T23:59:59`;
      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_harian")
        .select("*")
        .gte("waktu_presensi", startDate)
        .lte("waktu_presensi", endDate);
      if (presensiError) throw presensiError;

      const combined = siswaList.map((siswa) => {
        const existing = presensiData?.find((p) => p.id_siswa === siswa.id_siswa);
        return {
          id_pres_harian: existing?.id_pres_harian || null,
          id_siswa: siswa.id_siswa,
          status_presensi: existing?.status_presensi || null,
          waktu_presensi: existing?.waktu_presensi || null,
          siswa: siswa,
        };
      });
      setPresensiHarian(combined);

      if (!skipAutoAlfa && !autoAlfaProcessedHarian && combined.some(p => !p.status_presensi)) {
        setAutoAlfaProcessedHarian(true);
        const belumAbsen = combined.filter(p => !p.status_presensi);
        for (const item of belumAbsen) {
          if (!item.id_pres_harian) {
            await supabase.from("presensi_harian").insert({
              id_siswa: item.id_siswa,
              status_presensi: "Alfa",
              waktu_presensi: new Date().toISOString(),
            });
          }
        }
        await fetchPresensiHarian(true);
        toast({ title: "Info", description: "Siswa yang belum absen otomatis diisi Alfa" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingHarian(false);
    }
  };

  const updatePresensiHarian = async (siswaId: number, currentAttendance: any, newStatus: string) => {
    setUpdatingStatus({ id: siswaId, type: "harian" });
    try {
      if (currentAttendance.id_pres_harian) {
        await supabase
          .from("presensi_harian")
          .update({ status_presensi: newStatus, waktu_presensi: new Date().toISOString() })
          .eq("id_pres_harian", currentAttendance.id_pres_harian);
      } else {
        await supabase.from("presensi_harian").insert({
          id_siswa: siswaId,
          status_presensi: newStatus,
          waktu_presensi: new Date().toISOString(),
        });
      }
      setPresensiHarian((prev) =>
        prev.map((item) =>
          item.id_siswa === siswaId
            ? { ...item, status_presensi: newStatus, waktu_presensi: new Date().toISOString() }
            : item
        )
      );
      toast({ title: "Berhasil", description: "Status presensi diperbarui" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleBulkCheckbox = async (status: string) => {
    if (selectedBulkStatus === status) return;
    setSelectedBulkStatus(status);
    setIsBulkUpdating(true);
    try {
      for (const item of presensiHarian) {
        const isPKL = item.siswa?.id_pkl !== null;
        const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
        if (availableStatus.includes(status)) {
          if (item.id_pres_harian) {
            await supabase
              .from("presensi_harian")
              .update({ status_presensi: status, waktu_presensi: new Date().toISOString() })
              .eq("id_pres_harian", item.id_pres_harian);
          } else {
            await supabase.from("presensi_harian").insert({
              id_siswa: item.id_siswa,
              status_presensi: status,
              waktu_presensi: new Date().toISOString(),
            });
          }
        }
      }
      setPresensiHarian((prev) =>
        prev.map((item) => {
          const isPKL = item.siswa?.id_pkl !== null;
          const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
          if (availableStatus.includes(status)) {
            return { ...item, status_presensi: status, waktu_presensi: new Date().toISOString() };
          }
          return item;
        })
      );
      toast({ title: "Berhasil", description: `Semua siswa telah diubah menjadi ${status}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Presensi Mapel
  const fetchPresensiMapel = async (skipAutoAlfa = false) => {
    if (!selectedJadwal) return;
    setIsFetchingMapel(true);
    setSelectedBulkStatusMapel(null);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, kelas:kelas(nama)")
        .eq("id_kelas", selectedJadwal.id_kelas)
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const siswaList: Siswa[] = siswaData.map((s: any) => ({
        id_siswa: s.id_siswa,
        nama: s.nama,
        nis: s.nis?.toString() || "",
        id_kelas: s.id_kelas,
        kelas_nama: s.kelas?.nama || "-",
        id_pkl: null,
      }));

      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_siswa_mapel")
        .select("*")
        .eq("id_jadwal", selectedJadwal.id_jadwal);
      if (presensiError) throw presensiError;

      const combined = siswaList.map((siswa) => {
        const existing = presensiData?.find((p) => p.id_siswa === siswa.id_siswa);
        return {
          id_pre_siswa: existing?.id_pre_siswa || null,
          id_siswa: siswa.id_siswa,
          id_jadwal: selectedJadwal.id_jadwal,
          status: existing?.status || null,
          waktu_presensi: existing?.waktu_presensi || null,
          siswa: siswa,
        };
      });
      setPresensiMapel(combined);

      if (!skipAutoAlfa && !autoAlfaProcessedMapel && combined.some(p => !p.status)) {
        setAutoAlfaProcessedMapel(true);
        const belumAbsen = combined.filter(p => !p.status);
        for (const item of belumAbsen) {
          if (item.id_pre_siswa) {
            await supabase
              .from("presensi_siswa_mapel")
              .update({ status: "Alfa", waktu_presensi: new Date().toISOString() })
              .eq("id_pre_siswa", item.id_pre_siswa);
          } else {
            await supabase.from("presensi_siswa_mapel").insert({
              id_siswa: item.id_siswa,
              id_jadwal: item.id_jadwal,
              status: "Alfa",
              waktu_presensi: new Date().toISOString(),
            });
          }
        }
        await fetchPresensiMapel(true);
        toast({ title: "Info", description: "Siswa yang tidak scan QR otomatis diisi Alfa" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingMapel(false);
    }
  };

  const updatePresensiMapel = async (siswaId: number, currentAttendance: any, newStatus: string) => {
    setUpdatingStatus({ id: siswaId, type: "mapel" });
    try {
      if (currentAttendance.id_pre_siswa) {
        await supabase
          .from("presensi_siswa_mapel")
          .update({ status: newStatus, waktu_presensi: new Date().toISOString() })
          .eq("id_pre_siswa", currentAttendance.id_pre_siswa);
      } else {
        await supabase.from("presensi_siswa_mapel").insert({
          id_siswa: siswaId,
          id_jadwal: currentAttendance.id_jadwal,
          status: newStatus,
          waktu_presensi: new Date().toISOString(),
        });
      }
      setPresensiMapel((prev) =>
        prev.map((item) =>
          item.id_siswa === siswaId
            ? { ...item, status: newStatus, waktu_presensi: new Date().toISOString() }
            : item
        )
      );
      toast({ title: "Berhasil", description: "Status presensi diperbarui" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleBulkCheckboxMapel = async (status: string) => {
    if (selectedBulkStatusMapel === status) return;
    setSelectedBulkStatusMapel(status);
    setIsBulkUpdatingMapel(true);
    try {
      for (const item of presensiMapel) {
        if (item.id_pre_siswa) {
          await supabase
            .from("presensi_siswa_mapel")
            .update({ status: status, waktu_presensi: new Date().toISOString() })
            .eq("id_pre_siswa", item.id_pre_siswa);
        } else {
          await supabase.from("presensi_siswa_mapel").insert({
            id_siswa: item.id_siswa,
            id_jadwal: item.id_jadwal,
            status: status,
            waktu_presensi: new Date().toISOString(),
          });
        }
      }
      setPresensiMapel((prev) =>
        prev.map((item) => ({
          ...item,
          status: status,
          waktu_presensi: new Date().toISOString(),
        }))
      );
      toast({ title: "Berhasil", description: `Semua siswa telah diubah menjadi ${status}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkUpdatingMapel(false);
    }
  };

  // QR Dinamis
  const generateQRCode = async (jadwal: Jadwal) => {
    const daysMap: Record<string, number> = {
      Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 0,
    };
    const now = new Date();
    const currentDay = now.getDay();
    const expectedDay = daysMap[jadwal.hari];
    if (currentDay !== expectedDay) {
      toast({
        title: "Tidak dapat generate QR",
        description: `QR Code hanya dapat digenerate pada hari ${jadwal.hari} (hari ini ${now.toLocaleDateString("id-ID", { weekday: "long" })})`,
        variant: "destructive",
      });
      return;
    }
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const { startMin, endMin } = parseTimeRange(jadwal.jam);
    const tolerance = 15;
    if (currentMinutes < startMin - tolerance) {
      toast({
        title: "Terlalu awal",
        description: `QR Code dapat digenerate mulai ${tolerance} menit sebelum jadwal dimulai (${jadwal.jam})`,
        variant: "destructive",
      });
      return;
    }
    if (currentMinutes > endMin + tolerance) {
      toast({
        title: "Waktu habis",
        description: `QR Code tidak dapat digenerate lagi karena sudah melewati ${tolerance} menit setelah jadwal berakhir (${jadwal.jam})`,
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingQR(true);
    setSelectedJadwalForQR(jadwal);
    setQrDialogOpen(true);

    if (qrRefreshInterval) clearInterval(qrRefreshInterval);

    const updateQR = async () => {
      const nonce = crypto.randomUUID();
      const exp = Date.now() + 30000;
      const payload = { id_jadwal: jadwal.id_jadwal, nonce, exp };

      try {
        await supabase.from("active_qr_nonce").insert({
          nonce: nonce,
          id_jadwal: jadwal.id_jadwal,
          expires_at: new Date(exp).toISOString(),
          used: false,
        });
        const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));
        setQrCodeDataUrl(qrDataUrl);
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Gagal generate QR Code", variant: "destructive" });
      }
    };

    await updateQR();
    const interval = setInterval(updateQR, 30000);
    setQrRefreshInterval(interval);
    setIsGeneratingQR(false);
  };

  useEffect(() => {
    return () => {
      if (qrRefreshInterval) clearInterval(qrRefreshInterval);
    };
  }, [qrRefreshInterval]);

  // Auto-fetch ketika kelas/tanggal/jadwal berubah
  useEffect(() => {
    if (activeTab === "harian" && selectedKelasHarian) {
      setAutoAlfaProcessedHarian(false);
      fetchPresensiHarian();
    }
  }, [selectedKelasHarian, selectedTanggal, activeTab]);

  useEffect(() => {
    if (activeTab === "mapel" && selectedJadwal) {
      setAutoAlfaProcessedMapel(false);
      fetchPresensiMapel();
    }
  }, [selectedJadwal, activeTab]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500">Memuat Manajemen Presensi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-2xl backdrop-blur-sm"><Calendar className="h-6 w-6 sm:h-8 sm:w-8" /></div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-3 w-3 sm:h-4 sm:w-4" /> : <Cloud className="h-3 w-3 sm:h-4 sm:w-4" />}
                  <p className="text-xs sm:text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold leading-tight">Manajemen Presensi</h1>
                <p className="text-blue-100 text-xs sm:text-sm">Kelola presensi harian dan presensi mata pelajaran siswa</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-3 py-1 sm:px-4 sm:py-2 backdrop-blur-sm text-center">
                <p className="text-[10px] sm:text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-base sm:text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-blue-600 font-medium">Total Kelas (Mapel)</p><p className="text-lg sm:text-2xl font-bold text-blue-900">{kelasListMapel.length}</p></div><School className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" /></div></CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Total Jadwal</p><p className="text-lg sm:text-2xl font-bold text-emerald-900">{jadwalList.length}</p></div><BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500" /></div></CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-purple-600 font-medium">Status</p><p className="text-lg sm:text-xl font-bold text-purple-900">Aktif</p></div><UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" /></div></CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-amber-600 font-medium">Role</p><p className="text-lg sm:text-xl font-bold text-amber-900">{user?.peran === "guru" ? "Guru" : "Admin"}</p></div><GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" /></div></CardContent>
          </Card>
        </div>

        {/* MAIN CARD */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3"><div className="bg-white/10 p-1.5 sm:p-2 rounded-xl"><Users className="h-5 w-5" /></div><div><CardTitle className="text-base sm:text-lg">Manajemen Presensi</CardTitle><CardDescription className="text-slate-300 text-xs">Kelola presensi harian dan presensi mata pelajaran siswa</CardDescription></div></div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4 sm:space-y-5">
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-3 sm:px-4 py-1 text-xs sm:text-sm"><Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Presensi Harian</TabsTrigger>
                  <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-3 sm:px-4 py-1 text-xs sm:text-sm"><BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Presensi Mapel</TabsTrigger>
                </TabsList>
              </div>

              {/* TAB PRESENSI HARIAN */}
              <TabsContent value="harian" className="space-y-4 sm:space-y-5">
                {user?.peran === 'guru' && kelasListHarian.length === 0 ? (
                  <Alert className="rounded-lg bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-xs sm:text-sm">
                      Anda tidak memiliki akses ke presensi harian karena hanya wali kelas yang dapat mengelola presensi harian.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <div className="w-full sm:w-56">
                        <Label className="text-slate-700 text-xs sm:text-sm font-medium">Kelas</Label>
                        <Popover open={popoverHarianOpen} onOpenChange={setPopoverHarianOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1">
                              {selectedKelasHarian ? kelasListHarian.find(k => k.id_kelas.toString() === selectedKelasHarian)?.nama || "Pilih Kelas" : "Pilih Kelas"}
                              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                            <div className="p-2 border-b bg-slate-50">
                              <div className="flex gap-1 mb-2 flex-wrap">
                                {["all", "X", "XI", "XII"].map(jenjang => (
                                  <Button key={jenjang} variant={kelasHarianJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasHarianJenjangFilter === jenjang ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasHarianJenjangFilter(jenjang)}>
                                    {jenjang === "all" ? "Semua" : jenjang}
                                  </Button>
                                ))}
                              </div>
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input placeholder="Cari kelas..." value={kelasHarianSearchQuery} onChange={(e) => setKelasHarianSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e) => e.stopPropagation()} />
                                {kelasHarianSearchQuery && <button onClick={() => setKelasHarianSearchQuery("")} className="absolute right-2 top-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
                              </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {filteredKelasHarianOptions.length === 0 ? (
                                <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div>
                              ) : (
                                filteredKelasHarianOptions.map(kelas => (
                                  <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelasHarian === kelas.id_kelas.toString() ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelasHarian(kelas.id_kelas.toString()); setPopoverHarianOpen(false); setKelasHarianSearchQuery(""); setKelasHarianJenjangFilter("all"); }}>
                                    {kelas.nama}
                                  </button>
                                ))
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex gap-3 items-end">
                        <div className="flex-1 sm:w-40">
                          <Label className="text-slate-700 text-xs sm:text-sm font-medium">Tanggal</Label>
                          <Input type="date" value={selectedTanggal} onChange={(e) => setSelectedTanggal(e.target.value)} className="rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm w-full" />
                        </div>
                        <Button variant="outline" onClick={() => fetchPresensiHarian()} disabled={!selectedKelasHarian || isFetchingHarian} className="rounded-lg h-8 sm:h-9 px-3 text-xs sm:text-sm shrink-0">
                          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingHarian ? "animate-spin" : ""}`} /> Refresh
                        </Button>
                      </div>
                    </div>

                    {!selectedKelasHarian && (
                      <Alert className="rounded-lg bg-amber-50 border-amber-200">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700 text-xs sm:text-sm">Silakan pilih kelas terlebih dahulu</AlertDescription>
                      </Alert>
                    )}

                    {selectedKelasHarian && (
                      <div className="border rounded-lg overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <Table className="w-full">
                            <TableHeader>
                              <TableRow className="bg-slate-50">
                                <TableHead className="font-semibold text-center text-xs sm:text-sm w-24">NIS</TableHead>
                                <TableHead className="font-semibold text-center text-xs sm:text-sm min-w-[140px]">Nama Siswa</TableHead>
                                <TableHead className="font-semibold text-center text-xs sm:text-sm w-28">Status PKL</TableHead>
                                {STATUS_HARIAN_SEKOLAH.map(status => (
                                  <TableHead key={status} className="text-center font-semibold text-xs sm:text-sm min-w-[80px]">
                                    <div className="flex flex-col items-center gap-1">
                                      <span>{status}</span>
                                      <Checkbox checked={selectedBulkStatus === status} onCheckedChange={() => handleBulkCheckbox(status)} disabled={isBulkUpdating} className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </div>
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isFetchingHarian ? (
                                <TableRow><TableCell colSpan={3 + STATUS_HARIAN_SEKOLAH.length} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
                              ) : presensiHarian.length === 0 ? (
                                <TableRow><TableCell colSpan={3 + STATUS_HARIAN_SEKOLAH.length} className="text-center py-10 text-slate-500 text-xs sm:text-sm">Tidak ada data siswa</TableCell></TableRow>
                              ) : (
                                presensiHarian.map((item) => {
                                  const isPKL = item.siswa?.id_pkl !== null;
                                  const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
                                  return (
                                    <TableRow key={item.id_siswa} className="hover:bg-slate-50 transition-colors">
                                      <TableCell className="text-center font-mono text-xs sm:text-sm">{item.siswa?.nis}</TableCell>
                                      <TableCell className="text-center text-xs sm:text-sm font-medium">{item.siswa?.nama}</TableCell>
                                      <TableCell className="text-center">
                                        {isPKL ? <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-blue-100 text-blue-700">PKL</span> : <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-green-100 text-green-700">Sekolah</span>}
                                      </TableCell>
                                      {STATUS_HARIAN_SEKOLAH.map(status => {
                                        if (!availableStatus.includes(status)) return <TableCell key={status} className="text-center bg-slate-50/30"></TableCell>;
                                        return (
                                          <TableCell key={status} className="text-center align-middle">
                                            <div className="flex justify-center items-center">
                                              <RadioGroup value={item.status_presensi || ""} onValueChange={(val) => updatePresensiHarian(item.id_siswa, item, val)} disabled={updatingStatus?.id === item.id_siswa && updatingStatus?.type === "harian"} className="flex justify-center">
                                                <RadioGroupItem value={status} id={`harian-${item.id_siswa}-${status}`} className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                              </RadioGroup>
                                            </div>
                                          </TableCell>
                                        );
                                      })}
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* TAB PRESENSI MAPEL */}
              <TabsContent value="mapel" className="space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="w-full sm:w-64 flex-shrink-0">
                    <Label className="text-slate-700 text-xs sm:text-sm font-medium">Pilih Kelas</Label>
                    <Popover open={popoverMapelOpen} onOpenChange={setPopoverMapelOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1">
                          {selectedKelasMapel ? kelasListMapel.find(k => k.id_kelas.toString() === selectedKelasMapel)?.nama || "Pilih Kelas" : "Pilih Kelas"}
                          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                        <div className="p-2 border-b bg-slate-50">
                          <div className="flex gap-1 mb-2 flex-wrap">
                            {["all", "X", "XI", "XII"].map(jenjang => (
                              <Button key={jenjang} variant={kelasMapelJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasMapelJenjangFilter === jenjang ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasMapelJenjangFilter(jenjang)}>
                                {jenjang === "all" ? "Semua" : jenjang}
                              </Button>
                            ))}
                          </div>
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input placeholder="Cari kelas..." value={kelasMapelSearchQuery} onChange={(e) => setKelasMapelSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e) => e.stopPropagation()} />
                            {kelasMapelSearchQuery && <button onClick={() => setKelasMapelSearchQuery("")} className="absolute right-2 top-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredKelasMapelOptions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div>
                          ) : (
                            filteredKelasMapelOptions.map(kelas => (
                              <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelasMapel === kelas.id_kelas.toString() ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelasMapel(kelas.id_kelas.toString()); setPopoverMapelOpen(false); setKelasMapelSearchQuery(""); setKelasMapelJenjangFilter("all"); }}>
                                {kelas.nama}
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex-1 w-full">
                    {!selectedKelasMapel && (
                      <Alert className="rounded-lg bg-amber-50 border-amber-200 h-full flex items-center">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700 text-xs sm:text-sm">Silakan pilih kelas terlebih dahulu</AlertDescription>
                      </Alert>
                    )}
                    {selectedKelasMapel && filteredJadwalList.length === 0 && (
                      <Alert className="rounded-lg bg-amber-50 border-amber-200">
                        <BookOpen className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700 text-xs sm:text-sm">Tidak ada jadwal yang dapat diakses untuk kelas ini</AlertDescription>
                      </Alert>
                    )}
                    {selectedKelasMapel && filteredJadwalList.length > 0 && (
                      <div>
                        <Label className="text-slate-700 text-xs sm:text-sm font-medium">Pilih Hari</Label>
                        <div className="border-b border-slate-200 mt-1">
                          <div className="flex flex-wrap gap-1">
                            {uniqueDays.map(day => (
                              <button key={day} onClick={() => { setSelectedDay(day); setSelectedJadwal(null); }} className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all ${selectedDay === day ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedDay && jadwalByDay.length > 0 && (
                  <div className="mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {jadwalByDay.map(jadwal => (
                        <Card key={jadwal.id_jadwal} className={`cursor-pointer transition-all hover:shadow-md ${selectedJadwal?.id_jadwal === jadwal.id_jadwal ? "ring-2 ring-blue-500 bg-blue-50" : "border-slate-200"}`} onClick={() => setSelectedJadwal(jadwal)}>
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex justify-between items-start gap-2 flex-wrap">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5 text-blue-600" /><h4 className="font-semibold text-slate-800 text-sm">{jadwal.mata_pelajaran}</h4></div>
                                <div className="text-xs text-slate-500 space-y-0.5"><p>⏰ {jadwal.jam}</p><p>👨‍🏫 {jadwal.guru}</p></div>
                              </div>
                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); generateQRCode(jadwal); }} disabled={isGeneratingQR} className="rounded-lg h-7 sm:h-8 px-2 text-xs"><QrCode className="h-3 w-3 mr-1" /> QR</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDay && jadwalByDay.length === 0 && selectedKelasMapel && filteredJadwalList.length > 0 && (
                  <div className="text-center py-6 text-slate-500 text-xs sm:text-sm">Tidak ada jadwal untuk hari {selectedDay}</div>
                )}

                {selectedJadwal && (
                  <div className="mt-6 border-t pt-4">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                      <div><h3 className="text-sm sm:text-base font-semibold text-slate-800">Presensi {selectedJadwal.mata_pelajaran}</h3><p className="text-xs text-slate-500">{selectedJadwal.hari}, {selectedJadwal.jam} - {selectedJadwal.guru}</p></div>
                      <Button variant="outline" onClick={() => fetchPresensiMapel()} disabled={isFetchingMapel} className="rounded-lg h-8 sm:h-9 px-3 text-xs sm:text-sm"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingMapel ? "animate-spin" : ""}`} /> Refresh</Button>
                    </div>
                    <div className="border rounded-lg overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="font-semibold text-center text-xs sm:text-sm w-24">NIS</TableHead>
                              <TableHead className="font-semibold text-center text-xs sm:text-sm min-w-[140px]">Nama Siswa</TableHead>
                              {STATUS_MAPEL.map(status => (
                                <TableHead key={status} className="text-center font-semibold text-xs sm:text-sm min-w-[80px]">
                                  <div className="flex flex-col items-center gap-1">
                                    <span>{status}</span>
                                    <Checkbox checked={selectedBulkStatusMapel === status} onCheckedChange={() => handleBulkCheckboxMapel(status)} disabled={isBulkUpdatingMapel} className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isFetchingMapel ? (
                              <TableRow><TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" /></TableCell></TableRow>
                            ) : presensiMapel.length === 0 ? (
                              <TableRow><TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center py-10 text-slate-500 text-xs sm:text-sm">Tidak ada data siswa</TableCell></TableRow>
                            ) : (
                              presensiMapel.map(item => (
                                <TableRow key={item.id_siswa} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="text-center font-mono text-xs sm:text-sm">{item.siswa?.nis}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm font-medium">{item.siswa?.nama}</TableCell>
                                  {STATUS_MAPEL.map(status => (
                                    <TableCell key={status} className="text-center align-middle">
                                      <div className="flex justify-center items-center">
                                        <RadioGroup value={item.status || ""} onValueChange={(val) => updatePresensiMapel(item.id_siswa, item, val)} disabled={updatingStatus?.id === item.id_siswa && updatingStatus?.type === "mapel"} className="flex justify-center">
                                          <RadioGroupItem value={status} id={`mapel-${item.id_siswa}-${status}`} className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </RadioGroup>
                                      </div>
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* DIALOG QR CODE */}
        <Dialog open={qrDialogOpen} onOpenChange={(open) => {
          if (!open && qrRefreshInterval) {
            clearInterval(qrRefreshInterval);
            setQrRefreshInterval(null);
          }
          setQrDialogOpen(open);
        }}>
          <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl p-4 sm:p-6">
            <DialogHeader><DialogTitle className="text-base sm:text-lg flex items-center gap-2"><QrCode className="h-5 w-5 text-blue-600" /> QR Code Presensi (Dinamis 30 detik)</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center space-y-3 py-3">
              {qrCodeDataUrl && <div className="bg-white p-2 sm:p-3 rounded-xl shadow-md"><img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48 sm:w-56 sm:h-56" /></div>}
              <div className="text-center space-y-0.5">
                <p className="font-semibold text-slate-800 text-xs sm:text-sm">{selectedJadwalForQR?.kelas_nama} - {selectedJadwalForQR?.mata_pelajaran}</p>
                <p className="text-[10px] sm:text-xs text-slate-500">Hari: {selectedJadwalForQR?.hari}, Jam: {selectedJadwalForQR?.jam}</p>
                <p className="text-[10px] text-amber-600 mt-1">⚠️ QR Code berubah setiap 30 detik dan hanya berlaku 30 detik. Tidak bisa dipakai ulang.</p>
              </div>
              <Button variant="outline" onClick={() => { const link = document.createElement("a"); link.download = `qr_${selectedJadwalForQR?.id_jadwal}.png`; link.href = qrCodeDataUrl; link.click(); }} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm"><Download className="mr-1.5 h-3.5 w-3.5" /> Download QR Saat Ini</Button>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setQrDialogOpen(false)} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm">Tutup</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* FOOTER */}
        <div className="text-center pt-3"><hr className="mb-3 border-slate-200" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen Presensi - SmartAS</p><p className="text-[10px] text-slate-300 mt-0.5">Sistem Informasi Akademik</p></div>
      </div>
    </div>
  );
}