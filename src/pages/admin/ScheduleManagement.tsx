import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Edit,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
  BookOpen,
  User,
  School,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  Search,
  UserMinus,
  UserPlus,
  Upload,
  Download,
  X,
  ChevronDown,
  Eye,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  Trophy,
} from "lucide-react";
import { isBK, isAdminJurusan, isAdmin } from "@/lib/utils";

interface Kelas {
  id_kelas: number;
  nama: string;
  aktif: boolean;
  id_jurusan: number | null;
}

interface MataPelajaran {
  id_mapel: number;
  nama: string;
  aktif: boolean;
  dibuat_pada: string;
}

interface Guru {
  id_guru: number;
  nama: string;
  nik?: number | string;
  aktif: boolean;
}

interface Jadwal {
  id_jadwal: number;
  id_kelas: number;
  id_mapel: number;
  id_guru: number;
  hari: string;
  jam: string;
  aktif: boolean;
  kelas?: { nama: string };
  mapel?: { nama: string; aktif: boolean };
  guru?: { nama: string; aktif: boolean };
}

interface StatistikJadwal {
  totalJadwal: number;
  totalKelas: number;
  totalMapel: number;
  totalGuru: number;
  hariTersibuk: string;
  jamTersibuk: string;
  guruTersibuk: string;
}

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const convertToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

function isTimeOverlap(jam1: string, jam2: string): boolean {
  const parseRange = (jam: string) => {
    const [start, end] = jam.split(" - ");
    return { start: convertToMinutes(start), end: convertToMinutes(end) };
  };
  const t1 = parseRange(jam1);
  const t2 = parseRange(jam2);
  return t1.start < t2.end && t2.start < t1.end;
}

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

const getWaktuStatus = (jamMulai: string) => {
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
};

