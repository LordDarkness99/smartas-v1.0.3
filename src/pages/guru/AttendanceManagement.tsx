// src/pages/attendance/AttendanceManagement.tsx
import { Separator } from "@/components/ui/separator";
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
  AlertCircle,
  Search,
  X,
  ChevronDown,
  LogIn,
  LogOut,
  Clock,
  User,
  CheckCircle,
  Save,
  RotateCcw,
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
  id_pres_harian: number | null;
  id_siswa: number;
  status_presensi: string | null;
  waktu_presensi: string | null;
  siswa?: Siswa;
}

interface Jadwal {
  id_jadwal: number;
  hari: string;
  jam: string;
  mata_pelajaran: string;
  guru: string;
  id_guru: number;
  id_kelas: number;
  kelas_nama: string;
}

interface PresensiMapel {
  id_pre_siswa: number | null;
  id_siswa: number;
  id_jadwal: number;
  status: string | null;
  waktu_presensi: string | null;
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

  // State untuk daftar kelas
  const [kelasListHarian, setKelasListHarian] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [kelasListMapel, setKelasListMapel] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [selectedKelasHarian, setSelectedKelasHarian] = useState<string>("");
  const [selectedKelasMapel, setSelectedKelasMapel] = useState<string>("");
  const [waliKelasIds, setWaliKelasIds] = useState<number[]>([]);

  // Presensi Harian - hanya untuk hari ini
  const [presensiHarian, setPresensiHarian] = useState<PresensiHarian[]>([]);
  const [isFetchingHarian, setIsFetchingHarian] = useState(false);
  const [isSavingHarian, setIsSavingHarian] = useState(false);
  const [pendingHarianMasuk, setPendingHarianMasuk] = useState<Map<number, string>>(new Map());
  const [pendingHarianPulang, setPendingHarianPulang] = useState<Map<number, boolean>>(new Map());
  const [autoAlfaProcessedHarian, setAutoAlfaProcessedHarian] = useState(false);
  const [presensiTypeHarian, setPresensiTypeHarian] = useState<"masuk" | "pulang">("masuk");
  const [pendingBulkPulang, setPendingBulkPulang] = useState<boolean | null>(null);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<string | null>(null);

  // Dialog konfirmasi Presensi Harian
  const [confirmHarianOpen, setConfirmHarianOpen] = useState(false);
  const [pendingHarianKelas, setPendingHarianKelas] = useState<string>("");

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
  const [isSavingMapel, setIsSavingMapel] = useState(false);
  const [pendingMapel, setPendingMapel] = useState<Map<number, string>>(new Map());
  const [pendingBulkStatusMapel, setPendingBulkStatusMapel] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [selectedJadwalForQR, setSelectedJadwalForQR] = useState<Jadwal | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [autoAlfaProcessedMapel, setAutoAlfaProcessedMapel] = useState(false);
  const [qrRefreshInterval, setQrRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Dialog konfirmasi Presensi Mapel
  const [confirmMapelOpen, setConfirmMapelOpen] = useState(false);
  const [pendingMapelJadwal, setPendingMapelJadwal] = useState<Jadwal | null>(null);

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

  // Helper untuk tanggal dan hari
  const getTodayDate = () => new Date().toISOString().split("T")[0];
  const getTodayDayName = () => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return days[new Date().getDay()];
  };

  // ========== GREETING & CLOCK ==========
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

