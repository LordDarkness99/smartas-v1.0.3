import { useState, useEffect, useCallback } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Edit,
  Trash2,
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
  Info,
  FileText,
  XCircle,
  CheckCheck
} from "lucide-react";

// Tipe data
interface Guru {
  id_guru: number;
  nama: string;
  nip: string;
}

interface PKL {
  id_pkl: number;
  tempat_pkl: string;
  koordinat_pkl: string;
  id_guru: number | null;
  guru_nama?: string;
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
}

export default function PklManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"lokasi" | "siswa">("lokasi");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);

  // State untuk lokasi PKL
  const [pklList, setPklList] = useState<PKL[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [isFetchingPKL, setIsFetchingPKL] = useState(false);
  const [pklDialogOpen, setPklDialogOpen] = useState(false);
  const [editingPKL, setEditingPKL] = useState<PKL | null>(null);
  const [pklForm, setPklForm] = useState({ tempat_pkl: "", koordinat_pkl: "", id_guru: "" });
  const [isSavingPKL, setIsSavingPKL] = useState(false);
  const [deletePKLDialogOpen, setDeletePKLDialogOpen] = useState(false);
  const [deletingPKL, setDeletingPKL] = useState<PKL | null>(null);

  // State untuk siswa PKL
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [isFetchingSiswa, setIsFetchingSiswa] = useState(false);
  const [updatingSiswa, setUpdatingSiswa] = useState<number | null>(null);

  // State untuk import
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<"lokasi" | "assignment">("lokasi");
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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
        .select("id_guru, nama, nip")
        .eq("aktif", true)
        .order("nama");
      if (error) throw error;
      const formatted: Guru[] = data.map((g: any) => ({
        ...g,
        nip: g.nip?.toString() || "",
      }));
      setGuruList(formatted);
    } catch (error: any) {
      console.error("Fetch guru error:", error);
    }
  };

  // ========== FETCH LOKASI PKL ==========
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
          guru:guru (nama)
        `)
        .order("id_pkl");
      if (error) throw error;
      const formatted: PKL[] = data.map((item: any) => ({
        id_pkl: item.id_pkl,
        tempat_pkl: item.tempat_pkl,
        koordinat_pkl: item.koordinat_pkl,
        id_guru: item.id_guru,
        guru_nama: item.guru?.nama || "-",
      }));
      setPklList(formatted);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingPKL(false);
    }
  };

  // ========== CRUD LOKASI PKL ==========
  const openAddPKL = () => {
    setEditingPKL(null);
    setPklForm({ tempat_pkl: "", koordinat_pkl: "", id_guru: "" });
    setPklDialogOpen(true);
  };

  const openEditPKL = (pkl: PKL) => {
    setEditingPKL(pkl);
    setPklForm({
      tempat_pkl: pkl.tempat_pkl,
      koordinat_pkl: pkl.koordinat_pkl || "",
      id_guru: pkl.id_guru?.toString() || "",
    });
    setPklDialogOpen(true);
  };

  const handleSavePKL = async () => {
    if (!pklForm.tempat_pkl.trim()) {
      toast({ title: "Error", description: "Nama tempat PKL harus diisi", variant: "destructive" });
      return;
    }
    setIsSavingPKL(true);
    try {
      const data = {
        tempat_pkl: pklForm.tempat_pkl.trim(),
        koordinat_pkl: pklForm.koordinat_pkl.trim() || null,
        id_guru: pklForm.id_guru ? parseInt(pklForm.id_guru) : null,
      };
      if (editingPKL) {
        const { error } = await supabase.from("pkl").update(data).eq("id_pkl", editingPKL.id_pkl);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Lokasi PKL berhasil diupdate" });
      } else {
        const { error } = await supabase.from("pkl").insert(data);
        if (error) throw error;
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

  const confirmDeletePKL = (pkl: PKL) => {
    setDeletingPKL(pkl);
    setDeletePKLDialogOpen(true);
  };

  const handleDeletePKL = async () => {
    if (!deletingPKL) return;
    setIsSavingPKL(true);
    try {
      const { data: siswaCount, error: countError } = await supabase
        .from("siswa")
        .select("id_siswa", { count: "exact", head: true })
        .eq("id_pkl", deletingPKL.id_pkl);
      if (countError) throw countError;
      if (siswaCount && siswaCount.length > 0) {
        toast({
          title: "Tidak bisa menghapus",
          description: `Masih ada ${siswaCount.length} siswa yang terdaftar di lokasi PKL ini.`,
          variant: "destructive",
        });
        setDeletePKLDialogOpen(false);
        return;
      }
      const { error } = await supabase.from("pkl").delete().eq("id_pkl", deletingPKL.id_pkl);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Lokasi PKL dihapus" });
      setDeletePKLDialogOpen(false);
      fetchPKL();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingPKL(false);
    }
  };

  // ========== FETCH KELAS & SISWA ==========
  const fetchKelas = async () => {
    try {
      const { data, error } = await supabase
        .from("kelas")
        .select("id_kelas, nama")
        .eq("aktif", true)
        .order("nama");
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
          kelas:kelas (nama),
          pkl:pkl (tempat_pkl)
        `
        )
        .eq("aktif", true);
      if (selectedKelas && selectedKelas !== "all") {
        query = query.eq("id_kelas", parseInt(selectedKelas));
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
    setUpdatingSiswa(siswaId);
    try {
      const { error } = await supabase.from("siswa").update({ id_pkl }).eq("id_siswa", siswaId);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Status PKL siswa diperbarui" });
      fetchSiswa();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingSiswa(null);
    }
  };

  // ========== FUNGSI IMPORT EXCEL ==========
  const downloadTemplate = (type: "lokasi" | "assignment") => {
    let headers: string[];
    let data: any[][];
    if (type === "lokasi") {
      headers = ["tempat_pkl", "koordinat_pkl", "guru_pendamping"];
      data = [
        ["PT. Maju Jaya", "-6.200000,106.816666", "Ahmad Santoso"],
        ["CV. Karya Mandiri", "-6.208333,106.845555", "Siti Aminah"],
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
    [importType, toast]
  );

  const handleImport = async () => {
    if (importPreview.length === 0) {
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
        const guruNames = [...new Set(importPreview.map((row: any) => row.guru_pendamping).filter(Boolean))];
        let guruMap = new Map<string, number>();
        if (guruNames.length) {
          const { data: guruData, error: guruError } = await supabase
            .from("guru")
            .select("id_guru, nama")
            .in("nama", guruNames);
          if (guruError) throw guruError;
          guruData?.forEach((g) => guruMap.set(g.nama, g.id_guru));
          const missingGuru = guruNames.filter((name) => !guruMap.has(name));
          if (missingGuru.length) {
            throw new Error(`Guru pendamping tidak ditemukan: ${missingGuru.join(", ")}`);
          }
        }
        const dataToInsert = importPreview.map((row: any) => ({
          tempat_pkl: row.tempat_pkl,
          koordinat_pkl: row.koordinat_pkl || null,
          id_guru: row.guru_pendamping ? guruMap.get(row.guru_pendamping) : null,
        }));
        const { error } = await supabase.from("pkl").insert(dataToInsert);
        if (error) throw error;
        toast({ title: "Berhasil", description: `${dataToInsert.length} lokasi PKL diimport` });
        fetchPKL();
      } else {
        const tempatNames = [...new Set(importPreview.map((row: any) => row.tempat_pkl))];
        const { data: pklData, error: pklError } = await supabase
          .from("pkl")
          .select("id_pkl, tempat_pkl")
          .in("tempat_pkl", tempatNames);
        if (pklError) throw pklError;
        const tempatToId = new Map();
        pklData?.forEach((p) => tempatToId.set(p.tempat_pkl, p.id_pkl));
        const missingTempat = tempatNames.filter((t) => !tempatToId.has(t));
        if (missingTempat.length) {
          throw new Error(`Tempat PKL tidak ditemukan: ${missingTempat.join(", ")}. Silakan import lokasi PKL terlebih dahulu.`);
        }
        const nisList = importPreview.map((row: any) => row.nis.toString());
        const { data: siswaData, error: siswaError } = await supabase
          .from("siswa")
          .select("id_siswa, nis")
          .in("nis", nisList);
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
          const { error } = await supabase
            .from("siswa")
            .update({ id_pkl: update.id_pkl })
            .eq("id_siswa", update.id_siswa);
          if (error) throw error;
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
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Manajemen PKL</h1>
                <p className="text-blue-100 text-sm">
                  Kelola lokasi PKL dan atur siswa yang sedang PKL
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
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Lokasi PKL</p>
                  <p className="text-2xl font-bold text-blue-900">{pklList.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Siswa PKL</p>
                  <p className="text-2xl font-bold text-emerald-900">{siswaList.filter(s => s.id_pkl).length}</p>
                </div>
                <Briefcase className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Guru Pendamping</p>
                  <p className="text-2xl font-bold text-purple-900">{guruList.length}</p>
                </div>
                <User className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Total Kelas</p>
                  <p className="text-2xl font-bold text-amber-900">{kelasList.length}</p>
                </div>
                <School className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN TABS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Manajemen PKL</CardTitle>
                <CardDescription className="text-slate-300 text-sm">
                  Kelola lokasi PKL dan atur siswa yang sedang PKL
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "lokasi" | "siswa")} className="space-y-6">
              {/* TABS LIST - DIPERKECIL DAN DITENGAH */}
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="lokasi" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <Building2 className="h-3.5 w-3.5" />
                    Lokasi PKL
                  </TabsTrigger>
                  <TabsTrigger value="siswa" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <Users className="h-3.5 w-3.5" />
                    Atur Siswa PKL
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB LOKASI PKL */}
              <TabsContent value="lokasi" className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="flex gap-2">
                    <Button onClick={openAddPKL} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Lokasi
                    </Button>
                    <Button variant="outline" onClick={() => { setImportType("lokasi"); setImportDialogOpen(true); }} className="rounded-xl h-9 text-sm">
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Import Excel
                    </Button>
                  </div>
                  <Button variant="outline" onClick={fetchPKL} disabled={isFetchingPKL} className="rounded-xl h-9 text-sm">
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingPKL ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold text-center w-16">ID</TableHead>
                          <TableHead className="font-semibold">Tempat PKL</TableHead>
                          <TableHead className="font-semibold">Koordinat</TableHead>
                          <TableHead className="font-semibold">Guru Pendamping</TableHead>
                          <TableHead className="font-semibold text-center w-24">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pklList.map((pkl) => (
                          <TableRow key={pkl.id_pkl} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="text-center font-mono text-sm">{pkl.id_pkl}</TableCell>
                            <TableCell className="font-medium">{pkl.tempat_pkl}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-slate-100 px-2 py-1 rounded-lg">{pkl.koordinat_pkl || "-"}</code>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="bg-purple-100 p-1.5 rounded-lg">
                                  <User className="h-3 w-3 text-purple-600" />
                                </div>
                                {pkl.guru_nama}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-1 justify-center">
                                <Button variant="ghost" size="sm" onClick={() => openEditPKL(pkl)} className="h-8 w-8 p-0 rounded-lg">
                                  <Edit className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => confirmDeletePKL(pkl)} className="h-8 w-8 p-0 rounded-lg">
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {pklList.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                              <Building2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                              Belum ada lokasi PKL
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* TAB ATUR SISWA PKL */}
              <TabsContent value="siswa" className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="flex gap-3">
                    <div className="w-64">
                      <Select value={selectedKelas === "" ? "all" : selectedKelas} onValueChange={(v) => setSelectedKelas(v === "all" ? "" : v)}>
                        <SelectTrigger className="rounded-xl border-slate-200 h-9 text-sm">
                          <SelectValue placeholder="Filter Kelas" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all">Semua Kelas</SelectItem>
                          {kelasList.map((kelas) => (
                            <SelectItem key={kelas.id_kelas} value={kelas.id_kelas.toString()}>{kelas.nama}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={() => { setImportType("assignment"); setImportDialogOpen(true); }} className="rounded-xl h-9 text-sm">
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Import Assignment
                    </Button>
                  </div>
                  <Button variant="outline" onClick={fetchSiswa} disabled={isFetchingSiswa} className="rounded-xl h-9 text-sm">
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingSiswa ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">NIS</TableHead>
                          <TableHead className="font-semibold">Nama Siswa</TableHead>
                          <TableHead className="font-semibold">Kelas</TableHead>
                          <TableHead className="font-semibold text-center">Status</TableHead>
                          <TableHead className="font-semibold">Lokasi PKL</TableHead>
                          <TableHead className="font-semibold w-72">Atur Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isFetchingSiswa ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                            </TableCell>
                          </TableRow>
                        ) : siswaList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                              <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                              Tidak ada data siswa
                            </TableCell>
                          </TableRow>
                        ) : (
                          siswaList.map((siswa) => (
                            <TableRow key={siswa.id_siswa} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-mono text-sm">{siswa.nis}</TableCell>
                              <TableCell className="font-medium">{siswa.nama}</TableCell>
                              <TableCell>{siswa.kelas_nama}</TableCell>
                              <TableCell className="text-center">
                                {siswa.id_pkl ? (
                                  <Badge className="bg-blue-100 text-blue-700 rounded-full">
                                    <Briefcase className="h-3 w-3 mr-1" /> PKL
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-700 rounded-full">
                                    <Home className="h-3 w-3 mr-1" /> Sekolah
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{siswa.tempat_pkl || "-"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={siswa.id_pkl ? siswa.id_pkl.toString() : "none"}
                                    onValueChange={(value) => {
                                      const pklId = value === "none" ? null : parseInt(value);
                                      updateSiswaPKL(siswa.id_siswa, pklId);
                                    }}
                                    disabled={updatingSiswa === siswa.id_siswa}
                                  >
                                    <SelectTrigger className="w-[240px] rounded-xl h-9 text-sm">
                                      <SelectValue placeholder="Pilih status" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      <SelectItem value="none">🏫 Sekolah (tidak PKL)</SelectItem>
                                      {pklList.map((pkl) => (
                                        <SelectItem key={pkl.id_pkl} value={pkl.id_pkl.toString()}>
                                          🏭 PKL - {pkl.tempat_pkl}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {updatingSiswa === siswa.id_siswa && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* INFO ALERT */}
                <Alert className="rounded-xl bg-blue-50 border-blue-200 max-w-3xl mx-auto">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    <strong className="text-blue-800">Informasi Penting:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Siswa dengan status <strong>Sekolah</strong> akan melakukan presensi harian dan presensi mapel di lokasi sekolah.</li>
                      <li>Siswa dengan status <strong>PKL</strong> hanya dapat melakukan presensi harian di lokasi PKL yang ditentukan.</li>
                      <li>Setiap lokasi PKL memiliki <strong>guru pendamping</strong> yang bertanggung jawab.</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 max-w-3xl mx-auto">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl flex-shrink-0">
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Tips Mengelola PKL</h3>
                <p className="text-sm text-slate-600">
                  Gunakan fitur import Excel untuk menambahkan banyak lokasi PKL atau assignment siswa sekaligus.
                  Pastikan data guru pendamping sudah terdaftar sebelum melakukan import lokasi PKL.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Manajemen PKL - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Sistem Informasi Akademik
          </p>
        </div>
      </div>

      {/* Dialog Import Excel */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              {importType === "lokasi" ? "Import Lokasi PKL" : "Import Assignment Siswa PKL"}
            </DialogTitle>
            <DialogDescription>
              Upload file Excel (.xlsx, .xls, .csv) dengan format yang sesuai.
              {importType === "lokasi"
                ? " Kolom: tempat_pkl (wajib), koordinat_pkl (opsional), guru_pendamping (nama guru, opsional)."
                : " Kolom: nis (wajib), tempat_pkl (wajib, nama tempat PKL harus sudah ada di database)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => downloadTemplate(importType)} className="rounded-xl h-9 text-sm">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download Template
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button disabled={isImporting} className="rounded-xl h-9 text-sm">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {isImporting ? "Memproses..." : "Pilih File"}
                </Button>
              </div>
            </div>
            {importError && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}
            {importPreview.length > 0 && (
              <>
                <Alert className="rounded-xl bg-emerald-50 border-emerald-200 max-w-md mx-auto">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-emerald-700">{importPreview.length} data siap diimport</AlertDescription>
                </Alert>
                <div className="border rounded-xl overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        {Object.keys(importPreview[0] || {}).map((key) => (
                          <TableHead key={key} className="font-semibold">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.values(row).map((val: any, i) => (
                            <TableCell key={i}>{val}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {importPreview.length > 5 && (
                        <TableRow>
                          <TableCell colSpan={Object.keys(importPreview[0]).length} className="text-center text-slate-500">
                            ... dan {importPreview.length - 5} data lainnya
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-center">
                  <Button onClick={handleImport} disabled={isImporting} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                    {isImporting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Import Data
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Lokasi PKL (Add/Edit) */}
      <Dialog open={pklDialogOpen} onOpenChange={setPklDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              {editingPKL ? "Edit Lokasi PKL" : "Tambah Lokasi PKL"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tempat_pkl" className="text-slate-700">Tempat / Nama Perusahaan</Label>
              <Input 
                id="tempat_pkl" 
                value={pklForm.tempat_pkl} 
                onChange={(e) => setPklForm({ ...pklForm, tempat_pkl: e.target.value })}
                className="rounded-xl mt-1"
                placeholder="Contoh: PT. Maju Jaya"
              />
            </div>
            <div>
              <Label htmlFor="koordinat" className="text-slate-700">Koordinat (Opsional)</Label>
              <Input 
                id="koordinat" 
                value={pklForm.koordinat_pkl} 
                onChange={(e) => setPklForm({ ...pklForm, koordinat_pkl: e.target.value })} 
                placeholder="-6.200000,106.816666"
                className="rounded-xl mt-1"
              />
              <p className="text-xs text-slate-400 mt-1">Format: latitude,longitude</p>
            </div>
            <div>
              <Label htmlFor="guru" className="text-slate-700">Guru Pendamping</Label>
              <Select value={pklForm.id_guru} onValueChange={(v) => setPklForm({ ...pklForm, id_guru: v })}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue placeholder="Pilih guru pendamping" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">- Tidak ada -</SelectItem>
                  {guruList.map((guru) => (
                    <SelectItem key={guru.id_guru} value={guru.id_guru.toString()}>
                      {guru.nama} (NIP: {guru.nip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPklDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleSavePKL} disabled={isSavingPKL} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
              {isSavingPKL && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Lokasi PKL */}
      <Dialog open={deletePKLDialogOpen} onOpenChange={setDeletePKLDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Hapus Lokasi PKL
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Yakin ingin menghapus lokasi PKL <strong className="text-slate-800">{deletingPKL?.tempat_pkl}</strong>?
            <p className="text-sm text-red-500 mt-2">⚠️ Tindakan ini tidak dapat dibatalkan.</p>
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePKLDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button variant="destructive" onClick={handleDeletePKL} disabled={isSavingPKL} className="rounded-xl">
              {isSavingPKL && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}