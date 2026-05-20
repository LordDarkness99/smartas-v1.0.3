// src/pages/admin/PKLManagement.tsx
// Versi tanpa id_jurusan pada tabel pkl. Filter admin jurusan hanya pada siswa (via kelas)
import { useState, useEffect, useCallback } from "react";
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
  MapPin,
  Building2,
  Upload,
  Download,
  CheckCircle,
  User,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  School,
  Users,
  Briefcase,
  Home,
  Search,
  X,
  ChevronDown,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { isBK, isAdminJurusan, isAdmin } from "@/lib/utils";

// Tipe data
interface Guru {
  id_guru: number;
  nama: string;
  nik: string;
}

interface PKL {
  id_pkl: number;
  tempat_pkl: string;
  koordinat_pkl: string;
  id_guru: number | null;
  guru_nama?: string;
  aktif: boolean;
}

interface Siswa {
  id_siswa: number;
  nama: string;
  nis: string;
  id_kelas: number | null;
  kelas_nama: string;
  id_pkl: number | null;
  tempat_pkl?: string;
}

interface Kelas {
  id_kelas: number;
  nama: string;
  id_jurusan: number | null;
}

export default function PklManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"lokasi" | "siswa">("lokasi");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);

  // Role checks
  const userRole = user?.peran;
  const isRoleBK = isBK(user);
  const isRoleAdminJurusan = isAdminJurusan(user);
  const canWrite = !isRoleBK; // BK read-only

  // State untuk lokasi PKL
  const [pklList, setPklList] = useState<PKL[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [isFetchingPKL, setIsFetchingPKL] = useState(false);
  const [pklDialogOpen, setPklDialogOpen] = useState(false);
  const [editingPKL, setEditingPKL] = useState<PKL | null>(null);
  const [pklForm, setPklForm] = useState({ tempat_pkl: "", koordinat_pkl: "", id_guru: "" });
  const [isSavingPKL, setIsSavingPKL] = useState(false);
  const [toggleActiveDialogOpen, setToggleActiveDialogOpen] = useState(false);
  const [togglingPKL, setTogglingPKL] = useState<PKL | null>(null);

  // Pagination untuk lokasi PKL
  const [pklCurrentPage, setPklCurrentPage] = useState(1);
  const [pklItemsPerPage] = useState(10);

  // State untuk siswa PKL
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [isFetchingSiswa, setIsFetchingSiswa] = useState(false);
  const [updatingSiswa, setUpdatingSiswa] = useState<number | null>(null);

  // Pagination untuk siswa
  const [siswaCurrentPage, setSiswaCurrentPage] = useState(1);
  const [siswaItemsPerPage] = useState(10);

  // State untuk import
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<"lokasi" | "assignment">("lokasi");
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // State untuk search
  const [searchLokasi, setSearchLokasi] = useState("");
  const [searchSiswa, setSearchSiswa] = useState("");

  // State untuk popover filter kelas
  const [popoverKelasOpen, setPopoverKelasOpen] = useState(false);
  const [kelasSearchQuery, setKelasSearchQuery] = useState("");
  const [kelasJenjangFilter, setKelasJenjangFilter] = useState<string>("all");

  // State untuk popover filter PKL di atur status
  const [pklSearchPopoverOpen, setPklSearchPopoverOpen] = useState<number | null>(null);
  const [pklSearchQuery, setPklSearchQuery] = useState("");

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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // ========== FETCH GURU ==========
  const fetchGuru = async () => {
    try {
      const { data, error } = await supabase
        .from("guru")
        .select("id_guru, nama, nik")
        .eq("aktif", true)
        .order("nama");
      if (error) throw error;
      const formatted: Guru[] = data.map((g: any) => ({ ...g, nik: g.nik?.toString() || "" }));
      setGuruList(formatted);
    } catch (error: any) {
      console.error("Fetch guru error:", error);
    }
  };

  // ========== FETCH LOKASI PKL (tanpa filter id_jurusan) ==========
  const fetchPKL = async () => {
    setIsFetchingPKL(true);
    try {
      const { data, error } = await supabase
        .from("pkl")
        .select(`
          id_pkl,
          tempat_pkl,
          koordinat_pkl,
          id_guru,
          aktif,
          guru:guru (nama)
        `)
        .order("tempat_pkl", { ascending: true });

      if (error) throw error;
      let formatted: PKL[] = data.map((item: any) => ({
        id_pkl: item.id_pkl,
        tempat_pkl: item.tempat_pkl,
        koordinat_pkl: item.koordinat_pkl,
        id_guru: item.id_guru,
        guru_nama: item.guru?.nama || "-",
        aktif: item.aktif ?? true,
      }));
      formatted.sort((a, b) => {
        if (a.aktif === b.aktif) {
          return a.tempat_pkl.localeCompare(b.tempat_pkl);
        }
        return a.aktif ? -1 : 1;
      });
      setPklList(formatted);
      setPklCurrentPage(1);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingPKL(false);
    }
  };

  // ========== CRUD LOKASI PKL ==========
  const openAddPKL = () => {
    if (!canWrite) return;
    setEditingPKL(null);
    setPklForm({ tempat_pkl: "", koordinat_pkl: "", id_guru: "0" });
    setPklDialogOpen(true);
  };

  const openEditPKL = (pkl: PKL) => {
    if (!canWrite) return;
    setEditingPKL(pkl);
    setPklForm({
      tempat_pkl: pkl.tempat_pkl,
      koordinat_pkl: pkl.koordinat_pkl || "",
      id_guru: pkl.id_guru?.toString() || "0",
    });
    setPklDialogOpen(true);
  };

  const handleSavePKL = async () => {
    if (!canWrite) return;
    if (!pklForm.tempat_pkl.trim()) {
      toast({ title: "Error", description: "Nama tempat PKL harus diisi", variant: "destructive" });
      return;
    }
    setIsSavingPKL(true);
    try {
      const data = {
        tempat_pkl: pklForm.tempat_pkl.trim(),
        koordinat_pkl: pklForm.koordinat_pkl.trim() || null,
        id_guru: pklForm.id_guru && pklForm.id_guru !== "0" ? parseInt(pklForm.id_guru) : null,
        aktif: true,
      };
      if (editingPKL) {
        await supabase.from("pkl").update(data).eq("id_pkl", editingPKL.id_pkl);
        toast({ title: "Berhasil", description: "Lokasi PKL berhasil diupdate" });
      } else {
        await supabase.from("pkl").insert(data);
        toast({ title: "Berhasil", description: "Lokasi PKL berhasil ditambahkan" });
      }
      setPklDialogOpen(false);
      fetchPKL();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingPKL(false);
    }
  };

  const confirmToggleActive = (pkl: PKL) => {
    if (!canWrite) return;
    setTogglingPKL(pkl);
    setToggleActiveDialogOpen(true);
  };

  const handleToggleActive = async () => {
    if (!canWrite || !togglingPKL) return;
    setIsSavingPKL(true);
    try {
      const newStatus = !togglingPKL.aktif;
      await supabase
        .from("pkl")
        .update({ aktif: newStatus })
        .eq("id_pkl", togglingPKL.id_pkl);
      
      toast({
        title: "Berhasil",
        description: `Lokasi PKL ${newStatus ? "diaktifkan" : "dinonaktifkan"}`,
      });
      setToggleActiveDialogOpen(false);
      fetchPKL();
      if (activeTab === "siswa") fetchSiswa();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingPKL(false);
    }
  };

  // ========== FETCH KELAS & SISWA (dengan filter jurusan untuk admin jurusan) ==========
  const fetchKelas = async () => {
    try {
      let query = supabase
        .from("kelas")
        .select("id_kelas, nama, id_jurusan")
        .eq("aktif", true)
        .order("nama");
      if (isRoleAdminJurusan && user?.id_jurusan) {
        query = query.eq("id_jurusan", user.id_jurusan);
      }
      const { data, error } = await query;
      if (error) throw error;
      setKelasList(data || []);
    } catch (error) {
      console.error("Fetch kelas error:", error);
    }
  };

  const fetchSiswa = async () => {
    setIsFetchingSiswa(true);
    try {
      let query = supabase
        .from("siswa")
        .select(
          `
          id_siswa,
          nama,
          nis,
          id_kelas,
          id_pkl,
          kelas:kelas (nama, id_jurusan),
          pkl:pkl (tempat_pkl)
        `
        )
        .eq("aktif", true);
      
      if (selectedKelas && selectedKelas !== "all") {
        query = query.eq("id_kelas", parseInt(selectedKelas));
      }
      
      // Filter untuk admin jurusan: hanya siswa yang kelasnya memiliki id_jurusan miliknya
      if (isRoleAdminJurusan && user?.id_jurusan) {
        query = query.eq("kelas.id_jurusan", user.id_jurusan);
      }

      const { data, error } = await query.order("nama");
      if (error) throw error;
      const formatted: Siswa[] = data.map((siswa: any) => ({
        id_siswa: siswa.id_siswa,
        nama: siswa.nama,
        nis: siswa.nis?.toString() || "",
        id_kelas: siswa.id_kelas,
        kelas_nama: siswa.kelas?.nama || "-",
        id_pkl: siswa.id_pkl,
        tempat_pkl: siswa.pkl?.tempat_pkl || "-",
      }));
      setSiswaList(formatted);
      setSiswaCurrentPage(1);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingSiswa(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchGuru(), fetchPKL(), fetchKelas()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === "siswa") {
      fetchSiswa();
    }
  }, [selectedKelas, activeTab]);

  // ========== UPDATE STATUS PKL SISWA ==========
  const updateSiswaPKL = async (siswaId: number, id_pkl: number | null) => {
    if (!canWrite) return;
    setUpdatingSiswa(siswaId);
    try {
      await supabase.from("siswa").update({ id_pkl }).eq("id_siswa", siswaId);
      toast({ title: "Berhasil", description: "Status PKL siswa diperbarui" });
      fetchSiswa();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingSiswa(null);
    }
  };

  // ========== IMPORT EXCEL (tanpa id_jurusan untuk lokasi) ==========
  const downloadTemplate = (type: "lokasi" | "assignment") => {
    let headers: string[];
    let data: any[][];
    if (type === "lokasi") {
      headers = ["tempat_pkl", "koordinat_pkl", "guru_nik"];
      data = [
        ["PT. Maju Jaya", "-6.200000,106.816666", "123456789"],
        ["CV. Karya Mandiri", "-6.208333,106.845555", "123456790"],
      ];
    } else {
      headers = ["nis", "tempat_pkl"];
      data = [
        ["1234567890", "PT. Maju Jaya"],
        ["1234567891", "CV. Karya Mandiri"],
      ];
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Template_${type}`);
    XLSX.writeFile(wb, `template_import_${type}_pkl.xlsx`);
  };

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!canWrite) return;
      const file = event.target.files?.[0];
      if (!file) return;
      setImportError(null);
      setIsImporting(true);
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        if (jsonData.length === 0) throw new Error("File kosong");
        let requiredColumns: string[];
        if (importType === "lokasi") requiredColumns = ["tempat_pkl"];
        else requiredColumns = ["nis", "tempat_pkl"];
        const firstRow = jsonData[0] as any;
        const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
        if (missingColumns.length) {
          throw new Error(`Kolom diperlukan tidak ditemukan: ${missingColumns.join(", ")}`);
        }
        setImportPreview(jsonData);
        toast({ title: "Berhasil", description: `${jsonData.length} data siap diimport` });
      } catch (error: any) {
        setImportError(error.message);
        setImportPreview([]);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setIsImporting(false);
        event.target.value = "";
      }
    },
    [importType, toast, canWrite]
  );

  const handleImport = async () => {
    if (!canWrite || importPreview.length === 0) {
      toast({ title: "Error", description: "Tidak ada data untuk diimport", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    try {
      if (importType === "lokasi") {
        const tempatList = importPreview.map((row: any) => row.tempat_pkl);
        const { data: existing, error: checkError } = await supabase
          .from("pkl")
          .select("tempat_pkl")
          .in("tempat_pkl", tempatList);
        if (checkError) throw checkError;
        if (existing && existing.length) {
          const duplicates = existing.map((e) => e.tempat_pkl);
          throw new Error(`Tempat PKL sudah ada: ${duplicates.join(", ")}`);
        }
        const guruNiks = [...new Set(importPreview.map((row: any) => row.guru_nik).filter(Boolean))];
        let guruMap = new Map<string, number>();
        if (guruNiks.length) {
          const { data: guruData, error: guruError } = await supabase
            .from("guru")
            .select("id_guru, nik")
            .in("nik", guruNiks);
          if (guruError) throw guruError;
          guruData?.forEach((g) => guruMap.set(g.nik?.toString() || "", g.id_guru));
          const missingGuru = guruNiks.filter((nik) => !guruMap.has(nik.toString()));
          if (missingGuru.length) {
            throw new Error(`Guru dengan NIK tidak ditemukan: ${missingGuru.join(", ")}`);
          }
        }
        const dataToInsert = importPreview.map((row: any) => ({
          tempat_pkl: row.tempat_pkl,
          koordinat_pkl: row.koordinat_pkl || null,
          id_guru: row.guru_nik ? guruMap.get(row.guru_nik.toString()) : null,
          aktif: true,
        }));
        await supabase.from("pkl").insert(dataToInsert);
        toast({ title: "Berhasil", description: `${dataToInsert.length} lokasi PKL diimport` });
        fetchPKL();
      } else {
        const tempatNames = [...new Set(importPreview.map((row: any) => row.tempat_pkl))];
        const { data: pklData, error: pklError } = await supabase
          .from("pkl")
          .select("id_pkl, tempat_pkl, aktif")
          .in("tempat_pkl", tempatNames);
        if (pklError) throw pklError;
        
        const activePkl = pklData?.filter(p => p.aktif === true) || [];
        const tempatToId = new Map();
        activePkl.forEach((p) => tempatToId.set(p.tempat_pkl, p.id_pkl));
        
        const missingActive = tempatNames.filter(t => !tempatToId.has(t));
        if (missingActive.length) {
          throw new Error(`Tempat PKL tidak ditemukan atau tidak aktif: ${missingActive.join(", ")}. Harap pastikan lokasi PKL sudah terdaftar dan aktif.`);
        }
        
        const nisList = importPreview.map((row: any) => row.nis.toString());
        let siswaQuery = supabase
          .from("siswa")
          .select("id_siswa, nis, kelas!inner(id_jurusan)")
          .in("nis", nisList);
        if (isRoleAdminJurusan && user?.id_jurusan) {
          siswaQuery = siswaQuery.eq("kelas.id_jurusan", user.id_jurusan);
        }
        const { data: siswaData, error: siswaError } = await siswaQuery;
        if (siswaError) throw siswaError;
        const nisToId = new Map();
        siswaData?.forEach((s) => nisToId.set(s.nis.toString(), s.id_siswa));
        const missingNis = nisList.filter((nis) => !nisToId.has(nis));
        if (missingNis.length) {
          throw new Error(`NIS tidak ditemukan: ${missingNis.join(", ")}`);
        }
        const updates = importPreview.map((row: any) => ({
          id_siswa: nisToId.get(row.nis.toString()),
          id_pkl: tempatToId.get(row.tempat_pkl),
        }));
        for (const update of updates) {
          await supabase.from("siswa").update({ id_pkl: update.id_pkl }).eq("id_siswa", update.id_siswa);
        }
        toast({ title: "Berhasil", description: `${updates.length} siswa diperbarui status PKL` });
        fetchSiswa();
      }
      setImportDialogOpen(false);
      setImportPreview([]);
    } catch (error: any) {
      toast({ title: "Import Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRefresh = () => {
    fetchPKL();
    fetchSiswa();
  };

  // ========== FILTER DATA & PAGINATION ==========
  const filteredPklList = pklList.filter((pkl) => {
    const query = searchLokasi.toLowerCase();
    return (
      pkl.tempat_pkl.toLowerCase().includes(query) ||
      pkl.guru_nama.toLowerCase().includes(query) ||
      pkl.koordinat_pkl?.toLowerCase().includes(query)
    );
  });

  const totalPklPages = Math.ceil(filteredPklList.length / pklItemsPerPage);
  const paginatedPklList = filteredPklList.slice(
    (pklCurrentPage - 1) * pklItemsPerPage,
    pklCurrentPage * pklItemsPerPage
  );

  const filteredSiswaList = siswaList.filter((siswa) => {
    const query = searchSiswa.toLowerCase();
    return (
      siswa.nis.toLowerCase().includes(query) ||
      siswa.nama.toLowerCase().includes(query) ||
      siswa.kelas_nama.toLowerCase().includes(query)
    );
  });

  const totalSiswaPages = Math.ceil(filteredSiswaList.length / siswaItemsPerPage);
  const paginatedSiswaList = filteredSiswaList.slice(
    (siswaCurrentPage - 1) * siswaItemsPerPage,
    siswaCurrentPage * siswaItemsPerPage
  );

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse" />
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 relative mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-slate-600 font-medium">Memuat Manajemen PKL</p>
            <div className="flex gap-1 justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-2xl backdrop-blur-sm">
                <Building2 className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-3 w-3 sm:h-4 sm:w-4" /> : 
                   <Cloud className="h-3 w-3 sm:h-4 sm:w-4" />}
                  <p className="text-xs sm:text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold leading-tight">Manajemen PKL</h1>
                <p className="text-blue-100 text-xs sm:text-sm">Kelola lokasi PKL dan atur siswa yang sedang PKL</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-3 py-1 sm:px-4 sm:py-2 backdrop-blur-sm text-center">
                <p className="text-[10px] sm:text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-base sm:text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
              <Button variant="ghost" size="icon" className="bg-white/10 hover:bg-white/20 text-white rounded-xl" onClick={handleRefresh}>
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-blue-600 font-medium">Total Lokasi PKL</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-900">{pklList.length}</p>
                </div>
                <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Siswa PKL</p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-900">{siswaList.filter(s => s.id_pkl).length}</p>
                </div>
                <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-purple-600 font-medium">Guru Pendamping</p>
                  <p className="text-lg sm:text-2xl font-bold text-purple-900">{guruList.length}</p>
                </div>
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs text-amber-600 font-medium">Total Kelas</p>
                  <p className="text-lg sm:text-2xl font-bold text-amber-900">{kelasList.length}</p>
                </div>
                <School className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN TABS CARD */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/10 p-1.5 sm:p-2 rounded-xl"><Briefcase className="h-5 w-5 sm:h-6 sm:w-6" /></div>
              <div>
                <CardTitle className="text-base sm:text-xl">Manajemen PKL</CardTitle>
                <CardDescription className="text-slate-300 text-xs sm:text-sm">Kelola lokasi PKL dan atur siswa yang sedang PKL</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "lokasi" | "siswa")} className="space-y-4 sm:space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="lokasi" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-3 sm:px-4 py-1 text-xs sm:text-sm">
                    <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Lokasi PKL
                  </TabsTrigger>
                  <TabsTrigger value="siswa" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-3 sm:px-4 py-1 text-xs sm:text-sm">
                    <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Atur Siswa PKL
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB LOKASI PKL */}
              <TabsContent value="lokasi" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
                    {canWrite && (
                      <>
                        <Button onClick={openAddPKL} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                          <Plus className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Tambah Lokasi
                        </Button>
                        <Button variant="outline" onClick={() => { setImportType("lokasi"); setImportDialogOpen(true); }} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm">
                          <Upload className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5" /> Import Excel
                        </Button>
                      </>
                    )}
                    {!canWrite && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs"><Eye className="h-4 w-4" /> Mode Baca Saja</div>
                    )}
                  </div>
                  <div className="flex gap-2 justify-center sm:justify-end">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                      <Input placeholder="Cari lokasi PKL..." value={searchLokasi} onChange={(e) => setSearchLokasi(e.target.value)} className="pl-8 pr-8 rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-64" />
                      {searchLokasi && <button onClick={() => setSearchLokasi("")} className="absolute right-3 top-1/2"><X className="h-3.5 w-3.5 text-slate-400" /></button>}
                    </div>
                    <Button variant="outline" onClick={fetchPKL} disabled={isFetchingPKL} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm">
                      <RefreshCw className={`mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFetchingPKL ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs sm:text-sm font-semibold">Tempat PKL</TableHead>
                          <TableHead className="text-xs sm:text-sm font-semibold">Koordinat</TableHead>
                          <TableHead className="text-xs sm:text-sm font-semibold">Guru Pendamping</TableHead>
                          <TableHead className="text-xs sm:text-sm font-semibold">Status</TableHead>
                          {canWrite && <TableHead className="text-center text-xs sm:text-sm font-semibold">Aksi</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPklList.map((pkl) => (
                          <TableRow key={pkl.id_pkl} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-medium text-xs sm:text-sm">{pkl.tempat_pkl}</TableCell>
                            <TableCell><code className="text-[10px] sm:text-xs bg-slate-100 px-2 py-1 rounded-lg">{pkl.koordinat_pkl || "-"}</code></TableCell>
                            <TableCell><div className="flex items-center gap-2"><div className="bg-purple-100 p-1.5 rounded-lg"><User className="h-3 w-3 text-purple-600" /></div><span className="text-xs sm:text-sm">{pkl.guru_nama}</span></div></TableCell>
                            <TableCell>{pkl.aktif ? <Badge className="bg-green-100 text-green-700 rounded-full gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Aktif</Badge> : <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 rounded-full gap-1 text-xs"><PowerOff className="h-3 w-3" /> Nonaktif</Badge>}</TableCell>
                            {canWrite && <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditPKL(pkl)} className="h-7 w-7 p-0 rounded-lg"><Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" /></Button><Button variant="ghost" size="sm" onClick={() => confirmToggleActive(pkl)} className="h-7 w-7 p-0 rounded-lg">{pkl.aktif ? <PowerOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" /> : <Power className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />}</Button></div></TableCell>}
                          </TableRow>
                        ))}
                        {paginatedPklList.length === 0 && <TableRow><TableCell colSpan={canWrite ? 5 : 4} className="text-center py-8 text-slate-500">{searchLokasi ? "Tidak ada lokasi PKL yang cocok" : "Belum ada lokasi PKL"}</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {totalPklPages > 1 && <div className="flex justify-center items-center gap-2 pt-2 flex-wrap">...</div>}
              </TabsContent>

              {/* TAB ATUR SISWA PKL */}
              <TabsContent value="siswa" className="space-y-4 sm:space-y-6">
                <div className="flex flex-wrap items-end gap-3 justify-center sm:justify-start">
                  <div className="flex flex-col w-full sm:w-auto">
                    <Label className="text-slate-700 text-xs sm:text-sm font-medium mb-1">Filter Kelas</Label>
                    <Popover open={popoverKelasOpen} onOpenChange={setPopoverKelasOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-64 justify-between rounded-xl border-slate-200 h-8 sm:h-9 text-xs sm:text-sm font-normal">
                          {selectedKelas ? kelasList.find(k => k.id_kelas.toString() === selectedKelas)?.nama || "Pilih Kelas" : "Semua Kelas"}
                          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start" sideOffset={5}>
                        <div className="p-2 border-b bg-slate-50">
                          <div className="flex gap-1 mb-2 flex-wrap">{["all","X","XI","XII"].map(jenjang=><Button key={jenjang} variant={kelasJenjangFilter===jenjang?"default":"ghost"} size="sm" className={`h-7 px-2 text-xs rounded-md`} onClick={()=>setKelasJenjangFilter(jenjang)}>{jenjang==="all"?"Semua":jenjang}</Button>)}</div>
                          <div className="relative"><Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400"/><Input placeholder="Cari kelas..." value={kelasSearchQuery} onChange={(e)=>setKelasSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e)=>e.stopPropagation()}/>{kelasSearchQuery&&<button onClick={()=>setKelasSearchQuery("")} className="absolute right-2 top-1/2"><X className="h-3.5 w-3.5 text-slate-400"/></button>}</div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredKelasOptions.length===0?<div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada kelas yang cocok</div>:filteredKelasOptions.map(kelas=><button key={kelas.id_kelas} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${selectedKelas===kelas.id_kelas.toString()?"bg-blue-50 text-blue-700 font-medium":"text-slate-700"}`} onClick={()=>{setSelectedKelas(kelas.id_kelas.toString());setPopoverKelasOpen(false);setKelasSearchQuery("");setKelasJenjangFilter("all");}}>{kelas.nama}</button>)}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {canWrite && <Button variant="outline" onClick={()=>{setImportType("assignment");setImportDialogOpen(true);}} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm"><Upload className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5"/> Import Assignment</Button>}
                  <div className="relative flex-1 min-w-[200px] w-full sm:w-auto"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400"/><Input placeholder="Cari siswa (NIS/Nama)..." value={searchSiswa} onChange={(e)=>setSearchSiswa(e.target.value)} className="pl-8 pr-8 rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full"/>{searchSiswa&&<button onClick={()=>setSearchSiswa("")} className="absolute right-3 top-1/2"><X className="h-3.5 w-3.5 text-slate-400"/></button>}</div>
                  <Button variant="outline" onClick={fetchSiswa} disabled={isFetchingSiswa} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm"><RefreshCw className={`mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 ${isFetchingSiswa?"animate-spin":""}`}/> Refresh</Button>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50"><TableHead className="text-xs sm:text-sm font-semibold">NIS</TableHead><TableHead className="text-xs sm:text-sm font-semibold">Nama Siswa</TableHead><TableHead className="text-xs sm:text-sm font-semibold">Kelas</TableHead><TableHead className="text-center text-xs sm:text-sm font-semibold">Status</TableHead><TableHead className="text-xs sm:text-sm font-semibold">Lokasi PKL</TableHead><TableHead className="text-xs sm:text-sm font-semibold w-72">Atur Status</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {isFetchingSiswa?<TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500"/></TableCell></TableRow>:paginatedSiswaList.length===0?<TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500 text-xs sm:text-sm">{searchSiswa?"Tidak ada siswa yang cocok":"Tidak ada data siswa"}</TableCell></TableRow>:paginatedSiswaList.map(siswa=>(
                          <TableRow key={siswa.id_siswa} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-mono text-xs sm:text-sm">{siswa.nis}</TableCell>
                            <TableCell className="font-medium text-xs sm:text-sm">{siswa.nama}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{siswa.kelas_nama}</TableCell>
                            <TableCell className="text-center">{siswa.id_pkl?<Badge className="bg-blue-100 text-blue-700 rounded-full text-xs"><Briefcase className="h-3 w-3 mr-1"/> PKL</Badge>:<Badge className="bg-green-100 text-green-700 rounded-full text-xs"><Home className="h-3 w-3 mr-1"/> Sekolah</Badge>}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{siswa.tempat_pkl||"-"}</TableCell>
                            <TableCell>{canWrite?<div className="flex items-center gap-2"><Popover open={pklSearchPopoverOpen===siswa.id_siswa} onOpenChange={(open)=>{setPklSearchPopoverOpen(open?siswa.id_siswa:null);setPklSearchQuery("");}}><PopoverTrigger asChild><Button variant="outline" className="w-[200px] sm:w-[240px] justify-between rounded-xl h-8 sm:h-9 text-xs sm:text-sm font-normal" disabled={updatingSiswa===siswa.id_siswa}>{siswa.id_pkl?`🏭 ${siswa.tempat_pkl}`:"🏫 Sekolah"}<ChevronDown className="h-3.5 w-3.5 opacity-50"/></Button></PopoverTrigger><PopoverContent className="w-[280px] sm:w-[300px] p-0" align="start" sideOffset={5}><div className="p-2 border-b bg-slate-50"><div className="relative"><Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400"/><Input placeholder="Cari lokasi PKL..." value={pklSearchQuery} onChange={(e)=>setPklSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e)=>e.stopPropagation()}/>{pklSearchQuery&&<button onClick={()=>setPklSearchQuery("")} className="absolute right-2 top-1/2"><X className="h-3.5 w-3.5 text-slate-400"/></button>}</div></div><div className="max-h-60 overflow-y-auto"><button className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 ${!siswa.id_pkl?"bg-blue-50 text-blue-700 font-medium":"text-slate-700"}`} onClick={()=>{updateSiswaPKL(siswa.id_siswa,null);setPklSearchPopoverOpen(null);setPklSearchQuery("");}}><Home className="h-4 w-4"/> Sekolah (tidak PKL)</button>{pklList.filter(p=>p.aktif&&p.tempat_pkl.toLowerCase().includes(pklSearchQuery.toLowerCase())).length===0&&pklSearchQuery?<div className="px-3 py-4 text-center text-sm text-slate-500">Tidak ada lokasi PKL yang cocok</div>:pklList.filter(p=>p.aktif&&p.tempat_pkl.toLowerCase().includes(pklSearchQuery.toLowerCase())).map(pkl=><button key={pkl.id_pkl} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2 ${siswa.id_pkl===pkl.id_pkl?"bg-blue-50 text-blue-700 font-medium":"text-slate-700"}`} onClick={()=>{updateSiswaPKL(siswa.id_siswa,pkl.id_pkl);setPklSearchPopoverOpen(null);setPklSearchQuery("");}}><Briefcase className="h-4 w-4"/> {pkl.tempat_pkl}</button>)}</div></PopoverContent></Popover>{updatingSiswa===siswa.id_siswa&&<Loader2 className="h-4 w-4 animate-spin text-blue-500"/>}</div>:<div className="text-xs text-slate-500 italic">Mode baca saja</div>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {totalSiswaPages > 1 && <div className="flex justify-center items-center gap-2 pt-2 flex-wrap">...</div>}
                <Alert className="rounded-xl bg-blue-50 border-blue-200 max-w-3xl mx-auto"><MapPin className="h-4 w-4 text-blue-600"/><AlertDescription className="text-blue-700 text-xs sm:text-sm"><strong className="text-blue-800">Informasi Penting:</strong><ul className="list-disc list-inside mt-2 space-y-1 text-xs sm:text-sm"><li>Siswa dengan status <strong>Sekolah</strong> akan melakukan presensi harian dan presensi mapel di lokasi sekolah.</li><li>Siswa dengan status <strong>PKL</strong> hanya dapat melakukan presensi harian di lokasi PKL yang ditentukan.</li><li>Setiap lokasi PKL memiliki <strong>guru pendamping</strong> yang bertanggung jawab.</li></ul></AlertDescription></Alert>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 max-w-3xl mx-auto">
          <CardContent className="p-4 sm:p-5"><div className="flex items-start gap-3 sm:gap-4"><div className="bg-indigo-100 p-2 sm:p-3 rounded-xl flex-shrink-0"><Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600"/></div><div><h3 className="font-semibold text-slate-800 text-sm sm:text-base mb-1">Tips Mengelola PKL</h3><p className="text-xs sm:text-sm text-slate-600">Gunakan fitur import Excel untuk menambahkan banyak lokasi PKL atau assignment siswa sekaligus. Pastikan data guru pendamping sudah terdaftar sebelum melakukan import lokasi PKL.</p></div></div></CardContent>
        </Card>

        <div className="text-center pt-4"><Separator className="mb-4"/><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen PKL - SmartAS</p><p className="text-[10px] text-slate-300 mt-1">Sistem Informasi Akademik</p></div>
      </div>

      {/* Dialog Import */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl rounded-2xl p-4 sm:p-6">
          <DialogHeader><DialogTitle className="text-base sm:text-xl flex items-center gap-2"><Upload className="h-5 w-5 text-blue-600"/> {importType==="lokasi"?"Import Lokasi PKL":"Import Assignment Siswa PKL"}</DialogTitle><DialogDescription className="text-xs sm:text-sm">Upload file Excel (.xlsx, .xls, .csv) dengan format yang sesuai.{importType==="lokasi"?" Kolom: tempat_pkl (wajib), koordinat_pkl (opsional), guru_nik (NIK guru pendamping, opsional).":" Kolom: nis (wajib), tempat_pkl (wajib, nama tempat PKL harus sudah ada dan aktif di database)."}</DialogDescription></DialogHeader>
          <div className="space-y-4"><div className="flex gap-4 flex-wrap"><Button variant="outline" onClick={()=>downloadTemplate(importType)} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm"><Download className="mr-1.5 h-3.5 w-3.5"/> Download Template</Button><div className="relative"><input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={isImporting} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/><Button disabled={isImporting} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm"><Upload className="mr-1.5 h-3.5 w-3.5"/> {isImporting?"Memproses...":"Pilih File"}</Button></div></div>{importError&&<Alert variant="destructive" className="rounded-xl"><AlertCircle className="h-4 w-4"/><AlertDescription className="text-xs sm:text-sm">{importError}</AlertDescription></Alert>}{importPreview.length>0&&<><Alert className="rounded-xl bg-emerald-50 border-emerald-200 max-w-md mx-auto"><CheckCircle className="h-4 w-4 text-emerald-600"/><AlertDescription className="text-emerald-700 text-xs sm:text-sm">{importPreview.length} data siap diimport</AlertDescription></Alert><div className="border rounded-xl overflow-auto max-h-64"><Table><TableHeader><TableRow className="bg-slate-50">{Object.keys(importPreview[0]||{}).map(key=><TableHead key={key} className="font-semibold text-xs sm:text-sm">{key}</TableHead>)}</TableRow></TableHeader><TableBody>{importPreview.slice(0,5).map((row,idx)=><TableRow key={idx}>{Object.values(row).map((val:any,i)=><TableCell key={i} className="text-xs sm:text-sm">{val}</TableCell>)}</TableRow>)}{importPreview.length>5&&<TableRow><TableCell colSpan={Object.keys(importPreview[0]).length} className="text-center text-slate-500 text-xs sm:text-sm">... dan {importPreview.length-5} data lainnya</TableCell></TableRow>}</TableBody></Table></div><div className="flex justify-center"><Button onClick={handleImport} disabled={isImporting} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600">{isImporting&&<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/>} Import Data</Button></div></>}</div>
        </DialogContent>
      </Dialog>

      {/* Dialog Lokasi PKL */}
      <Dialog open={pklDialogOpen} onOpenChange={setPklDialogOpen}>
        <DialogContent className="rounded-2xl max-w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader><DialogTitle className="text-base sm:text-xl flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600"/> {editingPKL?"Edit Lokasi PKL":"Tambah Lokasi PKL"}</DialogTitle></DialogHeader>
          <div className="space-y-4"><div><Label className="text-xs sm:text-sm">Tempat / Nama Perusahaan</Label><Input value={pklForm.tempat_pkl} onChange={(e)=>setPklForm({...pklForm,tempat_pkl:e.target.value})} className="rounded-xl mt-1 h-8 sm:h-9 text-xs sm:text-sm" placeholder="Contoh: PT. Maju Jaya"/></div><div><Label className="text-xs sm:text-sm">Koordinat (Opsional)</Label><Input value={pklForm.koordinat_pkl} onChange={(e)=>setPklForm({...pklForm,koordinat_pkl:e.target.value})} placeholder="-6.200000,106.816666" className="rounded-xl mt-1 h-8 sm:h-9 text-xs sm:text-sm"/><p className="text-[10px] sm:text-xs text-slate-400 mt-1">Format: latitude,longitude</p></div><div><Label className="text-xs sm:text-sm">Guru Pendamping (NIK)</Label><Select value={pklForm.id_guru||"0"} onValueChange={(v)=>setPklForm({...pklForm,id_guru:v})}><SelectTrigger className="rounded-xl mt-1 h-8 sm:h-9 text-xs sm:text-sm"><SelectValue placeholder="Pilih guru pendamping"/></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="0">- Tidak ada -</SelectItem>{guruList.map(guru=><SelectItem key={guru.id_guru} value={guru.id_guru.toString()}>{guru.nik} - {guru.nama}</SelectItem>)}</SelectContent></Select></div></div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4"><Button variant="outline" onClick={()=>setPklDialogOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm">Batal</Button><Button onClick={handleSavePKL} disabled={isSavingPKL} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 w-full sm:w-auto text-xs sm:text-sm">{isSavingPKL&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Toggle Aktif */}
      <Dialog open={toggleActiveDialogOpen} onOpenChange={setToggleActiveDialogOpen}>
        <DialogContent className="rounded-2xl max-w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader><DialogTitle className="text-base sm:text-xl flex items-center gap-2 text-orange-600">{togglingPKL?.aktif?<PowerOff className="h-5 w-5"/>:<Power className="h-5 w-5"/>}{togglingPKL?.aktif?"Nonaktifkan Lokasi PKL":"Aktifkan Lokasi PKL"}</DialogTitle></DialogHeader>
          <DialogDescription className="text-xs sm:text-sm">{togglingPKL?.aktif?<>Yakin ingin <strong>menonaktifkan</strong> lokasi PKL <strong>{togglingPKL?.tempat_pkl}</strong>?<br/>Lokasi yang nonaktif tidak akan muncul di pilihan assignment siswa.</>:<>Yakin ingin <strong>mengaktifkan</strong> kembali lokasi PKL <strong>{togglingPKL?.tempat_pkl}</strong>?</>}</DialogDescription>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4"><Button variant="outline" onClick={()=>setToggleActiveDialogOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm">Batal</Button><Button variant={togglingPKL?.aktif?"destructive":"default"} onClick={handleToggleActive} disabled={isSavingPKL} className={`w-full sm:w-auto text-xs sm:text-sm ${!togglingPKL?.aktif?"bg-green-600 hover:bg-green-700":""}`}>{isSavingPKL&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{togglingPKL?.aktif?"Nonaktifkan":"Aktifkan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}