export default function ScheduleManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"jadwal" | "mapel">("jadwal");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  const userRole = user?.peran;
  const isRoleBK = isBK(user);
  const isRoleAdminJurusan = isAdminJurusan(user);
  const canWrite = !isRoleBK;

  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedHari, setSelectedHari] = useState<string>("Senin");
  const [isFetchingJadwal, setIsFetchingJadwal] = useState(false);
  const [statistik, setStatistik] = useState<StatistikJadwal>({
    totalJadwal: 0,
    totalKelas: 0,
    totalMapel: 0,
    totalGuru: 0,
    hariTersibuk: "-",
    jamTersibuk: "-",
    guruTersibuk: "-",
  });

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

  const [jadwalDialogOpen, setJadwalDialogOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<Jadwal | null>(null);
  const [jadwalForm, setJadwalForm] = useState({
    id_kelas: "",
    id_mapel: "",
    id_guru: "",
    hari: "Senin",
    jam: "",
  });
  const [isSavingJadwal, setIsSavingJadwal] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [popoverKelasDialogOpen, setPopoverKelasDialogOpen] = useState(false);
  const [kelasDialogSearchQuery, setKelasDialogSearchQuery] = useState("");
  const [kelasDialogJenjangFilter, setKelasDialogJenjangFilter] = useState<string>("all");

  const [popoverGuruDialogOpen, setPopoverGuruDialogOpen] = useState(false);
  const [guruDialogSearchQuery, setGuruDialogSearchQuery] = useState("");

  const [popoverMapelDialogOpen, setPopoverMapelDialogOpen] = useState(false);
  const [mapelDialogSearchQuery, setMapelDialogSearchQuery] = useState("");

  const filteredKelasDialogOptions = kelasList.filter((kelas) => {
    if (kelasDialogJenjangFilter !== "all") {
      const pattern = new RegExp(`^${kelasDialogJenjangFilter}(\\s|$)`);
      if (!pattern.test(kelas.nama)) return false;
    }
    if (kelasDialogSearchQuery) {
      return kelas.nama.toLowerCase().includes(kelasDialogSearchQuery.toLowerCase());
    }
    return true;
  });

  const [toggleJadwalDialogOpen, setToggleJadwalDialogOpen] = useState(false);
  const [togglingJadwal, setTogglingJadwal] = useState<Jadwal | null>(null);
  const [isActivatingJadwalMode, setIsActivatingJadwalMode] = useState(false);

  const [mapelData, setMapelData] = useState<MataPelajaran[]>([]);
  const [isFetchingMapel, setIsFetchingMapel] = useState(false);
  const [mapelDialogOpen, setMapelDialogOpen] = useState(false);
  const [editingMapel, setEditingMapel] = useState<MataPelajaran | null>(null);
  const [mapelForm, setMapelForm] = useState({ nama: "" });
  const [isSavingMapel, setIsSavingMapel] = useState(false);
  const [mapelSearchTerm, setMapelSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"semua" | "aktif" | "nonaktif">("semua");

  const [toggleMapelDialogOpen, setToggleMapelDialogOpen] = useState(false);
  const [togglingMapel, setTogglingMapel] = useState<MataPelajaran | null>(null);
  const [isActivatingMapelMode, setIsActivatingMapelMode] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [importJadwalDialogOpen, setImportJadwalDialogOpen] = useState(false);
  const [importJadwalRawData, setImportJadwalRawData] = useState<any[]>([]);
  const [importJadwalPreviewRows, setImportJadwalPreviewRows] = useState<any[]>([]);
  const [importJadwalMissingMapels, setImportJadwalMissingMapels] = useState<string[]>([]);
  const [isImportingJadwal, setIsImportingJadwal] = useState(false);
  const [importJadwalUploadError, setImportJadwalUploadError] = useState<string | null>(null);
  const [missingMapelDialogOpen, setMissingMapelDialogOpen] = useState(false);
  const [isAddingMissingMapels, setIsAddingMissingMapels] = useState(false);
  const [importJadwalStep, setImportJadwalStep] = useState<"upload" | "preview">("upload");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedMapelIds, setSelectedMapelIds] = useState<number[]>([]);
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"aktifkan" | "nonaktifkan">("aktifkan");
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [mapelCurrentPage, setMapelCurrentPage] = useState(1);
  const mapelItemsPerPage = 10;

  const formatJamInput = useCallback((raw: string): string => {
    let cleaned = raw.trim();
    if (/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(cleaned)) return cleaned;
    cleaned = cleaned.replace(/\./g, ':');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    let parts: string[] = [];
    if (cleaned.includes('-')) {
      parts = cleaned.split('-').map(p => p.trim());
    } else if (cleaned.includes(' ')) {
      parts = cleaned.split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) parts = parts.slice(0, 2);
    }
    if (parts.length === 2) {
      let start = parts[0];
      let end = parts[1];
      const formatHhMm = (t: string): string => {
        t = t.replace(/[^0-9]/g, '');
        if (t.length === 2) return `${t}:00`;
        if (t.length === 3) return `${t.slice(0, 2)}:${t.slice(2)}`;
        if (t.length === 4) return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
        return t;
      };
      start = formatHhMm(start);
      end = formatHhMm(end);
      if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end)) {
        return `${start} - ${end}`;
      }
    }
    return raw;
  }, []);

  const handleJamBlur = () => {
    setJadwalForm(prev => ({
      ...prev,
      jam: formatJamInput(prev.jam)
    }));
  };

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 4) setGreeting("Selamat Malam");
    else if (hour < 11) setGreeting("Selamat Pagi");
    else if (hour < 15) setGreeting("Selamat Siang");
    else if (hour < 19) setGreeting("Selamat Sore");
    else setGreeting("Selamat Malam");
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const getGreetingIcon = () => {
    if (greeting === "Selamat Pagi") return <Sun className="h-4 w-4" />;
    if (greeting === "Selamat Siang" || greeting === "Selamat Sore") return <Cloud className="h-4 w-4" />;
    return <Moon className="h-4 w-4" />;
  };

  const getStatusColor = (aktif: boolean) => aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
  const getHariColor = (hari: string) => {
    const colors: Record<string, string> = {
      "Senin": "bg-blue-100 text-blue-700", "Selasa": "bg-teal-100 text-teal-700",
      "Rabu": "bg-emerald-100 text-emerald-700", "Kamis": "bg-amber-100 text-amber-700",
      "Jumat": "bg-purple-100 text-purple-700", "Sabtu": "bg-rose-100 text-rose-700",
    };
    return colors[hari] || "bg-slate-100 text-slate-700";
  };

  const fetchKelas = async () => {
    let query = supabase
      .from("kelas")
      .select("id_kelas, nama, aktif, id_jurusan")
      .eq("aktif", true)
      .order("nama");
    if (isRoleAdminJurusan && user?.id_jurusan) {
      query = query.eq("id_jurusan", user.id_jurusan);
    }
    const { data, error } = await query;
    if (!error) setKelasList(data || []);
  };

  const fetchGuru = async () => {
    let query = supabase
      .from("guru")
      .select("id_guru, nama, nik, aktif")
      .eq("aktif", true)
      .order("nama");
    const { data, error } = await query;
    if (!error) setGuruList(data || []);
  };

  const fetchMapel = async () => {
    setIsFetchingMapel(true);
    const { data, error } = await supabase.from("mata_pelajaran").select("*").order("nama");
    if (!error) setMapelData(data || []);
    setIsFetchingMapel(false);
  };

  const fetchJadwal = async () => {
    if (!selectedKelas) return;
    setIsFetchingJadwal(true);
    try {
      const query = supabase
        .from("jadwal")
        .select(`
          id_jadwal, id_kelas, id_mapel, id_guru, hari, jam, aktif,
          kelas:kelas (nama),
          mapel:mata_pelajaran (nama, aktif),
          guru:guru (nama, aktif)
        `)
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("hari", selectedHari);
      const { data, error } = await (query as any);
      if (error) throw error;
      setJadwalList(data || []);
      const activeJadwal = data?.filter((j: any) => j.aktif === true) || [];
      const totalKelas = new Set(activeJadwal.map((j: any) => j.id_kelas)).size;
      const totalMapel = new Set(activeJadwal.map((j: any) => j.id_mapel)).size;
      const totalGuru = new Set(activeJadwal.map((j: any) => j.id_guru)).size;
      const hariCount: Record<string, number> = {};
      const jamCount: Record<string, number> = {};
      const guruCount: Record<string, number> = {};
      activeJadwal.forEach((j: any) => {
        hariCount[j.hari] = (hariCount[j.hari] || 0) + 1;
        const jamMulai = j.jam.split(" - ")[0];
        jamCount[jamMulai] = (jamCount[jamMulai] || 0) + 1;
        guruCount[(j.guru as any)?.nama || "-"] = (guruCount[(j.guru as any)?.nama || "-"] || 0) + 1;
      });
      setStatistik({
        totalJadwal: activeJadwal.length,
        totalKelas, totalMapel, totalGuru,
        hariTersibuk: Object.entries(hariCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
        jamTersibuk: Object.entries(jamCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
        guruTersibuk: Object.entries(guruCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingJadwal(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchKelas(), fetchGuru(), fetchMapel()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === "jadwal" && selectedKelas) fetchJadwal();
  }, [selectedKelas, selectedHari, activeTab]);

  const checkOverlapJadwal = async (kelasId: number, mapelId: number, hari: string, jam: string, excludeId?: number): Promise<boolean> => {
    let query = supabase
      .from("jadwal")
      .select("id_jadwal, jam")
      .eq("id_kelas", kelasId)
      .eq("id_mapel", mapelId)
      .eq("hari", hari)
      .eq("aktif", true);
    if (excludeId) query = query.neq("id_jadwal", excludeId);
    const { data } = await query;
    return data?.some(j => isTimeOverlap(j.jam, jam)) || false;
  };

  const checkGuruOverlap = async (guruId: number, hari: string, jam: string, excludeId?: number): Promise<boolean> => {
    let query = supabase
      .from("jadwal")
      .select("id_jadwal, jam")
      .eq("id_guru", guruId)
      .eq("hari", hari)
      .eq("aktif", true);
    if (excludeId) query = query.neq("id_jadwal", excludeId);
    const { data } = await query;
    return data?.some(j => isTimeOverlap(j.jam, jam)) || false;
  };

  const openAddJadwal = () => {
    if (!canWrite) return;
    setEditingJadwal(null);
    setFormErrors({});
    setJadwalForm({ id_kelas: selectedKelas || "", id_mapel: "", id_guru: "", hari: selectedHari, jam: "" });
    setPopoverKelasDialogOpen(false);
    setPopoverGuruDialogOpen(false);
    setPopoverMapelDialogOpen(false);
    setKelasDialogSearchQuery("");
    setKelasDialogJenjangFilter("all");
    setGuruDialogSearchQuery("");
    setMapelDialogSearchQuery("");
    setJadwalDialogOpen(true);
  };

  const openEditJadwal = (jadwal: Jadwal) => {
    if (!canWrite) return;
    setEditingJadwal(jadwal);
    setFormErrors({});
    setJadwalForm({
      id_kelas: jadwal.id_kelas.toString(),
      id_mapel: jadwal.id_mapel.toString(),
      id_guru: jadwal.id_guru.toString(),
      hari: jadwal.hari,
      jam: jadwal.jam,
    });
    setPopoverKelasDialogOpen(false);
    setPopoverGuruDialogOpen(false);
    setPopoverMapelDialogOpen(false);
    setKelasDialogSearchQuery("");
    setKelasDialogJenjangFilter("all");
    setGuruDialogSearchQuery("");
    setMapelDialogSearchQuery("");
    setJadwalDialogOpen(true);
  };

  const validateJadwalForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!jadwalForm.id_kelas) errors.id_kelas = "Kelas harus dipilih";
    if (!jadwalForm.id_mapel) errors.id_mapel = "Mata pelajaran harus dipilih";
    if (!jadwalForm.id_guru) errors.id_guru = "Guru harus dipilih";
    if (!jadwalForm.jam) errors.jam = "Jam harus diisi";
    if (jadwalForm.jam && !/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(jadwalForm.jam)) errors.jam = "Format jam harus 'HH:MM - HH:MM'";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveJadwal = async () => {
    if (!canWrite) return;
    if (!validateJadwalForm()) return;
    const kelasId = parseInt(jadwalForm.id_kelas), mapelId = parseInt(jadwalForm.id_mapel), guruId = parseInt(jadwalForm.id_guru);
    const hari = jadwalForm.hari, jam = jadwalForm.jam, excludeId = editingJadwal?.id_jadwal;
    setIsSavingJadwal(true);
    try {
      if (await checkOverlapJadwal(kelasId, mapelId, hari, jam, excludeId)) {
        toast({ title: "Error", description: `Jadwal untuk kelas dan mata pelajaran ini sudah ada pada jam yang tumpang tindih di hari ${hari}.`, variant: "destructive" });
        return;
      }
      if (await checkGuruOverlap(guruId, hari, jam, excludeId)) {
        toast({ title: "Error", description: `Guru sudah memiliki jadwal lain di hari ${hari} pada jam yang tumpang tindih.`, variant: "destructive" });
        return;
      }
      const data = { id_kelas: kelasId, id_mapel: mapelId, id_guru: guruId, hari, jam, aktif: true, dibuat_pada: new Date().toISOString() };
      if (editingJadwal) {
        await supabase.from("jadwal").update(data).eq("id_jadwal", editingJadwal.id_jadwal);
        toast({ title: "Berhasil", description: "Jadwal berhasil diperbarui" });
      } else {
        await supabase.from("jadwal").insert(data);
        toast({ title: "Berhasil", description: "Jadwal baru ditambahkan" });
      }
      setJadwalDialogOpen(false);
      fetchJadwal();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingJadwal(false);
    }
  };

  const confirmToggleJadwal = (jadwal: Jadwal, isActivating: boolean) => {
    if (!canWrite) return;
    setTogglingJadwal(jadwal);
    setIsActivatingJadwalMode(isActivating);
    setToggleJadwalDialogOpen(true);
  };

  const executeToggleJadwal = async () => {
    if (!canWrite || !togglingJadwal) return;
    setIsSavingJadwal(true);
    setToggleJadwalDialogOpen(false);
    try {
      const newStatus = !togglingJadwal.aktif;
      if (newStatus === true) {
        const isOverlapMapel = await checkOverlapJadwal(
          togglingJadwal.id_kelas,
          togglingJadwal.id_mapel,
          togglingJadwal.hari,
          togglingJadwal.jam,
          togglingJadwal.id_jadwal
        );
        if (isOverlapMapel) {
          toast({ title: "Error", description: `Tidak dapat mengaktifkan karena jadwal tumpang tindih dengan jadwal aktif lainnya di kelas yang sama.`, variant: "destructive" });
          return;
        }
        const isGuruOverlap = await checkGuruOverlap(
          togglingJadwal.id_guru,
          togglingJadwal.hari,
          togglingJadwal.jam,
          togglingJadwal.id_jadwal
        );
        if (isGuruOverlap) {
          toast({ title: "Error", description: `Tidak dapat mengaktifkan karena guru sudah memiliki jadwal aktif di jam yang sama.`, variant: "destructive" });
          return;
        }
      }
      await supabase.from("jadwal").update({ aktif: newStatus }).eq("id_jadwal", togglingJadwal.id_jadwal);
      toast({ title: "Berhasil", description: `Jadwal ${togglingJadwal.mapel?.nama || "ini"} telah ${newStatus ? "diaktifkan" : "dinonaktifkan"}.` });
      fetchJadwal();
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingJadwal(false);
      setTogglingJadwal(null);
    }
  };

  const openAddMapel = () => {
    if (!canWrite) return;
    setEditingMapel(null);
    setMapelForm({ nama: "" });
    setMapelDialogOpen(true);
  };
  const openEditMapel = (mapel: MataPelajaran) => {
    if (!canWrite) return;
    setEditingMapel(mapel);
    setMapelForm({ nama: mapel.nama });
    setMapelDialogOpen(true);
  };

  const handleSaveMapel = async () => {
    if (!canWrite) return;
    if (!mapelForm.nama.trim()) {
      toast({ title: "Error", description: "Nama mata pelajaran tidak boleh kosong", variant: "destructive" });
      return;
    }
    setIsSavingMapel(true);
    try {
      if (editingMapel) {
        await supabase.from("mata_pelajaran").update({ nama: mapelForm.nama.trim() }).eq("id_mapel", editingMapel.id_mapel);
        toast({ title: "Berhasil", description: "Mata pelajaran diperbarui" });
      } else {
        await supabase.from("mata_pelajaran").insert({ nama: mapelForm.nama.trim(), aktif: true, dibuat_pada: new Date().toISOString() });
        toast({ title: "Berhasil", description: "Mata pelajaran ditambahkan" });
      }
      setMapelDialogOpen(false);
      fetchMapel();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingMapel(false);
    }
  };

  const confirmToggleMapel = (mapel: MataPelajaran, isActivating: boolean) => {
    if (!canWrite) return;
    if (!isActivating) {
      const isUsed = jadwalList.some(j => j.id_mapel === mapel.id_mapel && j.aktif === true);
      if (isUsed) {
        toast({ title: "Tidak bisa menonaktifkan", description: `Mata pelajaran "${mapel.nama}" masih digunakan di jadwal aktif. Nonaktifkan jadwal terlebih dahulu.`, variant: "destructive" });
        return;
      }
    }
    setTogglingMapel(mapel);
    setIsActivatingMapelMode(isActivating);
    setToggleMapelDialogOpen(true);
  };

  const executeToggleMapel = async () => {
    if (!canWrite || !togglingMapel) return;
    setIsSavingMapel(true);
    setToggleMapelDialogOpen(false);
    try {
      const newStatus = !togglingMapel.aktif;
      await supabase.from("mata_pelajaran").update({ aktif: newStatus }).eq("id_mapel", togglingMapel.id_mapel);
      toast({ title: "Berhasil", description: `Mata pelajaran ${togglingMapel.nama} telah ${newStatus ? "diaktifkan" : "dinonaktifkan"}.` });
      fetchMapel();
      if (activeTab === "jadwal" && selectedKelas) fetchJadwal();
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingMapel(false);
      setTogglingMapel(null);
    }
  };

  const downloadTemplateMapel = () => {
    const headers = ["nama"];
    const data = [["Matematika"], ["Fisika"], ["Kimia"], ["Biologi"], ["Bahasa Indonesia"]];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Mapel");
    XLSX.writeFile(wb, "template_impor_mapel.xlsx");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canWrite) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length === 0) throw new Error("File kosong");
      const firstRow = jsonData[0] as any;
      if (!("nama" in firstRow)) throw new Error("Kolom 'nama' tidak ditemukan");
      setPreviewData(jsonData);
      toast({ title: "File Berhasil Diupload", description: `${jsonData.length} data mapel siap diimpor.` });
      setImportDialogOpen(true);
    } catch (error: any) {
      setUploadError(error.message);
      toast({ title: "Upload Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const handleImportMapel = async () => {
    if (!canWrite || !previewData.length) return;
    setIsImporting(true);
    try {
      let successCount = 0;
      let skipCount = 0;
      for (const item of previewData) {
        const nama = item.nama?.trim();
        if (!nama) continue;
        const { data: existing } = await supabase.from("mata_pelajaran").select("id_mapel").eq("nama", nama);
        if (existing && existing.length > 0) {
          skipCount++;
          continue;
        }
        const { error } = await supabase.from("mata_pelajaran").insert({ nama, aktif: true, dibuat_pada: new Date().toISOString() });
        if (error) throw error;
        successCount++;
      }
      toast({ title: "Impor Selesai", description: `${successCount} data berhasil diimpor, ${skipCount} duplikat dilewati.` });
      setImportDialogOpen(false);
      setPreviewData([]);
      fetchMapel();
    } catch (error: any) {
      toast({ title: "Impor Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadJadwalTemplate = () => {
    const headers = ["kelas", "mapel", "nik_guru", "hari", "jam"];
    const data = [
      ["X IPA 1", "Matematika", "1234567890", "Senin", "07:00 - 08:30"],
      ["X IPA 1", "Fisika", "0987654321", "Senin", "08:30 - 10:00"],
      ["XI IPS 2", "Bahasa Indonesia", "1122334455", "Selasa", "09:00 - 10:30"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Jadwal");
    XLSX.writeFile(wb, "template_impor_jadwal.xlsx");
  };

  const toStringTrim = (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  };

  const validateJadwalImportRow = (row: any, index: number) => {
    const errors: string[] = [];
    const kelas = toStringTrim(row.kelas);
    const mapel = toStringTrim(row.mapel);
    const nikGuru = toStringTrim(row.nik_guru);
    const hari = toStringTrim(row.hari);
    const jam = toStringTrim(row.jam);
    if (!kelas) errors.push("Kelas tidak boleh kosong");
    if (!mapel) errors.push("Mata pelajaran tidak boleh kosong");
    if (!nikGuru) errors.push("nik guru tidak boleh kosong");
    if (!hari) errors.push("Hari tidak boleh kosong");
    if (!jam) errors.push("Jam tidak boleh kosong");
    if (jam && !/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(jam)) {
      errors.push("Format jam harus HH:MM - HH:MM");
    }
    if (hari && !HARI.includes(hari)) {
      errors.push(`Hari harus salah satu dari: ${HARI.join(", ")}`);
    }
    return errors;
  };

  const processJadwalPreview = async (rawData: any[]) => {
    const missingMapelsSet = new Set<string>();
    const previewWithValidation = [];
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const validationErrors = validateJadwalImportRow(row, i);
      const kelasNama = toStringTrim(row.kelas);
      const kelas = kelasList.find(k => k.nama.toLowerCase() === kelasNama.toLowerCase());
      const nikGuru = toStringTrim(row.nik_guru);
      const guru = guruList.find(g => g.nik && g.nik.toString() === nikGuru);
      const mapelNama = toStringTrim(row.mapel);
      const mapel = mapelData.find(m => m.nama.toLowerCase() === mapelNama.toLowerCase());
      if (!mapel && mapelNama) {
        missingMapelsSet.add(mapelNama);
      }
      previewWithValidation.push({
        kelas: row.kelas,
        mapel: row.mapel,
        nik_guru: row.nik_guru,
        hari: toStringTrim(row.hari),
        jam: toStringTrim(row.jam),
        rowIndex: i + 1,
        kelasId: kelas?.id_kelas || null,
        guruId: guru?.id_guru || null,
        mapelId: mapel?.id_mapel || null,
        kelasValid: !!kelas,
        guruValid: !!guru,
        mapelValid: !!mapel,
        validationErrors,
        isValid: validationErrors.length === 0 && !!kelas && !!guru && !!mapel,
      });
    }
    setImportJadwalMissingMapels(Array.from(missingMapelsSet));
    return previewWithValidation;
  };

  const handleJadwalFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canWrite) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setImportJadwalUploadError(null);
    setIsImportingJadwal(true);
    setImportJadwalStep("upload");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length === 0) throw new Error("File kosong");
      const firstRow = jsonData[0] as any;
      const requiredColumns = ["kelas", "mapel", "nik_guru", "hari", "jam"];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      if (missingColumns.length > 0) {
        throw new Error(`Kolom tidak ditemukan: ${missingColumns.join(", ")}. Pastikan file memiliki kolom: kelas, mapel, nik_guru, hari, jam`);
      }
      setImportJadwalRawData(jsonData);
      const preview = await processJadwalPreview(jsonData);
      setImportJadwalPreviewRows(preview);
      if (preview.some(p => !p.mapelValid)) {
        setMissingMapelDialogOpen(true);
      } else {
        setImportJadwalStep("preview");
        setImportJadwalDialogOpen(true);
      }
    } catch (error: any) {
      setImportJadwalUploadError(error.message);
      toast({ title: "Upload Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsImportingJadwal(false);
      event.target.value = "";
    }
  };

  const handleAddMissingMapelsAndContinue = async () => {
    if (!canWrite) return;
    if (importJadwalMissingMapels.length === 0) {
      setMissingMapelDialogOpen(false);
      return;
    }
    setIsAddingMissingMapels(true);
    let addedCount = 0;
    try {
      for (const mapelNama of importJadwalMissingMapels) {
        const { data: existing } = await supabase
          .from("mata_pelajaran")
          .select("id_mapel")
          .eq("nama", mapelNama)
          .maybeSingle();
        if (!existing) {
          const { error } = await supabase
            .from("mata_pelajaran")
            .insert({ nama: mapelNama, aktif: true, dibuat_pada: new Date().toISOString() });
          if (error) throw error;
          addedCount++;
        }
      }
      await fetchMapel();
      toast({
        title: "Berhasil",
        description: `${addedCount} mata pelajaran berhasil ditambahkan.`
      });
      const updatedPreview = await processJadwalPreview(importJadwalRawData);
      setImportJadwalPreviewRows(updatedPreview);
      setMissingMapelDialogOpen(false);
      setImportJadwalStep("preview");
      setImportJadwalDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Gagal Menambahkan Mapel",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAddingMissingMapels(false);
    }
  };

  const confirmImportJadwal = async () => {
    if (!canWrite) return;
    const validRows = importJadwalPreviewRows.filter(row => row.isValid);
    if (validRows.length === 0) {
      toast({
        title: "Tidak Ada Data Valid",
        description: "Tidak ada baris yang valid untuk diimpor. Perbaiki error terlebih dahulu.",
        variant: "destructive"
      });
      return;
    }
    setIsImportingJadwal(true);
    let successCount = 0;
    let failCount = 0;
    const failures: { row: number; error: string }[] = [];
    for (const row of validRows) {
      try {
        const isOverlapMapel = await checkOverlapJadwal(
          row.kelasId,
          row.mapelId,
          row.hari,
          row.jam
        );
        if (isOverlapMapel) {
          failures.push({
            row: row.rowIndex,
            error: `Jadwal tumpang tindih dengan jadwal lain di kelas ${row.kelas} untuk mapel ${row.mapel} pada hari ${row.hari} jam ${row.jam}`
          });
          failCount++;
          continue;
        }
        const isGuruOverlap = await checkGuruOverlap(
          row.guruId,
          row.hari,
          row.jam
        );
        if (isGuruOverlap) {
          failures.push({
            row: row.rowIndex,
            error: `Guru dengan NIK ${row.nik_guru} sudah memiliki jadwal lain di hari ${row.hari} pada jam yang tumpang tindih`
          });
          failCount++;
          continue;
        }
        const { error } = await supabase.from("jadwal").insert({
          id_kelas: row.kelasId,
          id_mapel: row.mapelId,
          id_guru: row.guruId,
          hari: row.hari,
          jam: row.jam,
          aktif: true,
          dibuat_pada: new Date().toISOString(),
        });
        if (error) throw error;
        successCount++;
      } catch (error: any) {
        failures.push({ row: row.rowIndex, error: error.message });
        failCount++;
      }
    }
    if (successCount > 0) {
      toast({
        title: "Import Selesai",
        description: `${successCount} jadwal berhasil diimpor${failCount > 0 ? `, ${failCount} gagal` : ""}.`
      });
      if (selectedKelas) {
        fetchJadwal();
      }
    }
    if (failures.length > 0) {
      console.error("Import failures:", failures);
      toast({
        title: "Beberapa jadwal gagal diimpor",
        description: `Cek console untuk detail error. ${failCount} jadwal gagal.`,
        variant: "destructive"
      });
    }
    setImportJadwalDialogOpen(false);
    setImportJadwalRawData([]);
    setImportJadwalPreviewRows([]);
    setImportJadwalStep("upload");
    setIsImportingJadwal(false);
  };

  const handleSelectAll = () => {
    const filtered = filteredMapel;
    if (selectedMapelIds.length === filtered.length && filtered.length > 0) setSelectedMapelIds([]);
    else setSelectedMapelIds(filtered.map(m => m.id_mapel));
  };

  const handleSelectItem = (id: number) => {
    setSelectedMapelIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = (action: "aktifkan" | "nonaktifkan") => {
    if (!canWrite) return;
    if (selectedMapelIds.length === 0) {
      toast({ title: "Tidak ada data dipilih", variant: "destructive" });
      return;
    }
    setBulkActionType(action);
    setBulkActionDialogOpen(true);
  };

  const executeBulkAction = async () => {
    if (!canWrite) return;
    setIsProcessingBulk(true);
    setBulkActionDialogOpen(false);
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedMapelIds) {
      try {
        const newStatus = bulkActionType === "aktifkan";
        const { error } = await supabase.from("mata_pelajaran").update({ aktif: newStatus }).eq("id_mapel", id);
        if (error) throw error;
        successCount++;
      } catch (error) {
        failCount++;
      }
    }
    toast({ title: "Berhasil", description: `${successCount} mata pelajaran berhasil ${bulkActionType === "aktifkan" ? "diaktifkan" : "dinonaktifkan"}${failCount > 0 ? `, ${failCount} gagal` : ""}.` });
    fetchMapel();
    setSelectMode(false);
    setSelectedMapelIds([]);
    setIsProcessingBulk(false);
  };

  const filteredMapel = useMemo(() => {
    let filtered = [...mapelData];
    if (statusFilter === "aktif") filtered = filtered.filter(m => m.aktif === true);
    if (statusFilter === "nonaktif") filtered = filtered.filter(m => m.aktif === false);
    if (mapelSearchTerm) {
      filtered = filtered.filter(m => m.nama.toLowerCase().includes(mapelSearchTerm.toLowerCase()));
    }
    filtered.sort((a, b) => {
      if (a.aktif !== b.aktif) {
        return a.aktif ? -1 : 1;
      }
      return a.nama.localeCompare(b.nama);
    });
    return filtered;
  }, [mapelData, mapelSearchTerm, statusFilter]);

  const mapelTotalPages = useMemo(() => Math.ceil(filteredMapel.length / mapelItemsPerPage), [filteredMapel.length]);
  const paginatedMapel = useMemo(() => {
    const start = (mapelCurrentPage - 1) * mapelItemsPerPage;
    return filteredMapel.slice(start, start + mapelItemsPerPage);
  }, [filteredMapel, mapelCurrentPage]);

  useEffect(() => {
    setMapelCurrentPage(1);
  }, [statusFilter, mapelSearchTerm]);

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchJadwal(), fetchMapel()]).finally(() => setRefreshing(false));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#C4E2F5]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#2C5EAD] mx-auto" />
          <p className="text-[#2C5EAD] font-medium">Memuat Manajemen Jadwal...</p>
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
                  {getGreetingIcon()}<p className="text-xs sm:text-sm">{greeting}</p>
                </div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold text-white">Manajemen Jadwal & Mata Pelajaran</h1>
                <p className="text-blue-100 text-xs sm:text-sm">Atur jadwal pelajaran per kelas dan kelola daftar mata pelajaran</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-[#2C5EAD] rounded-xl px-3 py-1 sm:px-4 sm:py-2 text-center shadow-md">
                <p className="text-[10px] sm:text-xs text-white/90">{formatDate(currentTime)}</p>
                <p className="text-base sm:text-xl font-semibold text-white">{currentTime.toLocaleTimeString("id-ID")}</p>
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
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* STATS CARDS - LATAR PUTIH */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-md bg-white">
            <CardContent className="p-3 sm:p-4">
              <div className="flex justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Kelas</p><p className="text-lg sm:text-2xl font-bold text-[#2C5EAD]">{kelasList.length}</p></div>
                <School className="h-6 w-6 sm:h-8 sm:w-8 text-[#1591DC]" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-md bg-white">
            <CardContent className="p-3 sm:p-4">
              <div className="flex justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Mapel</p><p className="text-lg sm:text-2xl font-bold text-[#2C5EAD]">{mapelData.length}</p></div>
                <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-[#1591DC]" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-md bg-white">
            <CardContent className="p-3 sm:p-4">
              <div className="flex justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Guru</p><p className="text-lg sm:text-2xl font-bold text-[#2C5EAD]">{guruList.length}</p></div>
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-[#1591DC]" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-md bg-white">
            <CardContent className="p-3 sm:p-4">
              <div className="flex justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Jadwal Aktif</p><p className="text-lg sm:text-2xl font-bold text-[#2C5EAD]">{statistik.totalJadwal}</p></div>
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-[#1591DC]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN TABS CARD */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-white/20 p-1.5 sm:p-2 rounded-xl"><Calendar className="h-5 w-5 sm:h-6 sm:w-6" /></div>
                <div>
                  <CardTitle className="text-base sm:text-xl">Manajemen Jadwal & Mata Pelajaran</CardTitle>
                  <CardDescription className="text-blue-100 text-xs sm:text-sm">Atur jadwal pelajaran per kelas dan kelola daftar mata pelajaran</CardDescription>
                </div>
              </div>
              {activeTab === "jadwal" && canWrite && (
                <div className="flex gap-1 bg-[#2C5EAD] p-1 rounded-xl self-start md:self-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-white text-xs sm:text-sm ${viewMode === "table" ? "bg-white/20 text-white" : "hover:bg-white/10"}`}
                    onClick={() => setViewMode("table")}
                  >
                    <LayoutGrid className="h-3.5 w-3.5 mr-1" />Tabel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-white text-xs sm:text-sm ${viewMode === "card" ? "bg-white/20 text-white" : "hover:bg-white/10"}`}
                    onClick={() => setViewMode("card")}
                  >
                    <List className="h-3.5 w-3.5 mr-1" />Kartu
                  </Button>
                </div>
              )}
              {activeTab === "jadwal" && !canWrite && (
                <div className="bg-white/20 p-1 rounded-xl flex items-center gap-1 text-white text-xs"><Eye className="h-3.5 w-3.5" /> Mode Baca Saja</div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4 sm:space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-[#2C5EAD] p-1 rounded-xl">
                  <TabsTrigger value="jadwal" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] text-xs sm:text-sm px-3 sm:px-4 gap-2 text-white/80 data-[state=active]:text-[#2C5EAD]">
                    <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Jadwal Pelajaran
                  </TabsTrigger>
                  <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] text-xs sm:text-sm px-3 sm:px-4 gap-2 text-white/80 data-[state=active]:text-[#2C5EAD]">
                    <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Mata Pelajaran
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB JADWAL */}
              <TabsContent value="jadwal" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row gap-3 items-end justify-center">
                  <div className="w-full sm:w-64">
                    <Label className="text-slate-700 font-medium text-xs sm:text-sm">Kelas</Label>
                    <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between rounded-xl border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal mt-1">
                          {selectedKelas ? kelasList.find(k => k.id_kelas.toString() === selectedKelas)?.nama || "Pilih Kelas" : "Pilih Kelas"}
                          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                        <div className="p-2 border-b bg-slate-50">
                          <div className="flex gap-1 mb-2 flex-wrap">
                            {["all", "X", "XI", "XII"].map(jenjang => (
                              <Button key={jenjang} variant={kelasJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasJenjangFilter === jenjang ? "bg-[#2C5EAD] text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasJenjangFilter(jenjang)}>
                                {jenjang === "all" ? "Semua" : jenjang}
                              </Button>
                            ))}
                          </div>
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input placeholder="Cari kelas..." value={kelasSearchQuery} onChange={(e) => setKelasSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e) => e.stopPropagation()} />
                            {kelasSearchQuery && <button onClick={() => setKelasSearchQuery("")} className="absolute right-2 top-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredKelasOptions.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div>
                          ) : (
                            filteredKelasOptions.map(kelas => (
                              <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelas === kelas.id_kelas.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelas(kelas.id_kelas.toString()); setPopoverKelasOpen(false); setKelasSearchQuery(""); setKelasJenjangFilter("all"); }}>
                                {kelas.nama}
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="w-full sm:w-40">
                    <Label className="text-slate-700 font-medium text-xs sm:text-sm">Hari</Label>
                    <Select value={selectedHari} onValueChange={setSelectedHari}>
                      <SelectTrigger className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HARI.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start w-full sm:w-auto">
                    {canWrite && (
                      <>
                        <Button onClick={openAddJadwal} disabled={!selectedKelas} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white">
                          <Plus className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Tambah Jadwal
                        </Button>
                        <Button variant="outline" onClick={() => setImportJadwalDialogOpen(true)} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                          <Upload className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Impor Jadwal
                        </Button>
                      </>
                    )}
                    <Button variant="outline" onClick={fetchJadwal} disabled={!selectedKelas || isFetchingJadwal} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                      <RefreshCw className={`mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFetchingJadwal ? "animate-spin" : ""}`} /> Segarkan
                    </Button>
                  </div>
                </div>

                {!selectedKelas && (
                  <Alert className="rounded-xl bg-amber-50 max-w-md mx-auto">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-xs sm:text-sm">Silakan pilih kelas terlebih dahulu</AlertDescription>
                  </Alert>
                )}

                {selectedKelas && viewMode === "table" && (
                  <div className="border rounded-xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[500px] sm:min-w-full">
                        <TableHeader>
                          <TableRow className="bg-slate-100 border-b border-slate-200">
                            <TableHead className="text-xs sm:text-sm py-3">Jam</TableHead>
                            <TableHead className="text-xs sm:text-sm py-3">Mata Pelajaran</TableHead>
                            <TableHead className="text-xs sm:text-sm py-3">Guru</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm py-3">Hari</TableHead>
                            <TableHead className="text-center text-xs sm:text-sm py-3">Status</TableHead>
                            {canWrite && <TableHead className="text-center w-28 text-xs sm:text-sm py-3">Aksi</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isFetchingJadwal ? (
                            <TableRow><TableCell colSpan={canWrite ? 6 : 5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2C5EAD]" /></TableCell></TableRow>
                          ) : jadwalList.length === 0 ? (
                            <TableRow><TableCell colSpan={canWrite ? 6 : 5} className="text-center py-8 text-slate-500"><Calendar className="h-8 w-8 mx-auto mb-2" />Tidak ada jadwal untuk hari {selectedHari}</TableCell></TableRow>
                          ) : (
                            jadwalList.map((j, idx) => {
                              const jamMulai = j.jam.split(" - ")[0];
                              const waktuStatus = getWaktuStatus(jamMulai);
                              const borderColor = getColorForMapel(j.mapel?.nama || "-");
                              const isLast = idx === jadwalList.length - 1;
                              return (
                                <TableRow
                                  key={j.id_jadwal}
                                  className={`relative border-l-[6px] ${borderColor} ${!isLast ? 'border-b border-gray-100' : ''} hover:bg-slate-50/80 transition-colors`}
                                >
                                  <TableCell className="font-mono text-sm py-3 whitespace-nowrap">{j.jam}</TableCell>
                                  <TableCell className="py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-blue-100 p-1.5 rounded-lg"><BookOpen className="h-4 w-4 text-blue-600" /></div>
                                      <span className="font-medium text-sm">{j.mapel?.nama || "-"}{j.mapel?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-purple-100 p-1.5 rounded-lg"><User className="h-4 w-4 text-purple-600" /></div>
                                      <span className="text-sm">{j.guru?.nama || "-"}{j.guru?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={`${getHariColor(j.hari)} border-0 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs`}>{j.hari}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={`${waktuStatus.bgBadge} border-0 rounded-full flex items-center gap-1 w-fit text-xs px-2 py-0.5 sm:px-3 sm:py-1 mx-auto`}>
                                      {waktuStatus.icon}{waktuStatus.label}
                                    </Badge>
                                  </TableCell>
                                  {canWrite && (
                                    <TableCell className="text-center">
                                      <div className="flex gap-1 justify-center">
                                        <Button variant="ghost" size="sm" onClick={() => openEditJadwal(j)}><Edit className="h-4 w-4 text-[#2C5EAD]" /></Button>
                                        {j.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, false)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, true)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {selectedKelas && viewMode === "card" && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {jadwalList.map(j => {
                      const jamMulai = j.jam.split(" - ")[0];
                      const waktuStatus = getWaktuStatus(jamMulai);
                      const borderColor = getColorForMapel(j.mapel?.nama || "-");
                      return (
                        <div
                          key={j.id_jadwal}
                          className={`relative rounded-xl border border-gray-200 bg-white shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden ${borderColor} border-l-[6px]`}
                        >
                          <CardContent className="p-4 sm:p-5 relative">
                            <div className="flex justify-between mb-3 flex-wrap gap-1">
                              <Badge className={getHariColor(j.hari)}>{j.hari}</Badge>
                              <span className="font-mono text-sm font-bold">{j.jam}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-100 p-1.5 rounded-xl"><BookOpen className="h-4 w-4 text-blue-600" /></div>
                                <span className="font-semibold text-sm">{j.mapel?.nama || "-"}{j.mapel?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="bg-purple-100 p-1.5 rounded-xl"><User className="h-4 w-4 text-purple-600" /></div>
                                <span className="text-sm">{j.guru?.nama || "-"}{j.guru?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span>
                              </div>
                              <div>
                                <Badge className={`${waktuStatus.bgBadge} border-0 rounded-full text-xs px-2 py-1`}>
                                  {waktuStatus.icon}<span className="ml-1">{waktuStatus.label}</span>
                                </Badge>
                              </div>
                            </div>
                            {canWrite && (
                              <div className="flex gap-2 mt-3 pt-3 border-t">
                                <Button variant="ghost" size="sm" onClick={() => openEditJadwal(j)} className="flex-1 text-xs text-[#2C5EAD]"><Edit className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                                {j.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, false)} className="flex-1 text-red-500 text-xs"><UserMinus className="h-3.5 w-3.5 mr-1" /> Nonaktif</Button> : <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, true)} className="flex-1 text-green-500 text-xs"><UserPlus className="h-3.5 w-3.5 mr-1" /> Aktif</Button>}
                              </div>
                            )}
                            {!canWrite && (
                              <div className="mt-3 pt-3 border-t text-center text-xs text-slate-400 flex items-center justify-center gap-1"><Eye className="h-3 w-3" /> Mode baca saja</div>
                            )}
                          </CardContent>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* TAB MATA PELAJARAN */}
              <TabsContent value="mapel" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {canWrite && (
                      <>
                        <Button onClick={openAddMapel} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white">
                          <Plus className="mr-1 h-3 w-3" /> Tambah Mapel
                        </Button>
                        <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                          <Upload className="mr-1 h-3 w-3" /> Impor Excel
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
                    <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Cari mapel..." value={mapelSearchTerm} onChange={(e) => setMapelSearchTerm(e.target.value)} className="pl-8 rounded-xl w-48 sm:w-64 h-8 sm:h-9 text-xs sm:text-sm" /></div>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}><SelectTrigger className="w-32 h-8 sm:h-9 rounded-xl text-xs sm:text-sm"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="semua">Semua</SelectItem><SelectItem value="aktif">Aktif</SelectItem><SelectItem value="nonaktif">Nonaktif</SelectItem></SelectContent></Select>
                    <Button variant="outline" onClick={fetchMapel} disabled={isFetchingMapel} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"><RefreshCw className={`mr-1 h-3 w-3 ${isFetchingMapel ? "animate-spin" : ""}`} /> Segarkan</Button>
                  </div>
                </div>
                {canWrite && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button variant={selectMode ? "default" : "outline"} onClick={() => { setSelectMode(!selectMode); if (!selectMode) setSelectedMapelIds([]); }} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm">{selectMode ? "Batalkan Mode Pilih" : "Mode Pilih"}</Button>
                      {selectMode && <>
                        <Button variant="default" onClick={() => handleBulkAction("aktifkan")} disabled={selectedMapelIds.length === 0 || isProcessingBulk} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-8 sm:h-9 text-xs sm:text-sm">Aktifkan ({selectedMapelIds.filter(id => !mapelData.find(m => m.id_mapel === id)?.aktif).length})</Button>
                        <Button variant="destructive" onClick={() => handleBulkAction("nonaktifkan")} disabled={selectedMapelIds.length === 0 || isProcessingBulk} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm">Nonaktifkan ({selectedMapelIds.filter(id => mapelData.find(m => m.id_mapel === id)?.aktif).length})</Button>
                      </>}
                    </div>
                    {selectMode && <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-xs sm:text-sm">Pilih Semua</Button>}
                  </div>
                )}
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          {selectMode && canWrite && <TableHead className="w-10"><Checkbox checked={selectedMapelIds.length === paginatedMapel.length && paginatedMapel.length > 0} onCheckedChange={handleSelectAll} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD]" /></TableHead>}
                          <TableHead className="text-xs sm:text-sm">Nama Mata Pelajaran</TableHead>
                          <TableHead className="text-center w-24 text-xs sm:text-sm">Status</TableHead>
                          {canWrite && <TableHead className="text-center w-28 text-xs sm:text-sm">Aksi</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isFetchingMapel ? (
                          <TableRow><TableCell colSpan={selectMode && canWrite ? 4 : (canWrite ? 3 : 2)} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2C5EAD]" /></TableCell></TableRow>
                        ) : filteredMapel.length === 0 ? (
                          <TableRow><TableCell colSpan={selectMode && canWrite ? 4 : (canWrite ? 3 : 2)} className="text-center py-8 text-slate-500"><BookOpen className="h-8 w-8 mx-auto mb-2" />{mapelSearchTerm ? "Tidak ada mata pelajaran yang cocok" : "Belum ada mata pelajaran"}</TableCell></TableRow>
                        ) : (
                          paginatedMapel.map(m => (
                            <TableRow key={m.id_mapel}>
                              {selectMode && canWrite && <TableCell><Checkbox checked={selectedMapelIds.includes(m.id_mapel)} onCheckedChange={() => handleSelectItem(m.id_mapel)} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD]" /></TableCell>}
                              <TableCell className="font-medium text-xs sm:text-sm">{m.nama}</TableCell>
                              <TableCell className="text-center"><Badge className={`${getStatusColor(m.aktif)} border-0 rounded-full px-2 sm:px-3 py-0.5 sm:py-1 text-xs`}>{m.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                              {canWrite && (
                                <TableCell className="text-center">
                                  <div className="flex gap-1 justify-center">
                                    <Button variant="ghost" size="sm" onClick={() => openEditMapel(m)}><Edit className="h-4 w-4 text-[#2C5EAD]" /></Button>
                                    {m.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmToggleMapel(m, false)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmToggleMapel(m, true)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {filteredMapel.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-600">Menampilkan {((mapelCurrentPage - 1) * mapelItemsPerPage) + 1}-{Math.min(mapelCurrentPage * mapelItemsPerPage, filteredMapel.length)} dari {filteredMapel.length} mata pelajaran</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setMapelCurrentPage(p => Math.max(1, p - 1))} disabled={mapelCurrentPage === 1} className="rounded-lg h-7 sm:h-8 text-xs border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Sebelumnya</Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(mapelTotalPages, 5) }, (_, i) => i + 1).map((page) => (
                          <Button key={page} variant={mapelCurrentPage === page ? "default" : "outline"} size="sm" onClick={() => setMapelCurrentPage(page)} className="rounded-lg h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">{page}</Button>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setMapelCurrentPage(p => Math.min(mapelTotalPages, p + 1))} disabled={mapelCurrentPage === mapelTotalPages} className="rounded-lg h-7 sm:h-8 text-xs border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Berikutnya</Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-[#C4E2F5]/50 to-[#4BB8FA]/20 max-w-3xl mx-auto">
          <CardContent className="p-4 sm:p-5">
            <div className="flex gap-3 sm:gap-4">
              <div className="bg-[#2C5EAD]/10 p-2 sm:p-3 rounded-xl">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-[#2C5EAD]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base mb-1">Tips Mengelola Jadwal</h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  Pastikan tidak ada tumpang tindih jadwal untuk guru yang sama. Sistem akan otomatis memvalidasi overlap jadwal. Gunakan filter kelas dan hari untuk melihat jadwal spesifik. Anda dapat menonaktifkan jadwal atau mata pelajaran tanpa menghapus datanya.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen Jadwal - SmartAS</p>
          <p className="text-[10px] text-slate-300 mt-1">Sistem Informasi Akademik</p>
        </div>
      </div>

      {/* DIALOG JADWAL */}
      <Dialog open={jadwalDialogOpen} onOpenChange={setJadwalDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingJadwal ? "Edit Jadwal" : "Tambah Jadwal Baru"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{editingJadwal ? "Perbarui informasi jadwal pelajaran" : "Tambahkan jadwal pelajaran baru untuk kelas yang dipilih"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700 font-medium text-xs sm:text-sm">Kelas</Label>
                <Popover open={popoverKelasDialogOpen} onOpenChange={setPopoverKelasDialogOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-9 text-sm font-normal">
                      {jadwalForm.id_kelas ? kelasList.find(k => k.id_kelas.toString() === jadwalForm.id_kelas)?.nama || "Pilih Kelas" : "Pilih Kelas"}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start" sideOffset={5}>
                    <div className="p-2 border-b bg-slate-50">
                      <div className="flex gap-1 mb-2 flex-wrap">
                        {["all", "X", "XI", "XII"].map(jenjang => (
                          <Button key={jenjang} variant={kelasDialogJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className="h-7 px-2 text-xs rounded-md" onClick={() => setKelasDialogJenjangFilter(jenjang)}>
                            {jenjang === "all" ? "Semua" : jenjang}
                          </Button>
                        ))}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input placeholder="Cari kelas..." value={kelasDialogSearchQuery} onChange={(e) => setKelasDialogSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredKelasDialogOptions.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div>
                      ) : (
                        filteredKelasDialogOptions.map(kelas => (
                          <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${jadwalForm.id_kelas === kelas.id_kelas.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : ""}`} onClick={() => {
                            setJadwalForm({ ...jadwalForm, id_kelas: kelas.id_kelas.toString() });
                            setPopoverKelasDialogOpen(false);
                            setKelasDialogSearchQuery("");
                            setKelasDialogJenjangFilter("all");
                          }}>
                            {kelas.nama}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {formErrors.id_kelas && <p className="text-red-500 text-xs mt-1">{formErrors.id_kelas}</p>}
              </div>

              <div>
                <Label className="text-slate-700 font-medium text-xs sm:text-sm">Mata Pelajaran</Label>
                <Popover open={popoverMapelDialogOpen} onOpenChange={setPopoverMapelDialogOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-9 text-sm font-normal">
                      {jadwalForm.id_mapel ? mapelData.find(m => m.id_mapel.toString() === jadwalForm.id_mapel)?.nama || "Pilih Mapel" : "Pilih Mapel"}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start" sideOffset={5}>
                    <div className="p-2 border-b bg-slate-50">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input placeholder="Cari mapel..." value={mapelDialogSearchQuery} onChange={(e) => setMapelDialogSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {mapelData.filter(m => m.nama.toLowerCase().includes(mapelDialogSearchQuery.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada mapel yang cocok</div>
                      ) : (
                        mapelData.filter(m => m.nama.toLowerCase().includes(mapelDialogSearchQuery.toLowerCase())).map(mapel => (
                          <button key={mapel.id_mapel} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${jadwalForm.id_mapel === mapel.id_mapel.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : ""}`} onClick={() => {
                            setJadwalForm({ ...jadwalForm, id_mapel: mapel.id_mapel.toString() });
                            setPopoverMapelDialogOpen(false);
                            setMapelDialogSearchQuery("");
                          }}>
                            {mapel.nama}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {formErrors.id_mapel && <p className="text-red-500 text-xs mt-1">{formErrors.id_mapel}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-700 font-medium text-xs sm:text-sm">Guru</Label>
                <Popover open={popoverGuruDialogOpen} onOpenChange={setPopoverGuruDialogOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between rounded-lg border-slate-200 h-9 text-sm font-normal">
                      {jadwalForm.id_guru ? guruList.find(g => g.id_guru.toString() === jadwalForm.id_guru)?.nama || "Pilih Guru" : "Pilih Guru"}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start" sideOffset={5}>
                    <div className="p-2 border-b bg-slate-50">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input placeholder="Cari guru..." value={guruDialogSearchQuery} onChange={(e) => setGuruDialogSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" />
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {guruList.filter(g => g.nama.toLowerCase().includes(guruDialogSearchQuery.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada guru yang cocok</div>
                      ) : (
                        guruList.filter(g => g.nama.toLowerCase().includes(guruDialogSearchQuery.toLowerCase())).map(guru => (
                          <button key={guru.id_guru} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${jadwalForm.id_guru === guru.id_guru.toString() ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium" : ""}`} onClick={() => {
                            setJadwalForm({ ...jadwalForm, id_guru: guru.id_guru.toString() });
                            setPopoverGuruDialogOpen(false);
                            setGuruDialogSearchQuery("");
                          }}>
                            {guru.nama} {guru.nik ? `(${guru.nik})` : ""}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {formErrors.id_guru && <p className="text-red-500 text-xs mt-1">{formErrors.id_guru}</p>}
              </div>

              <div>
                <Label className="text-slate-700 font-medium text-xs sm:text-sm">Hari</Label>
                <Select value={jadwalForm.hari} onValueChange={(v) => setJadwalForm({ ...jadwalForm, hari: v })}>
                  <SelectTrigger className="rounded-lg mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{HARI.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-slate-700 font-medium text-xs sm:text-sm">Jam (Format: HH:MM - HH:MM)</Label>
              <Input
                placeholder="07:00 - 08:30"
                value={jadwalForm.jam}
                onChange={(e) => setJadwalForm({ ...jadwalForm, jam: e.target.value })}
                onBlur={handleJamBlur}
                className="rounded-lg mt-1 h-9 text-sm"
              />
              {formErrors.jam && <p className="text-red-500 text-xs mt-1">{formErrors.jam}</p>}
              <p className="text-xs text-slate-500 mt-1">Contoh: 07:00 - 08:30, atau cukup ketik <strong>07:00 08:30</strong> (otomatis diformat)</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setJadwalDialogOpen(false)} className="rounded-lg w-full sm:w-auto text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button>
            <Button onClick={handleSaveJadwal} disabled={isSavingJadwal} className="rounded-lg bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white w-full sm:w-auto text-xs sm:text-sm">
              {isSavingJadwal ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</> : "Simpan Jadwal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG TOGGLE JADWAL */}
      <Dialog open={toggleJadwalDialogOpen} onOpenChange={setToggleJadwalDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{isActivatingJadwalMode ? "Aktifkan Jadwal" : "Nonaktifkan Jadwal"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{isActivatingJadwalMode ? "Jadwal akan diaktifkan kembali" : "Jadwal akan dinonaktifkan tetapi data tetap tersimpan"}</DialogDescription>
          </DialogHeader>
          {togglingJadwal && (
            <div className="space-y-3 py-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600"><span className="font-medium">Mapel:</span> {togglingJadwal.mapel?.nama}</p>
                <p className="text-sm text-slate-600"><span className="font-medium">Guru:</span> {togglingJadwal.guru?.nama}</p>
                <p className="text-sm text-slate-600"><span className="font-medium">Jam:</span> {togglingJadwal.jam}</p>
                <p className="text-sm text-slate-600"><span className="font-medium">Hari:</span> {togglingJadwal.hari}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setToggleJadwalDialogOpen(false)} className="rounded-lg w-full sm:w-auto text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button>
            <Button onClick={executeToggleJadwal} disabled={isSavingJadwal} className={`rounded-lg w-full sm:w-auto text-xs sm:text-sm ${isActivatingJadwalMode ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
              {isSavingJadwal ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</> : (isActivatingJadwalMode ? "Aktifkan" : "Nonaktifkan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG MAPEL */}
      <Dialog open={mapelDialogOpen} onOpenChange={setMapelDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingMapel ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{editingMapel ? "Perbarui nama mata pelajaran" : "Tambahkan mata pelajaran baru ke dalam sistem"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-700 font-medium text-xs sm:text-sm">Nama Mata Pelajaran</Label>
              <Input placeholder="Contoh: Matematika, Fisika, dll" value={mapelForm.nama} onChange={(e) => setMapelForm({ nama: e.target.value })} className="rounded-lg mt-1 h-9 text-sm" />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setMapelDialogOpen(false)} className="rounded-lg w-full sm:w-auto text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button>
            <Button onClick={handleSaveMapel} disabled={isSavingMapel} className="rounded-lg bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white w-full sm:w-auto text-xs sm:text-sm">
              {isSavingMapel ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...</> : "Simpan Mapel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG TOGGLE MAPEL */}
      <Dialog open={toggleMapelDialogOpen} onOpenChange={setToggleMapelDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{isActivatingMapelMode ? "Aktifkan Mata Pelajaran" : "Nonaktifkan Mata Pelajaran"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{isActivatingMapelMode ? "Mata pelajaran akan diaktifkan kembali" : "Mata pelajaran akan dinonaktifkan tetapi data tetap tersimpan"}</DialogDescription>
          </DialogHeader>
          {togglingMapel && (
            <div className="py-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600"><span className="font-medium">Nama:</span> {togglingMapel.nama}</p>
                <p className="text-sm text-slate-600"><span className="font-medium">Status:</span> {togglingMapel.aktif ? "Aktif" : "Nonaktif"}</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setToggleMapelDialogOpen(false)} className="rounded-lg w-full sm:w-auto text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button>
            <Button onClick={executeToggleMapel} disabled={isSavingMapel} className={`rounded-lg w-full sm:w-auto text-xs sm:text-sm ${isActivatingMapelMode ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
              {isSavingMapel ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</> : (isActivatingMapelMode ? "Aktifkan" : "Nonaktifkan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG IMPORT MAPEL */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-2xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Impor Mata Pelajaran dari Excel</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Upload file Excel untuk menambah mata pelajaran secara massal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-slate-400" />
                <label htmlFor="file-input" className="cursor-pointer">
                  <span className="text-sm font-medium text-[#2C5EAD] hover:text-[#2C5EAD]/80">Klik untuk upload</span>
                  <input id="file-input" type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={isImporting} />
                </label>
                <p className="text-xs text-slate-500">atau drag & drop file Excel di sini</p>
              </div>
            </div>
            {uploadError && <Alert className="bg-red-50 border-red-200"><AlertCircle className="h-4 w-4 text-red-600" /><AlertDescription className="text-red-700 text-xs">{uploadError}</AlertDescription></Alert>}
            {previewData.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Preview Data ({previewData.length} item):</p>
                <div className="border rounded-lg overflow-y-auto max-h-48">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50"><TableHead className="text-xs">Nama Mapel</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {previewData.slice(0, 5).map((item, idx) => <TableRow key={idx}><TableCell className="text-sm">{item.nama}</TableCell></TableRow>)}
                      {previewData.length > 5 && <TableRow><TableCell className="text-sm text-slate-500 text-center py-2">... dan {previewData.length - 5} data lainnya</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <Button variant="outline" onClick={downloadTemplateMapel} className="w-full rounded-lg text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"><Download className="h-4 w-4 mr-2" /> Download Template Excel</Button>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setPreviewData([]); setUploadError(null); }} className="rounded-lg w-full sm:w-auto text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button>
            <Button onClick={handleImportMapel} disabled={isImporting || previewData.length === 0} className="rounded-lg bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white w-full sm:w-auto text-xs sm:text-sm">
              {isImporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengimpor...</> : "Impor Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG IMPORT JADWAL */}
      <Dialog open={importJadwalDialogOpen} onOpenChange={setImportJadwalDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Impor Jadwal Pelajaran dari Excel</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Upload file Excel untuk menambah jadwal secara massal (gunakan NIK Guru)</DialogDescription>
          </DialogHeader>
          {importJadwalStep === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-slate-400" />
                  <label htmlFor="jadwal-file-input" className="cursor-pointer">
                    <span className="text-sm font-medium text-[#2C5EAD] hover:text-[#2C5EAD]/80">Klik untuk upload</span>
                    <input id="jadwal-file-input" type="file" accept=".xlsx,.xls" onChange={handleJadwalFileUpload} className="hidden" disabled={isImportingJadwal} />
                  </label>
                  <p className="text-xs text-slate-500">atau drag & drop file Excel di sini</p>
                </div>
              </div>
              {importJadwalUploadError && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 text-xs">{importJadwalUploadError}</AlertDescription>
                </Alert>
              )}
              <Button variant="outline" onClick={downloadJadwalTemplate} className="w-full rounded-lg text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">
                <Download className="h-4 w-4 mr-2" /> Download Template Excel Jadwal (NIK Guru)
              </Button>
              <div className="bg-blue-50 p-3 rounded-lg text-xs sm:text-sm text-blue-700">
                <p className="font-semibold">Format File:</p>
                <p>Kolom yang diperlukan: <strong>kelas, mapel, nik_guru, hari, jam</strong></p>
                <p className="text-xs mt-1">Contoh: X IPA 1, Matematika, 1234567890, Senin, 07:00 - 08:30</p>
              </div>
            </div>
          )}
          {importJadwalStep === "preview" && importJadwalPreviewRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <p className="text-sm font-medium">Preview Data ({importJadwalPreviewRows.length} baris)</p>
                <Badge className={importJadwalPreviewRows.filter(r => r.isValid).length === importJadwalPreviewRows.length ? "bg-green-100 text-green-700 text-xs" : "bg-yellow-100 text-yellow-700 text-xs"}>
                  {importJadwalPreviewRows.filter(r => r.isValid).length} dari {importJadwalPreviewRows.length} valid
                </Badge>
              </div>
              <div className="border rounded-lg overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-12 text-xs">#</TableHead>
                      <TableHead className="text-xs">Kelas</TableHead>
                      <TableHead className="text-xs">Mapel</TableHead>
                      <TableHead className="text-xs">NIK Guru</TableHead>
                      <TableHead className="text-xs">Hari</TableHead>
                      <TableHead className="text-xs">Jam</TableHead>
                      <TableHead className="text-center text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importJadwalPreviewRows.map((row, idx) => (
                      <TableRow key={idx} className={!row.isValid ? "bg-red-50" : ""}>
                        <TableCell className="text-xs text-slate-500">{row.rowIndex}</TableCell>
                        <TableCell className="text-xs">{row.kelas}{!row.kelasValid && <span className="text-red-500 text-xs ml-1">(tidak ditemukan)</span>}</TableCell>
                        <TableCell className="text-xs">{row.mapel}{!row.mapelValid && <span className="text-red-500 text-xs ml-1">(tidak ditemukan)</span>}</TableCell>
                        <TableCell className="text-xs">{row.nik_guru}{!row.guruValid && <span className="text-red-500 text-xs ml-1">(tidak ditemukan)</span>}</TableCell>
                        <TableCell className="text-xs">{row.hari}</TableCell>
                        <TableCell className="font-mono text-xs">{row.jam}</TableCell>
                        <TableCell className="text-center">
                          {row.isValid ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Valid</Badge>
                          ) : (
                            <div className="text-xs text-red-600">
                              {row.validationErrors?.map((err: string, i: number) => <div key={i}>{err}</div>)}
                              {!row.kelasValid && <div>Kelas tidak ditemukan</div>}
                              {!row.guruValid && <div>Guru dengan nik tersebut tidak ditemukan</div>}
                              {!row.mapelValid && <div>Mapel tidak ditemukan</div>}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => { setImportJadwalDialogOpen(false); setImportJadwalRawData([]); setImportJadwalPreviewRows([]); setImportJadwalStep("upload"); }} className="rounded-lg text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button>
                <Button onClick={confirmImportJadwal} disabled={isImportingJadwal || importJadwalPreviewRows.filter(r => r.isValid).length === 0} className="rounded-lg bg-[#2C5EAD] hover:bg-[#2C5EAD]/80 text-white text-xs sm:text-sm">
                  {isImportingJadwal ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengimpor...</> : "Impor Data"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG MISSING MAPEL UNTUK JADWAL */}
      <Dialog open={missingMapelDialogOpen} onOpenChange={setMissingMapelDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Mata Pelajaran Belum Tersedia</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Beberapa mata pelajaran dalam file Excel belum ada di database.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-yellow-800">Mapel yang belum terdaftar:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {importJadwalMissingMapels.map((mapel, idx) => <li key={idx} className="text-sm text-yellow-700">{mapel}</li>)}
              </ul>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">Apakah Anda ingin menambahkan mata pelajaran di atas ke database dan melanjutkan import jadwal?</p>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => { setMissingMapelDialogOpen(false); setImportJadwalDialogOpen(false); setImportJadwalRawData([]); }} className="rounded-lg w-full sm:w-auto text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batalkan Import</Button>
            <Button onClick={handleAddMissingMapelsAndContinue} disabled={isAddingMissingMapels} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto text-xs sm:text-sm">
              {isAddingMissingMapels ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menambahkan...</> : "Tambahkan Mapel & Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG BULK ACTION */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="rounded-xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{bulkActionType === "aktifkan" ? "Aktifkan Mata Pelajaran" : "Nonaktifkan Mata Pelajaran"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{bulkActionType === "aktifkan" ? `Aktifkan ${selectedMapelIds.length} mata pelajaran?` : `Nonaktifkan ${selectedMapelIds.length} mata pelajaran?`}</DialogDescription>
          </DialogHeader>
          <p className="text-xs sm:text-sm text-slate-600 py-2">Tindakan ini tidak dapat dibatalkan setelah dikonfirmasi.</p>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button variant="outline" onClick={() => setBulkActionDialogOpen(false)} className="rounded-lg w-full sm:w-auto text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button>
            <Button onClick={executeBulkAction} disabled={isProcessingBulk} className={`rounded-lg w-full sm:w-auto text-xs sm:text-sm ${bulkActionType === "aktifkan" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} text-white`}>
              {isProcessingBulk ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</> : (bulkActionType === "aktifkan" ? "Aktifkan" : "Nonaktifkan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}