  // ========== FETCH KELAS ==========
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
    } else if (userRole === 'admin_jurusan' && user.id_jurusan) {
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
      }
      setWaliKelasIds([]);
    } else {
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

  // ========== FETCH JADWAL ==========
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
          kelas:kelas (nama, id_jurusan),
          mapel:mata_pelajaran (nama),
          guru:guru (nama)
        `)
        .eq("aktif", true);

      if (user.peran === "guru" && user.id_guru) {
        const { data: waliKelas, error: waliError } = await supabase
          .from("kelas")
          .select("id_kelas")
          .eq("id_guru", user.id_guru)
          .eq("aktif", true);
        const waliIds = waliKelas?.map(k => k.id_kelas) || [];

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
      } else if (user.peran === "admin_jurusan" && user.id_jurusan) {
        query = query.eq("kelas.id_jurusan", user.id_jurusan);
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

  useEffect(() => {
    if (!selectedKelasMapel) {
      setFilteredJadwalList([]);
      setSelectedJadwal(null);
      setSelectedDay("");
      return;
    }

    const kelasId = parseInt(selectedKelasMapel);
    let filtered = jadwalList.filter(j => j.id_kelas === kelasId);

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

  // ========== INITIAL FETCH ==========
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchKelas();
      await fetchJadwal();
      setLoading(false);
    };
    init();
  }, []);

  // ========== PRESENSI HARIAN ==========
  const fetchPresensiHarian = async (skipAutoAlfa = false, kelasIdParam?: string) => {
    const kelasId = kelasIdParam ?? selectedKelasHarian;
    if (!kelasId) return;
    setIsFetchingHarian(true);
    setPendingHarianMasuk(new Map());
    setPendingHarianPulang(new Map());
    setPendingBulkPulang(null);
    setPendingBulkStatus(null);
    const today = getTodayDate();
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, id_pkl, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(kelasId))
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

      const startDate = `${today}T00:00:00`;
      const endDate = `${today}T23:59:59`;
      
      let query = supabase
        .from("presensi_harian")
        .select("*")
        .gte("waktu_presensi", startDate)
        .lte("waktu_presensi", endDate);
      
      if (presensiTypeHarian === "masuk") {
        query = query.neq("status_presensi", "Pulang");
      } else {
        query = query.eq("status_presensi", "Pulang");
      }
      
      const { data: presensiData, error: presensiError } = await query;
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

      if (presensiTypeHarian === "masuk" && !skipAutoAlfa && !autoAlfaProcessedHarian && combined.some(p => !p.status_presensi)) {
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
        await fetchPresensiHarian(true, kelasId);
        toast({ title: "Info", description: "Siswa yang belum absen masuk otomatis diisi Alfa" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingHarian(false);
    }
  };

  const savePresensiHarian = async () => {
    const today = getTodayDate();
    if (presensiTypeHarian === "masuk") {
      if (pendingHarianMasuk.size === 0) {
        toast({ title: "Info", description: "Tidak ada perubahan yang perlu disimpan" });
        return;
      }
      setIsSavingHarian(true);
      try {
        for (const [siswaId, newStatus] of pendingHarianMasuk.entries()) {
          const existing = presensiHarian.find(p => p.id_siswa === siswaId);
          if (existing?.id_pres_harian) {
            await supabase
              .from("presensi_harian")
              .update({ status_presensi: newStatus, waktu_presensi: new Date().toISOString() })
              .eq("id_pres_harian", existing.id_pres_harian);
          } else {
            await supabase.from("presensi_harian").insert({
              id_siswa: siswaId,
              status_presensi: newStatus,
              waktu_presensi: new Date().toISOString(),
            });
          }
        }
        await fetchPresensiHarian(true);
        toast({ title: "Berhasil", description: "Perubahan presensi masuk telah disimpan" });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setIsSavingHarian(false);
      }
    } else {
      const hasChanges = pendingHarianPulang.size > 0 || pendingBulkPulang !== null;
      if (!hasChanges) {
        toast({ title: "Info", description: "Tidak ada perubahan yang perlu disimpan" });
        return;
      }
      setIsSavingHarian(true);
      try {
        if (pendingBulkPulang !== null) {
          const semuaPulang = pendingBulkPulang;
          for (const item of presensiHarian) {
            if (semuaPulang) {
              if (item.id_pres_harian) {
                await supabase
                  .from("presensi_harian")
                  .update({ status_presensi: "Pulang", waktu_presensi: new Date().toISOString() })
                  .eq("id_pres_harian", item.id_pres_harian);
              } else {
                await supabase.from("presensi_harian").insert({
                  id_siswa: item.id_siswa,
                  status_presensi: "Pulang",
                  waktu_presensi: new Date().toISOString(),
                });
              }
            } else {
              const startDate = `${today}T00:00:00`;
              const endDate = `${today}T23:59:59`;
              await supabase
                .from("presensi_harian")
                .delete()
                .eq("status_presensi", "Pulang")
                .gte("waktu_presensi", startDate)
                .lte("waktu_presensi", endDate)
                .in("id_siswa", presensiHarian.map(p => p.id_siswa));
            }
          }
        } else {
          for (const [siswaId, isPulang] of pendingHarianPulang.entries()) {
            const existing = presensiHarian.find(p => p.id_siswa === siswaId);
            if (isPulang) {
              if (existing?.id_pres_harian) {
                await supabase
                  .from("presensi_harian")
                  .update({ status_presensi: "Pulang", waktu_presensi: new Date().toISOString() })
                  .eq("id_pres_harian", existing.id_pres_harian);
              } else {
                await supabase.from("presensi_harian").insert({
                  id_siswa: siswaId,
                  status_presensi: "Pulang",
                  waktu_presensi: new Date().toISOString(),
                });
              }
            } else {
              if (existing?.id_pres_harian) {
                await supabase
                  .from("presensi_harian")
                  .delete()
                  .eq("id_pres_harian", existing.id_pres_harian);
              }
            }
          }
        }
        await fetchPresensiHarian(true);
        toast({ title: "Berhasil", description: "Perubahan presensi pulang telah disimpan" });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setIsSavingHarian(false);
      }
    }
  };

  const resetPendingHarian = () => {
    setPendingHarianMasuk(new Map());
    setPendingHarianPulang(new Map());
    setPendingBulkPulang(null);
    setPendingBulkStatus(null);
    toast({ title: "Info", description: "Perubahan yang belum disimpan dibatalkan" });
  };

  const handlePresensiMasukChange = (siswaId: number, newStatus: string) => {
    setPendingHarianMasuk(prev => {
      const newMap = new Map(prev);
      newMap.set(siswaId, newStatus);
      return newMap;
    });
    if (pendingBulkStatus) setPendingBulkStatus(null);
  };

  const handleBulkStatusMasuk = (status: string) => {
    const newMap = new Map<number, string>();
    for (const item of presensiHarian) {
      const isPKL = item.siswa?.id_pkl !== null;
      const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
      if (availableStatus.includes(status)) {
        newMap.set(item.id_siswa, status);
      }
    }
    setPendingHarianMasuk(newMap);
    setPendingBulkStatus(status);
  };

  const handlePulangChange = (siswaId: number, isChecked: boolean) => {
    setPendingHarianPulang(prev => {
      const newMap = new Map(prev);
      if (isChecked) {
        newMap.set(siswaId, true);
      } else {
        newMap.delete(siswaId);
      }
      return newMap;
    });
    setPendingBulkPulang(null);
  };

  const handleBulkPulangPending = (checked: boolean) => {
    setPendingBulkPulang(checked);
    setPendingHarianPulang(new Map());
  };

  // Handler untuk konfirmasi pilih kelas harian
  const handleSelectKelasHarian = (kelasId: string) => {
    setPendingHarianKelas(kelasId);
    setConfirmHarianOpen(true);
  };

  const confirmHarian = () => {
    setSelectedKelasHarian(pendingHarianKelas);
    setConfirmHarianOpen(false);
    setAutoAlfaProcessedHarian(false);
    fetchPresensiHarian(false, pendingHarianKelas);
  };

  // ========== PRESENSI MAPEL ==========
  const fetchPresensiMapel = async (skipAutoAlfa = false, jadwalParam?: Jadwal) => {
    const jadwal = jadwalParam ?? selectedJadwal;
    if (!jadwal) return;
    setIsFetchingMapel(true);
    setPendingMapel(new Map());
    setPendingBulkStatusMapel(null);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, kelas:kelas(nama)")
        .eq("id_kelas", jadwal.id_kelas)
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
        .eq("id_jadwal", jadwal.id_jadwal);
      if (presensiError) throw presensiError;

      const combined = siswaList.map((siswa) => {
        const existing = presensiData?.find((p) => p.id_siswa === siswa.id_siswa);
        return {
          id_pre_siswa: existing?.id_pre_siswa || null,
          id_siswa: siswa.id_siswa,
          id_jadwal: jadwal.id_jadwal,
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
              id_jadwal: jadwal.id_jadwal,
              status: "Alfa",
              waktu_presensi: new Date().toISOString(),
            });
          }
        }
        await fetchPresensiMapel(true, jadwal);
        toast({ title: "Info", description: "Siswa yang tidak scan QR otomatis diisi Alfa" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingMapel(false);
    }
  };

  const handleMapelChange = (siswaId: number, newStatus: string) => {
    setPendingMapel(prev => {
      const newMap = new Map(prev);
      newMap.set(siswaId, newStatus);
      return newMap;
    });
    if (pendingBulkStatusMapel) setPendingBulkStatusMapel(null);
  };

  const handleBulkStatusMapel = (status: string) => {
    const newMap = new Map<number, string>();
    for (const item of presensiMapel) {
      newMap.set(item.id_siswa, status);
    }
    setPendingMapel(newMap);
    setPendingBulkStatusMapel(status);
  };

  const savePresensiMapel = async () => {
    if (pendingMapel.size === 0) {
      toast({ title: "Info", description: "Tidak ada perubahan yang perlu disimpan" });
      return;
    }
    setIsSavingMapel(true);
    try {
      for (const [siswaId, newStatus] of pendingMapel.entries()) {
        const existing = presensiMapel.find(p => p.id_siswa === siswaId);
        if (existing?.id_pre_siswa) {
          await supabase
            .from("presensi_siswa_mapel")
            .update({ status: newStatus, waktu_presensi: new Date().toISOString() })
            .eq("id_pre_siswa", existing.id_pre_siswa);
        } else {
          await supabase.from("presensi_siswa_mapel").insert({
            id_siswa: siswaId,
            id_jadwal: selectedJadwal!.id_jadwal,
            status: newStatus,
            waktu_presensi: new Date().toISOString(),
          });
        }
      }
      await fetchPresensiMapel(true);
      toast({ title: "Berhasil", description: "Perubahan presensi mapel telah disimpan" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingMapel(false);
    }
  };

  const resetPendingMapel = () => {
    setPendingMapel(new Map());
    setPendingBulkStatusMapel(null);
    toast({ title: "Info", description: "Perubahan yang belum disimpan dibatalkan" });
  };

  // Handler untuk konfirmasi pilih jadwal mapel
  const handleSelectJadwal = (jadwal: Jadwal) => {
    setPendingMapelJadwal(jadwal);
    setConfirmMapelOpen(true);
  };

  const confirmMapel = () => {
    if (pendingMapelJadwal) {
      setSelectedJadwal(pendingMapelJadwal);
      setPendingMapel(new Map());
      setPendingBulkStatusMapel(null);
      setAutoAlfaProcessedMapel(false);
      fetchPresensiMapel(false, pendingMapelJadwal);
    }
    setConfirmMapelOpen(false);
  };

  // ========== QR GENERATION ==========
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#C4E2F5]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#2C5EAD] mx-auto" />
          <p className="text-[#2C5EAD] font-medium">Memuat Manajemen Presensi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F7FC]">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-xl mx-4 mt-4">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <div className="relative container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-xl backdrop-blur-sm">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  {greeting === "Selamat Pagi" ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> :
                   greeting === "Selamat Malam" ? <Moon className="h-3 w-3 sm:h-4 sm:w-4" /> :
                   <Cloud className="h-3 w-3 sm:h-4 sm:w-4" />}
                  <p className="text-xs sm:text-sm">{greeting}</p>
                </div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold text-white leading-tight">Manajemen Presensi</h1>
                <p className="text-blue-100 text-xs sm:text-sm">Kelola presensi harian dan presensi mata pelajaran siswa</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-[#2C5EAD] rounded-xl px-3 py-1 sm:px-4 sm:py-2 text-center shadow-md">
                <p className="text-[10px] sm:text-xs text-white/90">{formatDate(currentTime)}</p>
                <p className="text-base sm:text-xl font-semibold text-white">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-4 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-xl"><Users className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-base sm:text-lg">Manajemen Presensi</CardTitle>
                <CardDescription className="text-blue-100 text-xs">Kelola presensi harian dan presensi mata pelajaran siswa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4 sm:space-y-5">
              <div className="flex justify-center">
                <TabsList className="bg-[#2C5EAD] p-1 rounded-xl">
                  <TabsTrigger value="harian" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-3 sm:px-4 py-1.5 text-xs sm:text-sm gap-2 text-white/80">
                    <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Presensi Harian
                  </TabsTrigger>
                  <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] data-[state=active]:shadow-sm px-3 sm:px-4 py-1.5 text-xs sm:text-sm gap-2 text-white/80">
                    <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Presensi Mapel
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB PRESENSI HARIAN */}
              <TabsContent value="harian" className="space-y-4 sm:space-y-5">
                {(user?.peran === 'guru' && kelasListHarian.length === 0) ? (
                  <Alert className="rounded-lg bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-xs sm:text-sm">
                      Anda tidak memiliki akses ke presensi harian karena hanya wali kelas yang dapat mengelola presensi harian.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-3 items-end">
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
                                    <Button key={jenjang} variant={kelasHarianJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasHarianJenjangFilter === jenjang ? "bg-[#2C5EAD] text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasHarianJenjangFilter(jenjang)}>
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
                                    <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelasHarian === kelas.id_kelas.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : "text-slate-700"}`} onClick={() => { 
                                      handleSelectKelasHarian(kelas.id_kelas.toString()); 
                                      setPopoverHarianOpen(false); 
                                      setKelasHarianSearchQuery(""); 
                                      setKelasHarianJenjangFilter("all"); 
                                    }}>
                                      {kelas.nama}
                                    </button>
                                  ))
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex-1">
                          <Label className="text-slate-700 text-xs sm:text-sm font-medium">Hari Presensi</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].map(day => {
                              const isToday = day === getTodayDayName();
                              return (
                                <Button
                                  key={day}
                                  type="button"
                                  variant={isToday ? "default" : "outline"}
                                  disabled={!isToday}
                                  className={`rounded-full px-4 py-1 h-8 text-xs ${isToday ? "bg-[#2C5EAD] text-white hover:bg-[#1e4a8a]" : "opacity-50 cursor-not-allowed"}`}
                                  onClick={() => {
                                    toast({ title: "Info", description: `Presensi hanya untuk hari ini (${getTodayDate()})` });
                                  }}
                                >
                                  {day}
                                </Button>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Hanya hari ini yang dapat dipilih untuk presensi</p>
                        </div>
                        <Button variant="outline" onClick={() => fetchPresensiHarian()} disabled={!selectedKelasHarian || isFetchingHarian} className="rounded-lg h-8 sm:h-9 px-3 text-xs sm:text-sm shrink-0 border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingHarian ? "animate-spin" : ""}`} /> Refresh
                        </Button>
                      </div>

                      <div className="flex justify-center mt-2">
                        <div className="inline-flex bg-white rounded-full p-1 shadow-md border border-slate-200 gap-1">
                          <button onClick={() => setPresensiTypeHarian("masuk")} className={`relative flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${presensiTypeHarian === "masuk" ? "bg-[#2C5EAD] text-white shadow-md hover:shadow-lg hover:scale-105" : "bg-white text-slate-600 hover:bg-slate-100 hover:text-[#2C5EAD] hover:shadow-sm"}`}>
                            <LogIn className={`h-4 w-4 transition-transform ${presensiTypeHarian === "masuk" ? "animate-pulse" : ""}`} /><span>Presensi Masuk</span>
                          </button>
                          <button onClick={() => setPresensiTypeHarian("pulang")} className={`relative flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${presensiTypeHarian === "pulang" ? "bg-[#2C5EAD] text-white shadow-md hover:shadow-lg hover:scale-105" : "bg-white text-slate-600 hover:bg-slate-100 hover:text-[#2C5EAD] hover:shadow-sm"}`}>
                            <LogOut className={`h-4 w-4 transition-transform ${presensiTypeHarian === "pulang" ? "animate-pulse" : ""}`} /><span>Presensi Pulang</span>
                          </button>
                        </div>
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
                                <TableHead className="font-semibold text-center text-xs sm:text-sm w-28">Status</TableHead>
                                {presensiTypeHarian === "masuk" ? (
                                  STATUS_HARIAN_SEKOLAH.map(status => (
                                    <TableHead key={status} className="text-center font-semibold text-xs sm:text-sm min-w-[80px]">
                                      <div className="flex flex-col items-center gap-1">
                                        <span>{status}</span>
                                        <Checkbox checked={pendingBulkStatus === status} onCheckedChange={() => handleBulkStatusMasuk(status)} disabled={isSavingHarian} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD] h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      </div>
                                    </TableHead>
                                  ))
                                ) : (
                                  <TableHead className="text-center font-semibold text-xs sm:text-sm min-w-[100px]">
                                    <div className="flex flex-col items-center gap-1">
                                      <span>Pulang</span>
                                      <Checkbox checked={pendingBulkPulang !== null ? pendingBulkPulang : (presensiHarian.length > 0 && presensiHarian.every(p => p.status_presensi === "Pulang"))} onCheckedChange={handleBulkPulangPending} disabled={isSavingHarian} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD] h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </div>
                                  </TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isFetchingHarian ? (
                                <TableRow><TableCell colSpan={3 + (presensiTypeHarian === "masuk" ? STATUS_HARIAN_SEKOLAH.length : 1)} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2C5EAD]" /></TableCell></TableRow>
                              ) : presensiHarian.length === 0 ? (
                                <TableRow><TableCell colSpan={3 + (presensiTypeHarian === "masuk" ? STATUS_HARIAN_SEKOLAH.length : 1)} className="text-center py-10 text-slate-500 text-xs sm:text-sm">Tidak ada data siswa</TableCell></TableRow>
                              ) : (
                                presensiHarian.map((item) => {
                                  const isPKL = item.siswa?.id_pkl !== null;
                                  if (presensiTypeHarian === "masuk") {
                                    const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
                                    const currentStatus = pendingHarianMasuk.get(item.id_siswa) ?? item.status_presensi ?? "";
                                    return (
                                      <TableRow key={item.id_siswa} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="text-center font-mono text-xs sm:text-sm">{item.siswa?.nis}</TableCell>
                                        <TableCell className="text-center text-xs sm:text-sm font-medium">{item.siswa?.nama}</TableCell>
                                        <TableCell className="text-center">{isPKL ? <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-blue-100 text-blue-700">PKL</span> : <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-green-100 text-green-700">Sekolah</span>}</TableCell>
                                        {STATUS_HARIAN_SEKOLAH.map(status => {
                                          if (!availableStatus.includes(status)) return <TableCell key={status} className="text-center bg-slate-50/30"></TableCell>;
                                          return (
                                            <TableCell key={status} className="text-center align-middle">
                                              <div className="flex justify-center items-center">
                                                <RadioGroup value={currentStatus} onValueChange={(val) => handlePresensiMasukChange(item.id_siswa, val)} disabled={isSavingHarian} className="flex justify-center">
                                                  <RadioGroupItem value={status} id={`harian-${item.id_siswa}-${status}`} className="data-[state=checked]:border-[#2C5EAD] data-[state=checked]:bg-[#2C5EAD] h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                </RadioGroup>
                                              </div>
                                            </TableCell>
                                          );
                                        })}
                                      </TableRow>
                                    );
                                  } else {
                                    const isPulang = pendingHarianPulang.has(item.id_siswa) ? pendingHarianPulang.get(item.id_siswa)! : (item.status_presensi === "Pulang");
                                    return (
                                      <TableRow key={item.id_siswa} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="text-center font-mono text-xs sm:text-sm">{item.siswa?.nis}</TableCell>
                                        <TableCell className="text-center text-xs sm:text-sm font-medium">{item.siswa?.nama}</TableCell>
                                        <TableCell className="text-center">{isPKL ? <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-blue-100 text-blue-700">PKL</span> : <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs bg-green-100 text-green-700">Sekolah</span>}</TableCell>
                                        <TableCell className="text-center align-middle">
                                          <div className="flex justify-center items-center">
                                            <Checkbox checked={isPulang} onCheckedChange={(checked) => handlePulangChange(item.id_siswa, checked === true)} disabled={isSavingHarian} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD] h-4 w-4 rounded-full" />
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  }
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t">
                          <Button variant="outline" onClick={resetPendingHarian} disabled={isSavingHarian || (presensiTypeHarian === "masuk" ? pendingHarianMasuk.size === 0 : (pendingHarianPulang.size === 0 && pendingBulkPulang === null))} className="rounded-lg h-8 px-3 text-xs border-slate-300"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
                          <Button onClick={savePresensiHarian} disabled={isSavingHarian || (presensiTypeHarian === "masuk" ? pendingHarianMasuk.size === 0 : (pendingHarianPulang.size === 0 && pendingBulkPulang === null))} className="rounded-lg h-8 px-3 text-xs bg-[#2C5EAD] hover:bg-[#1e4a8a] text-white">{isSavingHarian ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Simpan Perubahan</Button>
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
                              <Button key={jenjang} variant={kelasMapelJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasMapelJenjangFilter === jenjang ? "bg-[#2C5EAD] text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasMapelJenjangFilter(jenjang)}>
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
                              <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelasMapel === kelas.id_kelas.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelasMapel(kelas.id_kelas.toString()); setPopoverMapelOpen(false); setKelasMapelSearchQuery(""); setKelasMapelJenjangFilter("all"); }}>
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
                              <button key={day} onClick={() => { setSelectedDay(day); setSelectedJadwal(null); setPendingMapel(new Map()); setPendingBulkStatusMapel(null); }} className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all ${selectedDay === day ? "bg-[#2C5EAD] text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{day}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedDay && jadwalByDay.length > 0 && (
                  <div className="mt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                      {jadwalByDay.map((jadwal) => {
                        const [jamMulai] = jadwal.jam.split(" - ");
                        const isSelected = selectedJadwal?.id_jadwal === jadwal.id_jadwal;
                        return (
                          <Card key={jadwal.id_jadwal} className={`group relative overflow-hidden transition-all duration-200 cursor-pointer border-0 shadow-md hover:shadow-lg hover:-translate-y-1 ${isSelected ? "ring-2 ring-[#2C5EAD]" : "border border-slate-200"}`} onClick={() => handleSelectJadwal(jadwal)}>
                            <div className="bg-[#C4E2F5] px-4 py-3 flex justify-between items-start rounded-t-xl">
                              <div className="flex items-center gap-2 min-w-0 flex-1"><div className="bg-white/50 p-1.5 rounded-lg flex-shrink-0"><BookOpen className="h-3.5 w-3.5 text-[#2C5EAD]" /></div><h4 className="font-semibold text-slate-800 text-sm truncate">{jadwal.mata_pelajaran}</h4></div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2"><span className="text-[10px] text-slate-600 bg-white/60 px-2 py-0.5 rounded-full">{jadwal.hari.substring(0, 3)}</span><span className="text-[10px] font-mono bg-white/60 px-2 py-0.5 rounded-full">{jamMulai}</span></div>
                            </div>
                            <CardContent className="p-4 pt-3 space-y-3 bg-white rounded-b-xl">
                              <div className="flex items-center gap-2 text-xs text-slate-600"><div className="bg-purple-50 p-1.5 rounded-lg"><User className="h-3 w-3 text-purple-600" /></div><span className="font-medium">{jadwal.guru}</span></div>
                              <div className="flex items-center gap-2 text-xs text-slate-500"><div className="bg-amber-50 p-1.5 rounded-lg"><Clock className="h-3 w-3 text-amber-600" /></div><span className="font-mono">{jadwal.jam}</span></div>
                              <div className="flex justify-end pt-2"><Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); generateQRCode(jadwal); }} disabled={isGeneratingQR} className="rounded-full text-xs px-3 py-1 h-8 border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white transition-all"><QrCode className="h-3.5 w-3.5 mr-1.5" /> Generate QR</Button></div>
                              {isSelected && <div className="absolute bottom-2 left-2"><div className="bg-[#2C5EAD] text-white rounded-full p-1 shadow-sm"><CheckCircle className="h-3 w-3" /></div></div>}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedDay && jadwalByDay.length === 0 && selectedKelasMapel && filteredJadwalList.length > 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-xl"><Calendar className="h-12 w-12 mx-auto text-slate-300 mb-2" /><p className="text-slate-500 text-sm">Tidak ada jadwal untuk hari {selectedDay}</p><p className="text-slate-400 text-xs mt-1">Pilih hari lain di atas</p></div>
                )}

                {selectedJadwal && (
                  <div className="mt-8 border-t pt-5">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                      <div><h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2"><BookOpen className="h-5 w-5 text-[#2C5EAD]" /> Presensi {selectedJadwal.mata_pelajaran}</h3><p className="text-xs text-slate-500 mt-0.5">{selectedJadwal.hari}, {selectedJadwal.jam} - {selectedJadwal.guru}</p></div>
                      <div className="flex gap-2"><Button variant="outline" onClick={() => fetchPresensiMapel()} disabled={isFetchingMapel} className="rounded-lg h-8 sm:h-9 px-3 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white transition-all"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingMapel ? "animate-spin" : ""}`} /> Refresh</Button></div>
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
                                    <Checkbox checked={pendingBulkStatusMapel === status} onCheckedChange={() => handleBulkStatusMapel(status)} disabled={isSavingMapel} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD] h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isFetchingMapel ? (
                              <TableRow><TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2C5EAD]" /></TableCell></TableRow>
                            ) : presensiMapel.length === 0 ? (
                              <TableRow><TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center py-10 text-slate-500 text-xs sm:text-sm">Tidak ada data siswa</TableCell></TableRow>
                            ) : (
                              presensiMapel.map(item => {
                                const currentStatus = pendingMapel.get(item.id_siswa) ?? item.status ?? "";
                                return (
                                  <TableRow key={item.id_siswa} className="hover:bg-slate-50 transition-colors">
                                    <TableCell className="text-center font-mono text-xs sm:text-sm">{item.siswa?.nis}</TableCell>
                                    <TableCell className="text-center text-xs sm:text-sm font-medium">{item.siswa?.nama}</TableCell>
                                    {STATUS_MAPEL.map(status => (
                                      <TableCell key={status} className="text-center align-middle">
                                        <div className="flex justify-center items-center">
                                          <RadioGroup value={currentStatus} onValueChange={(val) => handleMapelChange(item.id_siswa, val)} disabled={isSavingMapel} className="flex justify-center">
                                            <RadioGroupItem value={status} id={`mapel-${item.id_siswa}-${status}`} className="data-[state=checked]:border-[#2C5EAD] data-[state=checked]:bg-[#2C5EAD] h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                          </RadioGroup>
                                        </div>
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-end gap-2 p-3 bg-slate-50 border-t">
                        <Button variant="outline" onClick={resetPendingMapel} disabled={isSavingMapel || pendingMapel.size === 0} className="rounded-lg h-8 px-3 text-xs border-slate-300"><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset</Button>
                        <Button onClick={savePresensiMapel} disabled={isSavingMapel || pendingMapel.size === 0} className="rounded-lg h-8 px-3 text-xs bg-[#2C5EAD] hover:bg-[#1e4a8a] text-white">{isSavingMapel ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Simpan Perubahan</Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* QR Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={(open) => { if (!open && qrRefreshInterval) { clearInterval(qrRefreshInterval); setQrRefreshInterval(null); } setQrDialogOpen(open); }}>
          <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl p-4 sm:p-6">
            <DialogHeader><DialogTitle className="text-base sm:text-lg flex items-center gap-2"><QrCode className="h-5 w-5 text-[#2C5EAD]" /> QR Code Presensi (Dinamis 30 detik)</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center space-y-3 py-3">
              {qrCodeDataUrl && <div className="bg-white p-2 sm:p-3 rounded-xl shadow-md"><img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48 sm:w-56 sm:h-56" /></div>}
              <div className="text-center space-y-0.5"><p className="font-semibold text-slate-800 text-xs sm:text-sm">{selectedJadwalForQR?.kelas_nama} - {selectedJadwalForQR?.mata_pelajaran}</p><p className="text-[10px] sm:text-xs text-slate-500">Hari: {selectedJadwalForQR?.hari}, Jam: {selectedJadwalForQR?.jam}</p><p className="text-[10px] text-amber-600 mt-1">⚠️ QR Code berubah setiap 30 detik dan hanya berlaku 30 detik. Tidak bisa dipakai ulang.</p></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setQrDialogOpen(false)} className="rounded-lg h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Tutup</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Konfirmasi Presensi Harian */}
        <Dialog open={confirmHarianOpen} onOpenChange={setConfirmHarianOpen}>
          <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                Aktifkan Presensi Harian?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm text-slate-600">
              <p>Anda akan mengaktifkan sesi presensi untuk:</p>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p><strong>Kelas:</strong> {kelasListHarian.find(k => k.id_kelas.toString() === pendingHarianKelas)?.nama || pendingHarianKelas}</p>
                <p><strong>Tanggal:</strong> {getTodayDate()} ({getTodayDayName()})</p>
                <p><strong>Jenis:</strong> {presensiTypeHarian === "masuk" ? "Presensi Masuk" : "Presensi Pulang"}</p>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Siswa yang belum melakukan presensi masuk akan otomatis diisi <strong>Alfa</strong> (kecuali sudah ada presensi sebelumnya).
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmHarianOpen(false)} className="rounded-lg">
                Batal
              </Button>
              <Button onClick={confirmHarian} className="rounded-lg bg-[#2C5EAD] hover:bg-[#1e4a8a] text-white">
                Ya, Aktifkan Presensi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Konfirmasi Presensi Mata Pelajaran */}
        <Dialog open={confirmMapelOpen} onOpenChange={setConfirmMapelOpen}>
          <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#2C5EAD]" />
                Buka Presensi Mata Pelajaran?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm text-slate-600">
              <p>Anda akan membuka halaman presensi untuk:</p>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p><strong>Mata Pelajaran:</strong> {pendingMapelJadwal?.mata_pelajaran}</p>
                <p><strong>Kelas:</strong> {pendingMapelJadwal?.kelas_nama}</p>
                <p><strong>Hari & Jam:</strong> {pendingMapelJadwal?.hari}, {pendingMapelJadwal?.jam}</p>
                <p><strong>Guru:</strong> {pendingMapelJadwal?.guru}</p>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Siswa yang belum melakukan scan QR akan otomatis diisi <strong>Alfa</strong>.
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setConfirmMapelOpen(false)} className="rounded-lg">
                Batal
              </Button>
              <Button onClick={confirmMapel} className="rounded-lg bg-[#2C5EAD] hover:bg-[#1e4a8a] text-white">
                Ya, Buka Presensi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* FOOTER */}
        <div className="text-center pt-3"><Separator className="mb-3" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen Presensi - SmartAS</p><p className="text-[10px] text-slate-300 mt-0.5">Sistem Informasi Akademik</p></div>
      </div>
    </div>
  );
}