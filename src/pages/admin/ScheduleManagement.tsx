import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  Users,
  GraduationCap,
  Shield,
  UserMinus,
  UserPlus,
  Upload,
  Download,
  CheckCircle,
  X,
  Filter,
  ChevronDown,
} from "lucide-react";

// Tipe data
interface Kelas {
  id_kelas: number;
  nama: string;
  aktif: boolean;
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
  nip?: string;
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

// Helper: konversi waktu "HH:MM" ke menit
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

// Komponen ikon tampilan
const LayoutGrid = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);

const ListIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export default function ScheduleManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"jadwal" | "mapel">("jadwal");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // State untuk jadwal
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

  // State untuk popover filter kelas
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

  // Dialog jadwal
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

  // Toggle aktif/nonaktif jadwal
  const [toggleJadwalDialogOpen, setToggleJadwalDialogOpen] = useState(false);
  const [togglingJadwal, setTogglingJadwal] = useState<Jadwal | null>(null);
  const [isActivatingJadwalMode, setIsActivatingJadwalMode] = useState(false);

  // State untuk mata pelajaran
  const [mapelData, setMapelData] = useState<MataPelajaran[]>([]);
  const [isFetchingMapel, setIsFetchingMapel] = useState(false);
  const [mapelDialogOpen, setMapelDialogOpen] = useState(false);
  const [editingMapel, setEditingMapel] = useState<MataPelajaran | null>(null);
  const [mapelForm, setMapelForm] = useState({ nama: "" });
  const [isSavingMapel, setIsSavingMapel] = useState(false);
  const [mapelSearchTerm, setMapelSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"semua" | "aktif" | "nonaktif">("semua");

  // State untuk toggle aktif/nonaktif mapel (single)
  const [toggleMapelDialogOpen, setToggleMapelDialogOpen] = useState(false);
  const [togglingMapel, setTogglingMapel] = useState<MataPelajaran | null>(null);
  const [isActivatingMapelMode, setIsActivatingMapelMode] = useState(false);

  // State untuk import Excel mapel
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // State untuk bulk action mapel
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMapelIds, setSelectedMapelIds] = useState<number[]>([]);
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"aktifkan" | "nonaktifkan">("aktifkan");
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // State untuk pagination mapel
  const [mapelCurrentPage, setMapelCurrentPage] = useState(1);
  const mapelItemsPerPage = 10;

  // ==================== GREETING ====================
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

  // ========== FETCH DATA ==========
  const fetchKelas = async () => {
    const { data, error } = await supabase.from("kelas").select("id_kelas, nama, aktif").eq("aktif", true).order("nama");
    if (!error) setKelasList(data || []);
  };

  const fetchGuru = async () => {
    const { data, error } = await supabase.from("guru").select("id_guru, nama, nip, aktif").eq("aktif", true).order("nama");
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
      let query = supabase
        .from("jadwal")
        .select(`
          id_jadwal, id_kelas, id_mapel, id_guru, hari, jam, aktif,
          kelas:kelas (nama),
          mapel:mata_pelajaran (nama, aktif),
          guru:guru (nama, aktif)
        `)
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("hari", selectedHari);

      const { data, error } = await query.order("jam");
      if (error) throw error;
      setJadwalList(data || []);
      
      const activeJadwal = data?.filter(j => j.aktif === true) || [];
      const totalKelas = new Set(activeJadwal.map(j => j.id_kelas)).size;
      const totalMapel = new Set(activeJadwal.map(j => j.id_mapel)).size;
      const totalGuru = new Set(activeJadwal.map(j => j.id_guru)).size;
      const hariCount: Record<string, number> = {};
      const jamCount: Record<string, number> = {};
      const guruCount: Record<string, number> = {};
      activeJadwal.forEach(j => {
        hariCount[j.hari] = (hariCount[j.hari] || 0) + 1;
        const jamMulai = j.jam.split(" - ")[0];
        jamCount[jamMulai] = (jamCount[jamMulai] || 0) + 1;
        guruCount[(j.guru as any)?.nama || "-"] = (guruCount[(j.guru as any)?.nama || "-"] || 0) + 1;
      });
      setStatistik({
        totalJadwal: activeJadwal.length,
        totalKelas, totalMapel, totalGuru,
        hariTersibuk: Object.entries(hariCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "-",
        jamTersibuk: Object.entries(jamCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "-",
        guruTersibuk: Object.entries(guruCount).sort((a,b)=>b[1]-a[1])[0]?.[0] || "-",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingJadwal(false);
    }
  };

  // ========== INIT ==========
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

  // ========== VALIDASI OVERLAP ==========
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

  // ========== CRUD JADWAL ==========
  const openAddJadwal = () => {
    setEditingJadwal(null);
    setFormErrors({});
    setJadwalForm({ id_kelas: selectedKelas || "", id_mapel: "", id_guru: "", hari: selectedHari, jam: "" });
    setJadwalDialogOpen(true);
  };

  const openEditJadwal = (jadwal: Jadwal) => {
    setEditingJadwal(jadwal);
    setFormErrors({});
    setJadwalForm({
      id_kelas: jadwal.id_kelas.toString(),
      id_mapel: jadwal.id_mapel.toString(),
      id_guru: jadwal.id_guru.toString(),
      hari: jadwal.hari,
      jam: jadwal.jam,
    });
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

  // Toggle jadwal
  const confirmToggleJadwal = (jadwal: Jadwal, isActivating: boolean) => {
    setTogglingJadwal(jadwal);
    setIsActivatingJadwalMode(isActivating);
    setToggleJadwalDialogOpen(true);
  };

  const executeToggleJadwal = async () => {
    if (!togglingJadwal) return;
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

  // ========== CRUD MAPEL ==========
  const openAddMapel = () => { setEditingMapel(null); setMapelForm({ nama: "" }); setMapelDialogOpen(true); };
  const openEditMapel = (mapel: MataPelajaran) => { setEditingMapel(mapel); setMapelForm({ nama: mapel.nama }); setMapelDialogOpen(true); };

  const handleSaveMapel = async () => {
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

  // Toggle mapel single
  const confirmToggleMapel = (mapel: MataPelajaran, isActivating: boolean) => {
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
    if (!togglingMapel) return;
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

  // ========== IMPORT EXCEL MAPEL ==========
  const downloadTemplateMapel = () => {
    const headers = ["nama"];
    const data = [["Matematika"], ["Fisika"], ["Kimia"], ["Biologi"], ["Bahasa Indonesia"]];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Mapel");
    XLSX.writeFile(wb, "template_impor_mapel.xlsx");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!previewData.length) return;
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

  // ========== BULK ACTION MAPEL ==========
  const handleSelectAll = () => {
    const filtered = filteredMapel;
    if (selectedMapelIds.length === filtered.length && filtered.length > 0) setSelectedMapelIds([]);
    else setSelectedMapelIds(filtered.map(m => m.id_mapel));
  };

  const handleSelectItem = (id: number) => {
    setSelectedMapelIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = (action: "aktifkan" | "nonaktifkan") => {
    if (selectedMapelIds.length === 0) {
      toast({ title: "Tidak ada data dipilih", variant: "destructive" });
      return;
    }
    setBulkActionType(action);
    setBulkActionDialogOpen(true);
  };

  const executeBulkAction = async () => {
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

  // ========== FILTER MAPEL ==========
  const filteredMapel = useMemo(() => {
    let filtered = mapelData;
    if (statusFilter === "aktif") filtered = filtered.filter(m => m.aktif === true);
    if (statusFilter === "nonaktif") filtered = filtered.filter(m => m.aktif === false);
    if (mapelSearchTerm) filtered = filtered.filter(m => m.nama.toLowerCase().includes(mapelSearchTerm.toLowerCase()));
    return filtered;
  }, [mapelData, mapelSearchTerm, statusFilter]);

  // ========== PAGINATION MAPEL ==========
  const mapelTotalPages = useMemo(() => Math.ceil(filteredMapel.length / mapelItemsPerPage), [filteredMapel.length]);
  const paginatedMapel = useMemo(() => {
    const start = (mapelCurrentPage - 1) * mapelItemsPerPage;
    return filteredMapel.slice(start, start + mapelItemsPerPage);
  }, [filteredMapel, mapelCurrentPage]);

  useEffect(() => {
    setMapelCurrentPage(1);
  }, [statusFilter, mapelSearchTerm]);

  // ========== HANDLE REFRESH ==========
  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchJadwal(), fetchMapel()]).finally(() => setRefreshing(false));
  };

  // ========== LOADING ==========
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-600 font-medium">Memuat Manajemen Jadwal</p>
        </div>
      </div>
    );
  }

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* HEADER (sama) */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><Calendar className="h-8 w-8" /></div>
              <div>
                <div className="flex items-center gap-2">{getGreetingIcon()}<p className="text-sm text-blue-100">{greeting}</p></div>
                <h1 className="text-2xl lg:text-3xl font-bold">Manajemen Jadwal & Mata Pelajaran</h1>
                <p className="text-blue-100 text-sm">Atur jadwal pelajaran per kelas dan kelola daftar mata pelajaran</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
              <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 text-white rounded-xl" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* STATS CARDS (sama) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4"><div className="flex justify-between"><div><p className="text-xs text-blue-600 font-medium">Total Kelas</p><p className="text-2xl font-bold text-blue-900">{kelasList.length}</p></div><School className="h-8 w-8 text-blue-500" /></div></CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4"><div className="flex justify-between"><div><p className="text-xs text-emerald-600 font-medium">Total Mapel</p><p className="text-2xl font-bold text-emerald-900">{mapelData.length}</p></div><BookOpen className="h-8 w-8 text-emerald-500" /></div></CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4"><div className="flex justify-between"><div><p className="text-xs text-purple-600 font-medium">Total Guru</p><p className="text-2xl font-bold text-purple-900">{guruList.length}</p></div><User className="h-8 w-8 text-purple-500" /></div></CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4"><div className="flex justify-between"><div><p className="text-xs text-amber-600 font-medium">Total Jadwal Aktif</p><p className="text-2xl font-bold text-amber-900">{statistik.totalJadwal}</p></div><Calendar className="h-8 w-8 text-amber-500" /></div></CardContent>
          </Card>
        </div>

        {/* DETAIL STATISTIK JADWAL (sama) */}
        {activeTab === "jadwal" && selectedKelas && jadwalList.length > 0 && (
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <CardContent className="p-5"><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"><div><p className="text-xs text-slate-300">Total Jadwal Aktif</p><p className="text-2xl font-bold">{statistik.totalJadwal}</p></div><div><p className="text-xs text-slate-300">Hari Tersibuk</p><p className="text-lg font-semibold">{statistik.hariTersibuk}</p></div><div><p className="text-xs text-slate-300">Jam Tersibuk</p><p className="text-lg font-semibold">{statistik.jamTersibuk}</p></div><div><p className="text-xs text-slate-300">Guru Tersibuk</p><p className="text-lg font-semibold truncate">{statistik.guruTersibuk}</p></div></div></CardContent>
          </Card>
        )}

        {/* MAIN TABS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3"><div className="bg-white/10 p-2 rounded-xl"><Calendar className="h-6 w-6" /></div><div><CardTitle className="text-xl">Manajemen Jadwal & Mata Pelajaran</CardTitle><CardDescription className="text-slate-300 text-sm">Atur jadwal pelajaran per kelas dan kelola daftar mata pelajaran</CardDescription></div></div>
              {activeTab === "jadwal" && (
                <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
                  <Button variant="ghost" size="sm" className={`rounded-lg text-white ${viewMode === "table" ? "bg-white/20" : ""}`} onClick={() => setViewMode("table")}><LayoutGrid className="h-4 w-4 mr-1" />Tabel</Button>
                  <Button variant="ghost" size="sm" className={`rounded-lg text-white ${viewMode === "card" ? "bg-white/20" : ""}`} onClick={() => setViewMode("card")}><ListIcon className="h-4 w-4 mr-1" />Kartu</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="jadwal" className="rounded-lg data-[state=active]:bg-white"><Calendar className="h-3.5 w-3.5 mr-1" /> Jadwal Pelajaran</TabsTrigger>
                  <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white"><BookOpen className="h-3.5 w-3.5 mr-1" /> Mata Pelajaran</TabsTrigger>
                </TabsList>
              </div>

              {/* TAB JADWAL - DENGAN POPOVER PILIH KELAS */}
              <TabsContent value="jadwal" className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end justify-center">
                  {/* Pilih Kelas dengan Popover */}
                  <div className="w-64">
                    <Label className="text-slate-700 font-medium">Kelas</Label>
                    <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between rounded-xl border-slate-200 h-9 text-sm font-normal mt-1">
                          {selectedKelas ? kelasList.find(k => k.id_kelas.toString() === selectedKelas)?.nama || "Pilih Kelas" : "Pilih Kelas"}
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                        <div className="p-2 border-b bg-slate-50">
                          <div className="flex gap-1 mb-2">
                            {["all", "X", "XI", "XII"].map(jenjang => (
                              <Button key={jenjang} variant={kelasJenjangFilter === jenjang ? "default" : "ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md ${kelasJenjangFilter === jenjang ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setKelasJenjangFilter(jenjang)}>
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
                              <button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelas === kelas.id_kelas.toString() ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`} onClick={() => { setSelectedKelas(kelas.id_kelas.toString()); setPopoverKelasOpen(false); setKelasSearchQuery(""); setKelasJenjangFilter("all"); }}>
                                {kelas.nama}
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Hari */}
                  <div className="w-40">
                    <Label className="text-slate-700 font-medium">Hari</Label>
                    <Select value={selectedHari} onValueChange={setSelectedHari}>
                      <SelectTrigger className="rounded-xl h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HARI.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button variant="outline" onClick={fetchJadwal} disabled={!selectedKelas || isFetchingJadwal} className="rounded-xl h-9">
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingJadwal ? "animate-spin" : ""}`} /> Segarkan
                  </Button>

                  <Button onClick={openAddJadwal} disabled={!selectedKelas} className="rounded-xl h-9 bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Jadwal
                  </Button>
                </div>

                {!selectedKelas && (
                  <Alert className="rounded-xl bg-amber-50 max-w-md mx-auto">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700">Silakan pilih kelas terlebih dahulu</AlertDescription>
                  </Alert>
                )}

                {selectedKelas && viewMode === "table" && (
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Jam</TableHead>
                            <TableHead>Mata Pelajaran</TableHead>
                            <TableHead>Guru</TableHead>
                            <TableHead className="text-center">Hari</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center w-28">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isFetchingJadwal ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                          ) : jadwalList.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500"><Calendar className="h-8 w-8 mx-auto mb-2" />Tidak ada jadwal untuk hari {selectedHari}</TableCell></TableRow>
                          ) : (
                            jadwalList.map(j => (
                              <TableRow key={j.id_jadwal}>
                                <TableCell className="font-mono text-sm font-medium">{j.jam}</TableCell>
                                <TableCell><div className="flex items-center gap-2"><div className="bg-blue-100 p-1.5 rounded-lg"><BookOpen className="h-4 w-4 text-blue-600" /></div><span className="font-medium">{j.mapel?.nama || "-"}{j.mapel?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span></div></TableCell>
                                <TableCell><div className="flex items-center gap-2"><div className="bg-purple-100 p-1.5 rounded-lg"><User className="h-4 w-4 text-purple-600" /></div><span>{j.guru?.nama || "-"}{j.guru?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span></div></TableCell>
                                <TableCell className="text-center"><Badge className={`${getHariColor(j.hari)} border-0 rounded-full px-3 py-1`}>{j.hari}</Badge></TableCell>
                                <TableCell className="text-center"><Badge className={`${getStatusColor(j.aktif)} border-0 rounded-full px-3 py-1`}>{j.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                                <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditJadwal(j)}><Edit className="h-4 w-4 text-blue-500" /></Button>{j.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, false)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, true)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {selectedKelas && viewMode === "card" && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {jadwalList.map(j => (
                      <Card key={j.id_jadwal} className="rounded-xl border-0 shadow-md overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rounded-full ${getHariColor(j.hari)} opacity-20 group-hover:scale-150 transition-transform`} />
                        <CardContent className="p-4 relative">
                          <div className="flex justify-between mb-3">
                            <Badge className={getHariColor(j.hari)}>{j.hari}</Badge>
                            <span className="font-mono text-sm font-bold">{j.jam}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2"><div className="bg-blue-100 p-2 rounded-xl"><BookOpen className="h-4 w-4 text-blue-600" /></div><span className="font-semibold">{j.mapel?.nama || "-"}{j.mapel?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span></div>
                            <div className="flex items-center gap-2"><div className="bg-purple-100 p-2 rounded-xl"><User className="h-4 w-4 text-purple-600" /></div><span>{j.guru?.nama || "-"}{j.guru?.aktif === false && <span className="ml-1 text-xs text-red-500">(nonaktif)</span>}</span></div>
                            <div><Badge className={getStatusColor(j.aktif)}>{j.aktif ? "Aktif" : "Nonaktif"}</Badge></div>
                          </div>
                          <div className="flex gap-2 mt-3 pt-3 border-t">
                            <Button variant="ghost" size="sm" onClick={() => openEditJadwal(j)} className="flex-1"><Edit className="h-4 w-4 mr-1" /> Edit</Button>
                            {j.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, false)} className="flex-1 text-red-500"><UserMinus className="h-4 w-4 mr-1" /> Nonaktif</Button> : <Button variant="ghost" size="sm" onClick={() => confirmToggleJadwal(j, true)} className="flex-1 text-green-500"><UserPlus className="h-4 w-4 mr-1" /> Aktif</Button>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* TAB MATA PELAJARAN (tidak berubah) */}
              <TabsContent value="mapel" className="space-y-6">
                {/* ... (kode mapel tetap seperti asli, tidak diubah) ... */}
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="flex gap-2"><Button onClick={openAddMapel} className="rounded-xl h-9 bg-gradient-to-r from-blue-600 to-indigo-600"><Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Mapel</Button><Button variant="outline" onClick={() => setImportDialogOpen(true)} className="rounded-xl h-9"><Upload className="mr-1.5 h-3.5 w-3.5" /> Impor Excel</Button></div>
                  <div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Cari mapel..." value={mapelSearchTerm} onChange={(e) => setMapelSearchTerm(e.target.value)} className="pl-9 rounded-xl w-64 h-9 text-sm" /></div><Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}><SelectTrigger className="w-36 h-9 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="semua">Semua</SelectItem><SelectItem value="aktif">Aktif</SelectItem><SelectItem value="nonaktif">Nonaktif</SelectItem></SelectContent></Select><Button variant="outline" onClick={fetchMapel} disabled={isFetchingMapel} className="rounded-xl h-9"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingMapel ? "animate-spin" : ""}`} /> Segarkan</Button></div>
                </div>
                <div className="flex justify-between items-center"><div className="flex gap-2"><Button variant={selectMode ? "default" : "outline"} onClick={() => { setSelectMode(!selectMode); if (!selectMode) setSelectedMapelIds([]); }} className="rounded-xl h-9">{selectMode ? "Batalkan Mode Pilih" : "Mode Pilih"}</Button>{selectMode && <><Button variant="default" onClick={() => handleBulkAction("aktifkan")} disabled={selectedMapelIds.length === 0 || isProcessingBulk} className="bg-green-600 hover:bg-green-700 rounded-xl h-9">Aktifkan ({selectedMapelIds.filter(id => !mapelData.find(m => m.id_mapel === id)?.aktif).length})</Button><Button variant="destructive" onClick={() => handleBulkAction("nonaktifkan")} disabled={selectedMapelIds.length === 0 || isProcessingBulk} className="rounded-xl h-9">Nonaktifkan ({selectedMapelIds.filter(id => mapelData.find(m => m.id_mapel === id)?.aktif).length})</Button></>}</div>{selectMode && <Button variant="ghost" size="sm" onClick={handleSelectAll} className="text-sm">Pilih Semua</Button>}</div>
                <div className="border rounded-xl overflow-hidden shadow-sm"><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50">{selectMode && <TableHead className="w-10"><Checkbox checked={selectedMapelIds.length === paginatedMapel.length && paginatedMapel.length > 0} onCheckedChange={handleSelectAll} /></TableHead>}<TableHead>Nama Mata Pelajaran</TableHead><TableHead className="text-center w-24">Status</TableHead><TableHead className="text-center w-28">Aksi</TableHead></TableRow></TableHeader><TableBody>{isFetchingMapel ? <TableRow><TableCell colSpan={selectMode ? 4 : 3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : filteredMapel.length === 0 ? <TableRow><TableCell colSpan={selectMode ? 4 : 3} className="text-center py-8 text-slate-500"><BookOpen className="h-8 w-8 mx-auto mb-2" />{mapelSearchTerm ? "Tidak ada mata pelajaran yang cocok" : "Belum ada mata pelajaran"}</TableCell></TableRow> : paginatedMapel.map(m => (<TableRow key={m.id_mapel}>{selectMode && <TableCell><Checkbox checked={selectedMapelIds.includes(m.id_mapel)} onCheckedChange={() => handleSelectItem(m.id_mapel)} /></TableCell>}<TableCell className="font-medium">{m.nama}</TableCell><TableCell className="text-center"><Badge className={`${getStatusColor(m.aktif)} border-0 rounded-full px-3 py-1`}>{m.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell><TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditMapel(m)}><Edit className="h-4 w-4 text-blue-500" /></Button>{m.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmToggleMapel(m, false)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmToggleMapel(m, true)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell></TableRow>))}</TableBody></Table></div></div>
                {filteredMapel.length > 0 && (<div className="flex items-center justify-between"><p className="text-sm text-slate-600">Menampilkan {((mapelCurrentPage - 1) * mapelItemsPerPage) + 1}-{Math.min(mapelCurrentPage * mapelItemsPerPage, filteredMapel.length)} dari {filteredMapel.length} mata pelajaran</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setMapelCurrentPage(p => Math.max(1, p - 1))} disabled={mapelCurrentPage === 1} className="rounded-lg h-8">Sebelumnya</Button><div className="flex items-center gap-1">{Array.from({ length: Math.min(mapelTotalPages, 5) }, (_, i) => i + 1).map((page) => (<Button key={page} variant={mapelCurrentPage === page ? "default" : "outline"} size="sm" onClick={() => setMapelCurrentPage(page)} className="rounded-lg h-8 w-8 p-0">{page}</Button>))}</div><Button variant="outline" size="sm" onClick={() => setMapelCurrentPage(p => Math.min(mapelTotalPages, p + 1))} disabled={mapelCurrentPage === mapelTotalPages} className="rounded-lg h-8">Berikutnya</Button></div></div>)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS & FOOTER (sama) */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 max-w-3xl mx-auto">
          <CardContent className="p-5"><div className="flex gap-4"><div className="bg-indigo-100 p-3 rounded-xl"><Sparkles className="h-6 w-6 text-indigo-600" /></div><div><h3 className="font-semibold">Tips Mengelola Jadwal</h3><p className="text-sm text-slate-600">Pastikan tidak ada tumpang tindih jadwal untuk guru yang sama. Sistem akan otomatis memvalidasi overlap jadwal. Gunakan filter kelas dan hari untuk melihat jadwal spesifik. Anda dapat menonaktifkan jadwal atau mata pelajaran tanpa menghapus datanya.</p></div></div></CardContent>
        </Card>
        <div className="text-center pt-4"><Separator className="mb-4" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen Jadwal - SmartAS</p><p className="text-[10px] text-slate-300 mt-1">Sistem Informasi Akademik</p></div>
      </div>

      {/* DIALOGS (semua dialog tetap sama seperti asli) */}
      {/* Dialog Jadwal, Toggle Jadwal, Mapel, Import, Bulk, dll. (tidak diubah) */}
      {/* ... (salin dari kode asli, tidak saya tulis ulang agar tidak terlalu panjang) */}
    </div>
  );
}