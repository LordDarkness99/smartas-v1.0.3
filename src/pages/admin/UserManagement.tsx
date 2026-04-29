// src/pages/admin/UserManagement.tsx
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import * as bcrypt from 'bcryptjs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  Edit,
  RefreshCw,
  Plus,
  Sun,
  Moon,
  Cloud,
  Users,
  School,
  User,
  UserCheck,
  Sparkles,
  Shield,
  GraduationCap,
  Search,
  X,
  Filter,
  UserMinus,
  UserPlus,
  Trash2,
} from "lucide-react";

// ==================== TYPES ====================
interface GuruImportData {
  nama: string;
  nip: string;
  email: string;
  gender: string;
  password?: string;
}

interface SiswaImportData {
  nama: string;
  nis: string;
  email: string;
  gender: string;
  kelas: string;
  password?: string;
}

interface GuruData {
  id_guru: number;
  nama: string;
  nip: string;
  email: string;
  gender: string;
  aktif: boolean;
}

interface SiswaData {
  id_siswa: number;
  nama: string;
  nis: string;
  email: string;
  gender: string;
  aktif: boolean;
  id_kelas: number | null;
  nama_kelas: string | null;
}

interface Kelas {
  id_kelas: number;
  nama: string;
  aktif: boolean;
  dibuat_pada: string;
  id_guru: number | null;
  guru_nama?: string | null;
}

interface GuruSimple {
  id_guru: number;
  nama: string;
  nip: string;
}

// ==================== MAIN COMPONENT ====================
export default function UserManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"import" | "list" | "kelas">("import");
  const [userType, setUserType] = useState<"guru" | "siswa">("guru");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchKelasQuery, setSearchKelasQuery] = useState("");
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [showFilter, setShowFilter] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalData, setTotalData] = useState(0);

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [guruList, setGuruList] = useState<GuruData[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaData[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [isFetchingKelas, setIsFetchingKelas] = useState(false);
  const [guruOptions, setGuruOptions] = useState<GuruSimple[]>([]);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    nama: "",
    email: "",
    gender: "",
    nip: "",
    nis: "",
    kelas_id: "",
    password: "",
    aktif: true,
  });

  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<any>(null);
  const [deactivateConstraints, setDeactivateConstraints] = useState<string[]>([]);
  const [isActivatingMode, setIsActivatingMode] = useState(false);

  // State untuk kelas
  const [kelasDialogOpen, setKelasDialogOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);
  const [kelasForm, setKelasForm] = useState({ nama: "", id_guru: "" });
  const [isSavingKelas, setIsSavingKelas] = useState(false);
  
  // [NEW] State untuk toggle aktif/nonaktif kelas
  const [toggleKelasDialogOpen, setToggleKelasDialogOpen] = useState(false);
  const [togglingKelas, setTogglingKelas] = useState<Kelas | null>(null);
  const [isActivatingKelasMode, setIsActivatingKelasMode] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isProcessingSelected, setIsProcessingSelected] = useState(false);
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"activate" | "deactivate">("deactivate");
  const [bulkActionData, setBulkActionData] = useState<{
    users: { id: number; nama: string; aktif: boolean }[];
    cannotProcess: { id: number; nama: string; reasons: string[] }[];
    canProcessIds: number[];
  } | null>(null);

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

  const resetPagination = () => setCurrentPage(1);

  useEffect(() => {
    if (!selectMode) setSelectedIds([]);
  }, [selectMode]);

  useEffect(() => {
    if (selectMode) setSelectedIds([]);
  }, [currentPage, filterKelas, searchQuery, userType]);

  // ==================== FILTER & SORT CLIENT-SIDE ====================
  const filteredGuruList = [...guruList]
    .filter(guru => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        guru.nama.toLowerCase().includes(q) ||
        guru.nip.toLowerCase().includes(q) ||
        guru.email.toLowerCase().includes(q) ||
        guru.id_guru.toString().includes(q)
      );
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const filteredSiswaList = [...siswaList]
    .filter(siswa => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        siswa.nama.toLowerCase().includes(q) ||
        siswa.nis.toLowerCase().includes(q) ||
        siswa.email.toLowerCase().includes(q) ||
        siswa.id_siswa.toString().includes(q) ||
        (siswa.nama_kelas && siswa.nama_kelas.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  const displayedGuruList = [...filteredGuruList].sort((a, b) => {
    if (a.aktif === b.aktif) return a.nama.localeCompare(b.nama);
    return a.aktif ? -1 : 1;
  });
  const displayedSiswaList = [...filteredSiswaList].sort((a, b) => {
    if (a.aktif === b.aktif) return a.nama.localeCompare(b.nama);
    return a.aktif ? -1 : 1;
  });

  const totalPages = Math.ceil(totalData / itemsPerPage);

  const filteredKelasOptions = kelasList.filter(kelas =>
    kelas.nama.toLowerCase().includes(filterSearchQuery.toLowerCase())
  );

  const filteredKelasList = kelasList.filter(kelas => {
    if (!searchKelasQuery) return true;
    const q = searchKelasQuery.toLowerCase();
    return (
      kelas.nama.toLowerCase().includes(q) ||
      (kelas.guru_nama && kelas.guru_nama.toLowerCase().includes(q)) ||
      kelas.id_kelas.toString().includes(q)
    );
  });

  // ==================== FETCH GURU & KELAS ====================
  const fetchGuruOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("guru")
        .select("id_guru, nama, nip")
        .eq("aktif", true)
        .order("nama", { ascending: true });
      if (error) throw error;
      const formatted = data.map((g: any) => ({ ...g, nip: g.nip?.toString() || "" }));
      setGuruOptions(formatted);
    } catch (error) { console.error(error); }
  };

  const fetchKelas = async () => {
    setIsFetchingKelas(true);
    try {
      const { data, error } = await supabase
        .from("kelas")
        .select(`*, guru:guru (nama)`)
        .order("nama", { ascending: true });
      if (error) throw error;
      const formatted: Kelas[] = data.map((item: any) => ({
        id_kelas: item.id_kelas,
        nama: item.nama,
        aktif: item.aktif,
        dibuat_pada: item.dibuat_pada,
        id_guru: item.id_guru,
        guru_nama: item.guru?.nama || null,
      }));
      setKelasList(formatted);
    } catch (error) {
      toast({ title: "Kesalahan", description: "Gagal mengambil data kelas", variant: "destructive" });
    } finally {
      setIsFetchingKelas(false);
    }
  };

  // ==================== CRUD KELAS (tanpa hapus permanen) ====================
  const handleAddKelas = () => {
    setEditingKelas(null);
    setKelasForm({ nama: "", id_guru: "" });
    setKelasDialogOpen(true);
  };

  const handleEditKelas = (kelas: Kelas) => {
    setEditingKelas(kelas);
    setKelasForm({ nama: kelas.nama, id_guru: kelas.id_guru?.toString() || "" });
    setKelasDialogOpen(true);
  };

  const handleSaveKelas = async () => {
    if (!kelasForm.nama.trim()) {
      toast({ title: "Kesalahan", description: "Nama kelas tidak boleh kosong", variant: "destructive" });
      return;
    }
    setIsSavingKelas(true);
    try {
      const data: any = {
        nama: kelasForm.nama.trim(),
        id_guru: kelasForm.id_guru ? parseInt(kelasForm.id_guru) : null,
      };
      if (editingKelas) {
        const { error } = await supabase
          .from("kelas")
          .update(data)
          .eq("id_kelas", editingKelas.id_kelas);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Kelas berhasil diperbarui" });
      } else {
        const { error } = await supabase
          .from("kelas")
          .insert({
            ...data,
            aktif: true,
            dibuat_pada: new Date().toISOString(),
          });
        if (error) throw error;
        toast({ title: "Berhasil", description: "Kelas baru berhasil ditambahkan" });
      }
      setKelasDialogOpen(false);
      fetchKelas();
    } catch (error: any) {
      console.error("Error simpan kelas:", error);
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
    }
  };

  // [NEW] Fungsi untuk toggle aktif/nonaktif kelas
  const confirmToggleActiveKelas = (kelas: Kelas, isActivating: boolean) => {
    setTogglingKelas(kelas);
    setIsActivatingKelasMode(isActivating);
    setToggleKelasDialogOpen(true);
  };

  const executeToggleActiveKelas = async () => {
    if (!togglingKelas) return;
    setIsSavingKelas(true);
    setToggleKelasDialogOpen(false);
    try {
      const newStatus = !togglingKelas.aktif;
      const { error } = await supabase
        .from("kelas")
        .update({ aktif: newStatus })
        .eq("id_kelas", togglingKelas.id_kelas);
      if (error) throw error;
      toast({
        title: "Berhasil",
        description: `Kelas ${togglingKelas.nama} telah ${newStatus ? "diaktifkan" : "dinonaktifkan"}.`
      });
      fetchKelas();
    } catch (error: any) {
      console.error("Error toggle kelas:", error);
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
      setTogglingKelas(null);
    }
  };

  // ==================== FETCH USERS ====================
  const fetchGuru = async () => {
    setIsFetching(true);
    try {
      const { count: totalCount, error: countError } = await supabase
        .from("guru")
        .select("*", { count: "exact", head: true });
      if (countError) throw countError;
      setTotalData(totalCount || 0);

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: guruData, error: guruError } = await supabase
        .from("guru")
        .select("id_guru, nama, nip, gender, aktif")
        .order("nama", { ascending: true })
        .range(from, to);
      if (guruError) throw guruError;

      const guruIds = guruData?.map(g => g.id_guru) || [];
      const { data: akunData, error: akunError } = await supabase
        .from("akun")
        .select("id_guru, email")
        .in("id_guru", guruIds);
      if (akunError) throw akunError;

      const emailMap = new Map();
      akunData?.forEach(akun => emailMap.set(akun.id_guru, akun.email));

      const combined: GuruData[] = guruData?.map(guru => ({
        ...guru,
        email: emailMap.get(guru.id_guru) || "",
        nip: guru.nip?.toString() || "",
      })) || [];
      setGuruList(combined);
    } catch (error: any) {
      toast({ title: "Kesalahan", description: "Gagal mengambil data guru", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  const fetchSiswa = async () => {
    setIsFetching(true);
    try {
      let countQuery = supabase.from("siswa").select("*", { count: "exact", head: true });
      if (filterKelas !== "all") {
        if (filterKelas === "unassigned") countQuery = countQuery.is("id_kelas", null);
        else countQuery = countQuery.eq("id_kelas", parseInt(filterKelas));
      }
      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalData(totalCount || 0);

      let siswaQuery = supabase
        .from("siswa")
        .select("id_siswa, nama, nis, gender, aktif, id_kelas")
        .order("nama", { ascending: true })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (filterKelas !== "all") {
        if (filterKelas === "unassigned") siswaQuery = siswaQuery.is("id_kelas", null);
        else siswaQuery = siswaQuery.eq("id_kelas", parseInt(filterKelas));
      }
      const { data: siswaData, error: siswaError } = await siswaQuery;
      if (siswaError) throw siswaError;

      const siswaIds = siswaData?.map(s => s.id_siswa) || [];
      const { data: akunData, error: akunError } = await supabase
        .from("akun")
        .select("id_siswa, email")
        .in("id_siswa", siswaIds);
      if (akunError) throw akunError;

      const emailMap = new Map();
      akunData?.forEach(akun => emailMap.set(akun.id_siswa, akun.email));

      const kelasIds = siswaData?.map(s => s.id_kelas).filter(Boolean) || [];
      let kelasMap = new Map();
      if (kelasIds.length > 0) {
        const { data: kelasData, error: kelasError } = await supabase
          .from("kelas")
          .select("id_kelas, nama")
          .in("id_kelas", kelasIds);
        if (!kelasError && kelasData) {
          kelasData.forEach(k => kelasMap.set(k.id_kelas, k.nama));
        }
      }

      const combined: SiswaData[] = siswaData?.map(siswa => ({
        id_siswa: siswa.id_siswa,
        nama: siswa.nama,
        nis: siswa.nis?.toString() || "",
        email: emailMap.get(siswa.id_siswa) || "",
        gender: siswa.gender,
        aktif: siswa.aktif,
        id_kelas: siswa.id_kelas,
        nama_kelas: siswa.id_kelas ? kelasMap.get(siswa.id_kelas) || null : null,
      })) || [];
      setSiswaList(combined);
    } catch (error: any) {
      toast({ title: "Kesalahan", description: "Gagal mengambil data siswa", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchGuruOptions();
    fetchKelas();
  }, []);

  useEffect(() => {
    if (activeTab === "list") {
      if (userType === "guru") fetchGuru();
      else fetchSiswa();
    }
  }, [activeTab, userType, currentPage, itemsPerPage, filterKelas]);

  useEffect(() => {
    resetPagination();
  }, [searchQuery, filterKelas, userType, itemsPerPage]);

  const resetFilters = () => {
    setSearchQuery("");
    setFilterKelas("all");
    setFilterSearchQuery("");
    resetPagination();
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const goToLastPage = () => setCurrentPage(totalPages);
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // ==================== IMPORT FUNCTIONS ====================
  const downloadTemplate = (type: "guru" | "siswa") => {
    let headers: string[];
    let data: any[][];
    if (type === "guru") {
      headers = ["nama", "nip", "email", "gender", "password"];
      data = [
        ["Ahmad Santoso", "198512342021011001", "ahmad.santoso@school.com", "L", "password123"],
        ["Siti Aminah", "198709152021012002", "siti.aminah@school.com", "P", "password123"],
      ];
    } else {
      headers = ["nama", "nis", "email", "gender", "kelas", "password"];
      data = [
        ["Budi Raharjo", "1234567890", "budi.raharjo@student.com", "L", "XII RPL 1", "password123"],
        ["Anisa Fitri", "1234567891", "anisa.fitri@student.com", "P", "XII RPL 2", "password123"],
      ];
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Template_${type}`);
    XLSX.writeFile(wb, `template_import_${type}.xlsx`);
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      if (jsonData.length === 0) throw new Error("File kosong");
      
      let requiredColumns: string[];
      if (userType === "guru") requiredColumns = ["nama", "nip", "email", "gender"];
      else requiredColumns = ["nama", "nis", "email", "gender", "kelas"];
      
      const firstRow = jsonData[0] as any;
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      if (missingColumns.length) throw new Error(`Kolom diperlukan tidak ditemukan: ${missingColumns.join(", ")}`);
      
      setPreviewData(jsonData);
      
      const userTypeLabel = userType === "guru" ? "guru" : "siswa";
      toast({ 
        title: "File Berhasil Diupload", 
        description: `${jsonData.length} data ${userTypeLabel} berhasil dibaca dari file. Silakan periksa data dan klik "Impor Data" untuk menyimpan ke sistem.` 
      });
    } catch (error: any) {
      setUploadError(error.message);
      setPreviewData([]);
      
      let errorTitle = "Upload Gagal";
      let errorDescription = error.message;
      
      if (error.message.includes("File kosong")) {
        errorTitle = "File Kosong";
        errorDescription = "File Excel yang dipilih tidak mengandung data. Pastikan file memiliki data yang valid.";
      } else if (error.message.includes("Kolom diperlukan")) {
        errorTitle = "Format File Tidak Sesuai";
        errorDescription = error.message + ". Pastikan file Excel memiliki kolom yang diperlukan sesuai template.";
      } else if (error.message.includes("Unsupported file") || error.message.includes("Invalid")) {
        errorTitle = "Format File Tidak Didukung";
        errorDescription = "File yang dipilih bukan file Excel yang valid. Gunakan format .xlsx atau .xls.";
      } else {
        errorTitle = "Upload Gagal";
        errorDescription = error.message || "Terjadi kesalahan saat membaca file.";
      }
      
      toast({ 
        title: errorTitle, 
        description: errorDescription, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }, [userType, toast]);

  const getNextId = async (table: "guru" | "siswa"): Promise<number> => {
    const idField = table === "guru" ? "id_guru" : "id_siswa";
    const { data, error } = await supabase
      .from(table)
      .select(idField)
      .order(idField, { ascending: false })
      .limit(1);
    if (error) throw error;
    let currentMax = 0;
    if (data && data.length) currentMax = data[0][idField];
    return currentMax + 1;
  };

  const checkExistingData = async (type: "guru" | "siswa", data: any[]) => {
    const emails = data.map(item => item.email).filter(Boolean);
    const nipNisValues = data.map(item => type === "guru" ? item.nip : item.nis).filter(Boolean);
    
    const { data: existingAccounts } = await supabase
      .from("akun")
      .select("email")
      .in("email", emails);
    const existingEmails = existingAccounts?.map(acc => acc.email) || [];
    
    const field = type === "guru" ? "nip" : "nis";
    const { data: existingRecords } = await supabase
      .from(type as any)
      .select(field)
      .in(field, nipNisValues as any[]);
    const existingNipNis = existingRecords?.map((record: Record<string, any>) => record[field]) || [];
    
    return { existingEmails, existingNipNis };
  };

  const getKelasIdFromName = async (namaKelas: string): Promise<number | null> => {
    const { data, error } = await supabase
      .from("kelas")
      .select("id_kelas")
      .eq("nama", namaKelas)
      .maybeSingle();
    if (error) throw error;
    return data?.id_kelas || null;
  };

  const importGuru = async (data: GuruImportData[]) => {
    try {
      console.log("Starting importGuru with data:", data.length, "records");

      const { existingEmails, existingNipNis } = await checkExistingData("guru", data);
      console.log("Existing data check:", { existingEmails: existingEmails.length, existingNipNis: existingNipNis.length });

      const filteredData = data.filter(item =>
        !existingEmails.includes(item.email) &&
        !existingNipNis.includes(item.nip)
      );
      const skippedCount = data.length - filteredData.length;
      console.log("Filtered data:", { original: data.length, filtered: filteredData.length, skipped: skippedCount });

      if (!filteredData.length) {
        throw new Error(`Semua data sudah ada (${skippedCount} duplikat)`);
      }

      const nextId = await getNextId("guru");
      console.log("Next ID for guru:", nextId);

      const guruRecords = filteredData.map((item, idx) => ({
        id_guru: nextId + idx,
        nama: item.nama,
        nip: parseInt(item.nip),
        gender: item.gender.toUpperCase(),
        aktif: true,
        dibuat_pada: new Date().toISOString(),
      }));
      console.log("Guru records to insert:", guruRecords.length);

      const { data: insertedGuru, error: guruError } = await supabase.from("guru").insert(guruRecords).select();
      if (guruError) {
        console.error("Guru insert error:", guruError);
        throw new Error(`Gagal menyimpan data guru: ${guruError.message}`);
      }
      console.log("Guru records inserted successfully:", insertedGuru?.length);

      const akunRecords = [];
      try {
        for (const item of filteredData) {
          const plainPassword = item.password || "password123";
          const hashedPassword = await bcrypt.hash(plainPassword, 10);
          akunRecords.push({
            nama: item.nama,
            email: item.email,
            peran: "guru",
            aktif: true,
            dibuat_pada: new Date().toISOString(),
            id_guru: nextId + akunRecords.length,
            id_siswa: null,
            kata_sandi: hashedPassword,
          });
        }
      } catch (bcryptError: any) {
        console.error("Bcrypt error during guru password hashing:", bcryptError);
        throw new Error(`Gagal mengenkripsi password: ${bcryptError.message}`);
      }
      console.log("Akun records to insert:", akunRecords.length);

      const { data: insertedAkun, error: akunError } = await supabase.from("akun").insert(akunRecords).select();
      if (akunError) {
        console.error("Akun insert error:", akunError);
        try {
          await supabase.from("guru").delete().in("id_guru", insertedGuru?.map(g => g.id_guru) || []);
          console.log("Rollback successful: deleted guru records");
        } catch (rollbackError) {
          console.error("Rollback failed:", rollbackError);
        }
        throw new Error(`Gagal menyimpan data akun: ${akunError.message}`);
      }
      console.log("Akun records inserted successfully:", insertedAkun?.length);

      const insertedGuruIds = insertedGuru?.map(g => g.id_guru) || [];
      const insertedAkunEmails = insertedAkun?.map(a => a.email) || [];

      const { data: verifyGuru, error: verifyGuruError } = await supabase
        .from("guru")
        .select("id_guru, nama, nip")
        .in("id_guru", insertedGuruIds);

      const { data: verifyAkun, error: verifyAkunError } = await supabase
        .from("akun")
        .select("email, id_guru")
        .in("email", insertedAkunEmails);

      if (verifyGuruError || verifyAkunError) {
        console.error("Verification error:", { verifyGuruError, verifyAkunError });
        throw new Error("Gagal memverifikasi data yang disimpan");
      }

      const actualGuruCount = verifyGuru?.length || 0;
      const actualAkunCount = verifyAkun?.length || 0;

      console.log("Verification results:", {
        expectedGuru: insertedGuruIds.length,
        actualGuru: actualGuruCount,
        expectedAkun: insertedAkunEmails.length,
        actualAkun: actualAkunCount
      });

      if (actualGuruCount !== insertedGuruIds.length || actualAkunCount !== insertedAkunEmails.length) {
        throw new Error(`Data tidak tersimpan dengan lengkap. Guru: ${actualGuruCount}/${insertedGuruIds.length}, Akun: ${actualAkunCount}/${insertedAkunEmails.length}`);
      }

      return { success: filteredData.length, skipped: skippedCount };
    } catch (error: any) {
      console.error("Error in importGuru:", error);
      throw error;
    }
  };

  const importSiswa = async (data: SiswaImportData[]) => {
    try {
      console.log("Starting importSiswa with data:", data.length, "records");

      const kelasNames = [...new Set(data.map(item => item.kelas).filter(Boolean))];
      console.log("Kelas names to check:", kelasNames);

      const kelasMap = new Map<string, number>();
      for (const nama of kelasNames) {
        const id = await getKelasIdFromName(nama);
        if (!id) {
          throw new Error(`Kelas "${nama}" tidak ditemukan. Silakan tambah kelas terlebih dahulu.`);
        }
        kelasMap.set(nama, id);
      }
      console.log("Kelas mapping:", Object.fromEntries(kelasMap));

      const { existingEmails, existingNipNis } = await checkExistingData("siswa", data);
      console.log("Existing data check:", { existingEmails: existingEmails.length, existingNipNis: existingNipNis.length });

      const filteredData = data.filter(item =>
        !existingEmails.includes(item.email) &&
        !existingNipNis.includes(item.nis)
      );
      const skippedCount = data.length - filteredData.length;
      console.log("Filtered data:", { original: data.length, filtered: filteredData.length, skipped: skippedCount });

      if (!filteredData.length) {
        throw new Error(`Semua data sudah ada (${skippedCount} duplikat)`);
      }

      const nextId = await getNextId("siswa");
      console.log("Next ID for siswa:", nextId);

      const siswaRecords = filteredData.map((item, idx) => ({
        id_siswa: nextId + idx,
        nama: item.nama,
        nis: parseInt(item.nis),
        gender: item.gender.toUpperCase(),
        aktif: true,
        dibuat_pada: new Date().toISOString(),
        id_kelas: kelasMap.get(item.kelas) || null,
      }));
      console.log("Siswa records to insert:", siswaRecords.length);

      const { data: insertedSiswa, error: siswaError } = await supabase.from("siswa").insert(siswaRecords).select();
      if (siswaError) {
        console.error("Siswa insert error:", siswaError);
        throw new Error(`Gagal menyimpan data siswa: ${siswaError.message}`);
      }
      console.log("Siswa records inserted successfully:", insertedSiswa?.length);

      const akunRecords = [];
      try {
        for (const item of filteredData) {
          const plainPassword = item.password || "password123";
          const hashedPassword = await bcrypt.hash(plainPassword, 10);
          akunRecords.push({
            nama: item.nama,
            email: item.email,
            peran: "siswa",
            aktif: true,
            dibuat_pada: new Date().toISOString(),
            id_guru: null,
            id_siswa: nextId + akunRecords.length,
            kata_sandi: hashedPassword,
          });
        }
      } catch (bcryptError: any) {
        console.error("Bcrypt error during siswa password hashing:", bcryptError);
        throw new Error(`Gagal mengenkripsi password: ${bcryptError.message}`);
      }
      console.log("Akun records to insert:", akunRecords.length);

      const { data: insertedAkun, error: akunError } = await supabase.from("akun").insert(akunRecords).select();
      if (akunError) {
        console.error("Akun insert error:", akunError);
        try {
          await supabase.from("siswa").delete().in("id_siswa", insertedSiswa?.map(s => s.id_siswa) || []);
          console.log("Rollback successful: deleted siswa records");
        } catch (rollbackError) {
          console.error("Rollback failed:", rollbackError);
        }
        throw new Error(`Gagal menyimpan data akun: ${akunError.message}`);
      }
      console.log("Akun records inserted successfully:", insertedAkun?.length);

      const insertedSiswaIds = insertedSiswa?.map(s => s.id_siswa) || [];
      const insertedAkunEmails = insertedAkun?.map(a => a.email) || [];

      const { data: verifySiswa, error: verifySiswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis")
        .in("id_siswa", insertedSiswaIds);

      const { data: verifyAkun, error: verifyAkunError } = await supabase
        .from("akun")
        .select("email, id_siswa")
        .in("email", insertedAkunEmails);

      if (verifySiswaError || verifyAkunError) {
        console.error("Verification error:", { verifySiswaError, verifyAkunError });
        throw new Error("Gagal memverifikasi data yang disimpan");
      }

      const actualSiswaCount = verifySiswa?.length || 0;
      const actualAkunCount = verifyAkun?.length || 0;

      console.log("Verification results:", {
        expectedSiswa: insertedSiswaIds.length,
        actualSiswa: actualSiswaCount,
        expectedAkun: insertedAkunEmails.length,
        actualAkun: actualAkunCount
      });

      if (actualSiswaCount !== insertedSiswaIds.length || actualAkunCount !== insertedAkunEmails.length) {
        throw new Error(`Data tidak tersimpan dengan lengkap. Siswa: ${actualSiswaCount}/${insertedSiswaIds.length}, Akun: ${actualAkunCount}/${insertedAkunEmails.length}`);
      }

      return { success: filteredData.length, skipped: skippedCount };
    } catch (error: any) {
      console.error("Error in importSiswa:", error);
      throw error;
    }
  };

  const handleImport = async () => {
    if (!previewData.length) {
      toast({ title: "Kesalahan", description: "Tidak ada data untuk diimport", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    console.log("Starting handleImport with previewData:", previewData.length, "records");

    try {
      let result;
      if (userType === "guru") {
        console.log("Calling importGuru");
        result = await importGuru(previewData as GuruImportData[]);
      } else {
        console.log("Calling importSiswa");
        result = await importSiswa(previewData as SiswaImportData[]);
      }

      console.log("Import result:", result);

      let successTitle = "Impor Berhasil";
      let successDescription = "";

      if (result.success > 0 && result.skipped === 0) {
        successDescription = `${result.success} data ${userType} berhasil diimpor dan disimpan ke sistem.`;
      } else if (result.success > 0 && result.skipped > 0) {
        successDescription = `${result.success} data ${userType} berhasil diimpor dan disimpan, ${result.skipped} data duplikat dilewati.`;
      } else if (result.success === 0 && result.skipped > 0) {
        successTitle = "Tidak Ada Data Baru";
        successDescription = `Semua ${result.skipped} data sudah ada dalam sistem. Tidak ada data baru yang berhasil diimpor.`;
      }

      console.log("Showing success toast:", { title: successTitle, description: successDescription });
      toast({
        title: successTitle,
        description: successDescription
      });
      setPreviewData([]);
      if (activeTab === "list") {
        resetPagination();
        if (userType === "guru") fetchGuru(); else fetchSiswa();
      }
    } catch (error: any) {
      console.error("Import error caught in handleImport:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      let errorTitle = "Impor Gagal";
      let errorDescription = error.message;

      if (error.message && error.message.includes("Semua data sudah ada")) {
        errorTitle = "Tidak Ada Data Baru";
        errorDescription = "Semua data yang akan diimpor sudah ada dalam sistem. Tidak ada data baru yang berhasil diimpor.";
      } else if (error.message && error.message.includes("Kelas") && error.message.includes("tidak ditemukan")) {
        errorTitle = "Kelas Tidak Ditemukan";
        errorDescription = error.message + " Pastikan nama kelas sudah benar dan sudah ditambahkan ke sistem.";
      } else if (error.message && (error.message.includes("duplicate key") || error.message.includes("already exists"))) {
        errorTitle = "Data Duplikat";
        errorDescription = "Beberapa data sudah ada dalam sistem. Silakan periksa email, NIP/NIS yang duplikat.";
      } else if (error.message && (error.message.includes("invalid input syntax") || error.message.includes("violates"))) {
        errorTitle = "Format Data Tidak Valid";
        errorDescription = "Format data tidak sesuai. Pastikan NIP/NIS berupa angka dan data lainnya valid.";
      } else if (error.message && (error.message.includes("connection") || error.message.includes("network"))) {
        errorTitle = "Masalah Koneksi";
        errorDescription = "Terjadi masalah koneksi ke server. Silakan coba lagi dalam beberapa saat.";
      } else if (error.message && error.message.includes("bcrypt")) {
        errorTitle = "Error Enkripsi Password";
        errorDescription = "Terjadi kesalahan saat mengenkripsi password. Silakan coba lagi.";
      } else if (error.message && error.message.includes("memverifikasi data")) {
        errorTitle = "Verifikasi Data Gagal";
        errorDescription = "Data gagal disimpan ke database meskipun operasi insert berhasil. " + error.message;
      } else if (error.message && error.message.includes("tidak tersimpan dengan lengkap")) {
        errorTitle = "Data Tidak Lengkap";
        errorDescription = "Beberapa data tidak tersimpan dengan lengkap ke database. " + error.message;
      } else {
        errorTitle = "Impor Gagal";
        errorDescription = error.message || "Terjadi kesalahan yang tidak diketahui saat mengimpor data.";
      }

      console.log("Showing error toast:", { title: errorTitle, description: errorDescription });
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive"
      });
    } finally {
      console.log("Setting isLoading to false");
      setIsLoading(false);
    }
  };

  // ==================== UPDATE USER ====================
  const checkDuplicateEmail = async (email: string, excludeId?: { type: 'guru' | 'siswa', id: number }): Promise<boolean> => {
    let query = supabase.from('akun').select('email').eq('email', email);
    if (excludeId) {
      if (excludeId.type === 'guru') query = query.not('id_guru', 'eq', excludeId.id);
      else query = query.not('id_siswa', 'eq', excludeId.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data && data.length > 0);
  };

  const checkDuplicateNip = async (nip: string, excludeGuruId?: number): Promise<boolean> => {
    const numericNip = parseInt(nip);
    if (isNaN(numericNip)) return false;
    let query = supabase.from('guru').select('nip').eq('nip', numericNip);
    if (excludeGuruId) query = query.not('id_guru', 'eq', excludeGuruId);
    const { data, error } = await query;
    if (error) throw error;
    return (data && data.length > 0);
  };

  const checkDuplicateNis = async (nis: string, excludeSiswaId?: number): Promise<boolean> => {
    const numericNis = parseInt(nis);
    if (isNaN(numericNis)) return false;
    let query = supabase.from('siswa').select('nis').eq('nis', numericNis);
    if (excludeSiswaId) query = query.not('id_siswa', 'eq', excludeSiswaId);
    const { data, error } = await query;
    if (error) throw error;
    return (data && data.length > 0);
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setEditForm({
      nama: user.nama,
      email: user.email,
      gender: user.gender,
      nip: user.nip || "",
      nis: user.nis || "",
      kelas_id: user.id_kelas?.toString() || "",
      password: "",
      aktif: user.aktif !== undefined ? user.aktif : true,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      const isGuru = userType === "guru";
      const userId = isGuru ? editingUser.id_guru : editingUser.id_siswa;

      const isEmailExist = await checkDuplicateEmail(editForm.email, { type: userType, id: userId });
      if (isEmailExist) {
        toast({ title: "Error", description: "Email sudah digunakan oleh pengguna lain.", variant: "destructive" });
        return;
      }

      if (isGuru) {
        if (editForm.nip && editForm.nip !== editingUser.nip) {
          const isNipExist = await checkDuplicateNip(editForm.nip, userId);
          if (isNipExist) {
            toast({ title: "Kesalahan", description: "NIP sudah digunakan oleh guru lain.", variant: "destructive" });
            return;
          }
        }
      } else {
        if (editForm.nis && editForm.nis !== editingUser.nis) {
          const isNisExist = await checkDuplicateNis(editForm.nis, userId);
          if (isNisExist) {
            toast({ title: "Kesalahan", description: "NIS sudah digunakan oleh siswa lain.", variant: "destructive" });
            return;
          }
        }
      }

      const tableName = isGuru ? "guru" : "siswa";
      const idField = isGuru ? "id_guru" : "id_siswa";
      const updateData: any = { 
        nama: editForm.nama, 
        gender: editForm.gender.toUpperCase(),
        aktif: editForm.aktif,
      };
      
      if (isGuru && editForm.nip && editForm.nip !== editingUser.nip) {
        updateData.nip = parseInt(editForm.nip);
      }
      if (!isGuru && editForm.nis && editForm.nis !== editingUser.nis) {
        updateData.nis = parseInt(editForm.nis);
      }
      if (!isGuru && editForm.kelas_id && editForm.kelas_id !== "none") {
        updateData.id_kelas = parseInt(editForm.kelas_id);
      } else if (!isGuru && editForm.kelas_id === "none") {
        updateData.id_kelas = null;
      }
      
      const { error: updateError } = await supabase
        .from(tableName as any)
        .update(updateData)
        .eq(idField, userId as any);
      if (updateError) throw updateError;
      
      const akunUpdate: any = { 
        nama: editForm.nama, 
        email: editForm.email,
        aktif: editForm.aktif,
      };
      if (editForm.password.trim()) {
        akunUpdate.kata_sandi = await bcrypt.hash(editForm.password, 10);
      }
      
      const { error: akunError } = await supabase
        .from("akun")
        .update(akunUpdate)
        .eq(isGuru ? "id_guru" : "id_siswa", userId as any);
      if (akunError) throw akunError;
      
      toast({ title: "Berhasil", description: "Data pengguna berhasil diperbarui" });
      setEditDialogOpen(false);
      resetPagination();
      if (isGuru) fetchGuru(); else fetchSiswa();
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== NONAKTIFKAN / AKTIFKAN (SINGLE) ====================
  const checkUserRelatedData = async (type: "guru" | "siswa", id: number): Promise<string[]> => {
    const related: string[] = [];
    if (type === "guru") {
      const { data: jadwalData } = await supabase.from("jadwal").select("id_jadwal").eq("id_guru", id);
      if (jadwalData?.length) related.push(`📚 Memiliki ${jadwalData.length} jadwal mengajar`);
      const { data: kelasData } = await supabase.from("kelas").select("id_kelas").eq("id_guru", id);
      if (kelasData?.length) related.push(`🏫 Menjadi wali kelas untuk ${kelasData.length} kelas`);
      const { data: pklData } = await supabase.from("pkl").select("id_pkl").eq("id_guru", id);
      if (pklData?.length) related.push(`🏢 Membimbing ${pklData.length} PKL`);
    } else {
      const { data: presHarian } = await supabase.from("presensi_harian").select("id_presensi_harian").eq("id_siswa", id);
      if (presHarian?.length) related.push(`📅 Memiliki ${presHarian.length} data presensi harian`);
      const { data: presMapel } = await supabase.from("presensi_siswa_mapel").select("id_pre_siswa").eq("id_siswa", id);
      if (presMapel?.length) related.push(`📖 Memiliki ${presMapel.length} data presensi mata pelajaran`);
    }
    return related;
  };

  const executeActivateUser = async (user: any) => {
    const isGuru = userType === "guru";
    const userId = isGuru ? user.id_guru : user.id_siswa;
    const tableName = isGuru ? "guru" : "siswa";
    const idField = isGuru ? "id_guru" : "id_siswa";

    try {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ aktif: true })
        .eq(idField, userId);
      if (updateError) throw updateError;

      const { error: akunError } = await supabase
        .from("akun")
        .update({ aktif: true })
        .eq(isGuru ? "id_guru" : "id_siswa", userId);
      if (akunError) throw akunError;

      toast({ title: "Berhasil", description: `Pengguna ${user.nama} telah diaktifkan kembali.` });
      resetPagination();
      if (isGuru) fetchGuru(); else fetchSiswa();
      if (selectMode) { setSelectMode(false); setSelectedIds([]); }
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    }
  };

  const confirmDeactivate = async (user: any) => {
    const isGuru = userType === "guru";
    const userId = isGuru ? user.id_guru : user.id_siswa;
    const constraints = await checkUserRelatedData(userType, userId);
    setDeactivatingUser(user);
    setDeactivateConstraints(constraints);
    setIsActivatingMode(false);
    setDeactivateDialogOpen(true);
  };

  const confirmActivate = (user: any) => {
    setDeactivatingUser(user);
    setDeactivateConstraints([]);
    setIsActivatingMode(true);
    setDeactivateDialogOpen(true);
  };

  const executeToggleActive = async () => {
    if (!deactivatingUser) return;
    setIsLoading(true);
    setDeactivateDialogOpen(false);
    if (isActivatingMode) {
      await executeActivateUser(deactivatingUser);
    } else {
      const isGuru = userType === "guru";
      const userId = isGuru ? deactivatingUser.id_guru : deactivatingUser.id_siswa;
      const tableName = isGuru ? "guru" : "siswa";
      const idField = isGuru ? "id_guru" : "id_siswa";
      try {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ aktif: false })
          .eq(idField, userId);
        if (updateError) throw updateError;
        const { error: akunError } = await supabase
          .from("akun")
          .update({ aktif: false })
          .eq(isGuru ? "id_guru" : "id_siswa", userId);
        if (akunError) throw akunError;
        toast({ title: "Berhasil", description: `Pengguna ${deactivatingUser.nama} telah dinonaktifkan.` });
        resetPagination();
        if (isGuru) fetchGuru(); else fetchSiswa();
        if (selectMode) { setSelectMode(false); setSelectedIds([]); }
      } catch (error: any) {
        toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
      }
    }
    setIsLoading(false);
    setDeactivatingUser(null);
    setDeactivateConstraints([]);
  };

  // ==================== SELECT MASSAL ====================
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) setSelectedIds([]);
  };

  const handleSelectAll = () => {
    const currentIds = userType === "guru"
      ? displayedGuruList.map(g => g.id_guru)
      : displayedSiswaList.map(s => s.id_siswa);
    if (selectedIds.length === currentIds.length && currentIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentIds);
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action: "activate" | "deactivate") => {
    if (selectedIds.length === 0) {
      toast({ title: "Tidak ada data dipilih", variant: "destructive" });
      return;
    }

    const isGuru = userType === "guru";
    const usersSelected = selectedIds.map(id => {
      if (isGuru) {
        const guru = guruList.find(g => g.id_guru === id);
        return { id, nama: guru?.nama || `ID ${id}`, aktif: guru?.aktif ?? false };
      } else {
        const siswa = siswaList.find(s => s.id_siswa === id);
        return { id, nama: siswa?.nama || `ID ${id}`, aktif: siswa?.aktif ?? false };
      }
    });

    const cannotProcess: { id: number; nama: string; reasons: string[] }[] = [];
    const canProcessIds: number[] = [];

    if (action === "deactivate") {
      for (const user of usersSelected) {
        if (!user.aktif) continue;
        const reasons = await checkUserRelatedData(userType, user.id);
        if (reasons.length > 0) {
          cannotProcess.push({ id: user.id, nama: user.nama, reasons });
        } else {
          canProcessIds.push(user.id);
        }
      }
    } else {
      for (const user of usersSelected) {
        if (!user.aktif) canProcessIds.push(user.id);
      }
    }

    setBulkActionData({
      users: usersSelected,
      cannotProcess,
      canProcessIds,
    });
    setBulkActionType(action);
    setBulkActionDialogOpen(true);
  };

  const executeBulkAction = async () => {
    if (!bulkActionData) return;
    const { canProcessIds } = bulkActionData;
    const isGuru = userType === "guru";
    const tableName = isGuru ? "guru" : "siswa";
    const idField = isGuru ? "id_guru" : "id_siswa";
    const newActiveStatus = bulkActionType === "activate";

    setIsProcessingSelected(true);
    setBulkActionDialogOpen(false);

    let successCount = 0;
    let failCount = 0;

    for (const id of canProcessIds) {
      try {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ aktif: newActiveStatus })
          .eq(idField, id);
        if (updateError) throw updateError;
        const { error: akunError } = await supabase
          .from("akun")
          .update({ aktif: newActiveStatus })
          .eq(isGuru ? "id_guru" : "id_siswa", id);
        if (akunError) throw akunError;
        successCount++;
      } catch (err) {
        console.error(`Gagal ${bulkActionType} ID ${id}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Berhasil",
        description: `${successCount} pengguna berhasil ${bulkActionType === "activate" ? "diaktifkan" : "dinonaktifkan"}${failCount > 0 ? `, ${failCount} gagal` : ""}`,
      });
      resetPagination();
      if (isGuru) fetchGuru(); else fetchSiswa();
      setSelectMode(false);
      setSelectedIds([]);
    } else {
      toast({ title: "Gagal", description: "Tidak ada perubahan.", variant: "destructive" });
    }
    setIsProcessingSelected(false);
    setBulkActionData(null);
  };

  // ==================== STATS ====================
  const totalAllGuru = guruList.length;
  const totalAllSiswa = siswaList.length;
  const totalAllAkun = totalAllGuru + totalAllSiswa;

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><Users className="h-8 w-8" /></div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Manajemen Data Pengguna & Kelas</h1>
                <p className="text-blue-100 text-sm">Impor, ubah, aktifkan/nonaktifkan data guru/siswa, serta kelola kelas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
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
                <div><p className="text-xs text-blue-600 font-medium">Total Guru</p><p className="text-2xl font-bold text-blue-900">{totalAllGuru}</p></div>
                <User className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-emerald-600 font-medium">Total Siswa</p><p className="text-2xl font-bold text-emerald-900">{totalAllSiswa}</p></div>
                <GraduationCap className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-purple-600 font-medium">Total Kelas</p><p className="text-2xl font-bold text-purple-900">{kelasList.length}</p></div>
                <School className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-xs text-amber-600 font-medium">Total Akun</p><p className="text-2xl font-bold text-amber-900">{totalAllAkun}</p></div>
                <UserCheck className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN TABS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl"><Shield className="h-6 w-6" /></div>
              <div><CardTitle className="text-xl">Manajemen Pengguna & Kelas</CardTitle><CardDescription className="text-slate-300 text-sm">Kelola data guru, siswa, dan kelas dengan soft delete</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="import" className="rounded-lg data-[state=active]:bg-white"><Upload className="h-3.5 w-3.5 mr-1" /> Impor Data</TabsTrigger>
                  <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white"><Users className="h-3.5 w-3.5 mr-1" /> Daftar Pengguna</TabsTrigger>
                  <TabsTrigger value="kelas" className="rounded-lg data-[state=active]:bg-white"><School className="h-3.5 w-3.5 mr-1" /> Kelola Kelas</TabsTrigger>
                </TabsList>
              </div>

              {/* TAB IMPORT */}
              <TabsContent value="import" className="space-y-6">
                {/* ... (sama seperti sebelumnya, tidak berubah) ... */}
                <div className="flex flex-col sm:flex-row gap-4 items-end justify-center">
                  <div className="w-48">
                    <Label className="text-slate-700 font-medium">Tipe User</Label>
                    <Select value={userType} onValueChange={(v) => setUserType(v as "guru" | "siswa")}>
                      <SelectTrigger className="rounded-xl border-slate-200 h-9 text-sm">
                        <SelectValue placeholder="Pilih tipe user" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="siswa">Siswa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={() => downloadTemplate(userType)} className="rounded-xl h-9 text-sm">
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Unduh Template
                  </Button>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleFileUpload} 
                      disabled={isLoading} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <Button disabled={isLoading} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      {isLoading ? "Memproses..." : "Unggah File"}
                    </Button>
                  </div>
                </div>
                {uploadError && <Alert variant="destructive" className="rounded-xl"><AlertCircle className="h-4 w-4" /><AlertDescription>{uploadError}</AlertDescription></Alert>}
                {previewData.length > 0 && (
                  <>
                    <Alert className="rounded-xl bg-emerald-50 border-emerald-200 max-w-md mx-auto">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700">{previewData.length} data siap diimport</AlertDescription>
                    </Alert>
                    <div className="border rounded-xl overflow-auto max-h-96 shadow-sm">
                      <Table>
                        <TableHeader><TableRow className="bg-slate-50">
                          <TableHead>Nama</TableHead><TableHead>{userType === "guru" ? "NIP" : "NIS"}</TableHead><TableHead>Email</TableHead><TableHead>Gender</TableHead>
                          {userType === "siswa" && <TableHead>Kelas</TableHead>}
                        </TableRow></TableHeader>
                        <TableBody>
                          {previewData.slice(0, 10).map((item: any, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.nama}</TableCell>
                              <TableCell className="font-mono">{userType === "guru" ? item.nip : item.nis}</TableCell>
                              <TableCell>{item.email}</TableCell>
                              <TableCell><Badge className={item.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}>{item.gender === "L" ? "Laki-laki" : "Perempuan"}</Badge></TableCell>
                              {userType === "siswa" && <TableCell>{item.kelas}</TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-center"><Button onClick={handleImport} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Impor Data</Button></div>
                  </>
                )}
              </TabsContent>

              {/* TAB DAFTAR PENGGUNA */}
              <TabsContent value="list" className="space-y-6">
                {/* ... (sama seperti sebelumnya, tidak berubah) ... */}
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <Select value={userType} onValueChange={(v) => { setUserType(v as any); resetFilters(); }}>
                      <SelectTrigger className="w-[180px] rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="guru">Guru</SelectItem><SelectItem value="siswa">Siswa</SelectItem></SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => { resetPagination(); userType === "guru" ? fetchGuru() : fetchSiswa(); }} disabled={isFetching} className="rounded-xl h-9 text-sm">
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Segarkan
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-end justify-between">
                    <div className="flex-1 flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input type="text" placeholder={`Cari ${userType === "guru" ? "guru" : "siswa"}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-10 rounded-xl h-9 text-sm" />
                        {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2"><X className="h-4 w-4" /></button>}
                      </div>
                      {userType === "siswa" && (
                        <div className="relative">
                          <Button variant="outline" onClick={() => setShowFilter(!showFilter)} className={`rounded-xl h-9 text-sm gap-2 ${filterKelas !== "all" ? "bg-blue-50 border-blue-300 text-blue-700" : ""}`}>
                            <Filter className="h-3.5 w-3.5" /> Filter Kelas
                            {filterKelas !== "all" && <Badge className="bg-blue-500 text-white text-xs ml-1">{filterKelas === "unassigned" ? "Tanpa Kelas" : kelasList.find(k => k.id_kelas.toString() === filterKelas)?.nama || "?"}</Badge>}
                          </Button>
                          {showFilter && (
                            <div className="absolute top-full mt-2 right-0 z-20 bg-white rounded-xl shadow-xl border p-3 min-w-[260px]">
                              <div className="text-xs font-medium text-slate-500 mb-2">Filter berdasarkan kelas</div>
                              <div className="relative mb-2"><Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Cari kelas..." value={filterSearchQuery} onChange={(e) => setFilterSearchQuery(e.target.value)} className="pl-7 h-8 text-sm rounded-lg" onClick={(e) => e.stopPropagation()} /></div>
                              <div className="max-h-60 overflow-y-auto space-y-1">
                                <button onClick={() => { setFilterKelas("all"); setShowFilter(false); setFilterSearchQuery(""); resetPagination(); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 flex justify-between items-center ${filterKelas === "all" ? "bg-blue-50 text-blue-700" : ""}`}><span>Semua Kelas</span><Badge className="bg-slate-100 text-slate-600">{totalData}</Badge></button>
                                <button onClick={() => { setFilterKelas("unassigned"); setShowFilter(false); setFilterSearchQuery(""); resetPagination(); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 flex justify-between items-center ${filterKelas === "unassigned" ? "bg-blue-50 text-blue-700" : ""}`}><span className="text-amber-600">⚠️ Tanpa Kelas</span><Badge className="bg-amber-100 text-amber-600">-</Badge></button>
                                <div className="border-t my-1"></div>
                                {filteredKelasOptions.map(kelas => <button key={kelas.id_kelas} onClick={() => { setFilterKelas(kelas.id_kelas.toString()); setShowFilter(false); setFilterSearchQuery(""); resetPagination(); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 flex justify-between items-center ${filterKelas === kelas.id_kelas.toString() ? "bg-blue-50 text-blue-700" : ""}`}><span>{kelas.nama}</span><Badge className="bg-slate-100 text-slate-600">-</Badge></button>)}
                                {filteredKelasOptions.length === 0 && filterSearchQuery && <div className="text-center text-xs text-slate-400 py-2">Tidak ada kelas yang cocok</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button variant={selectMode ? "default" : "outline"} onClick={toggleSelectMode} className="rounded-xl h-9 text-sm">{selectMode ? "Batalkan Mode Pilih" : "Mode Pilih"}</Button>
                      {selectMode && (
                        <>
                          <Button variant="default" onClick={() => handleBulkAction("activate")} disabled={selectedIds.length === 0 || isProcessingSelected} className="rounded-xl h-9 text-sm bg-green-600 hover:bg-green-700">
                            {isProcessingSelected && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Aktifkan ({selectedIds.filter(id => { const u = userType === "guru" ? guruList.find(g => g.id_guru === id) : siswaList.find(s => s.id_siswa === id); return u && !u.aktif; }).length})
                          </Button>
                          <Button variant="destructive" onClick={() => handleBulkAction("deactivate")} disabled={selectedIds.length === 0 || isProcessingSelected} className="rounded-xl h-9 text-sm">
                            {isProcessingSelected && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Nonaktifkan ({selectedIds.filter(id => { const u = userType === "guru" ? guruList.find(g => g.id_guru === id) : siswaList.find(s => s.id_siswa === id); return u && u.aktif; }).length})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {(searchQuery || filterKelas !== "all") && <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg"><div className="text-sm">Menampilkan {totalData} data {userType}</div><Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs"><X className="h-3 w-3 mr-1" /> Reset Filter</Button></div>}
                {isFetching ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
                  <>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              {selectMode && <TableHead className="w-10"><Checkbox checked={selectedIds.length > 0 && selectedIds.length === (userType === "guru" ? displayedGuruList.length : displayedSiswaList.length)} onCheckedChange={handleSelectAll} /></TableHead>}
                              <TableHead>Nama</TableHead><TableHead>{userType === "guru" ? "NIP" : "NIS"}</TableHead><TableHead>Email</TableHead><TableHead>Gender</TableHead>
                              {userType === "siswa" && <TableHead>Kelas</TableHead>}<TableHead className="text-center">Status</TableHead><TableHead className="text-center">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userType === "guru" ? displayedGuruList.map(guru => (
                              <TableRow key={guru.id_guru}>
                                {selectMode && <TableCell><Checkbox checked={selectedIds.includes(guru.id_guru)} onCheckedChange={() => handleSelectItem(guru.id_guru)} /></TableCell>}
                                <TableCell>{guru.nama}</TableCell><TableCell className="font-mono">{guru.nip}</TableCell><TableCell>{guru.email}</TableCell>
                                <TableCell><Badge className={guru.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}>{guru.gender === "L" ? "Laki-laki" : "Perempuan"}</Badge></TableCell>
                                <TableCell className="text-center"><Badge className={guru.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{guru.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                                <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditDialog(guru)}><Edit className="h-4 w-4 text-blue-500" /></Button>{guru.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmDeactivate(guru)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmActivate(guru)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                              </TableRow>
                            )) : displayedSiswaList.map(siswa => (
                              <TableRow key={siswa.id_siswa}>
                                {selectMode && <TableCell><Checkbox checked={selectedIds.includes(siswa.id_siswa)} onCheckedChange={() => handleSelectItem(siswa.id_siswa)} /></TableCell>}
                                <TableCell>{siswa.nama}</TableCell><TableCell className="font-mono">{siswa.nis}</TableCell><TableCell>{siswa.email}</TableCell>
                                <TableCell><Badge className={siswa.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}>{siswa.gender === "L" ? "Laki-laki" : "Perempuan"}</Badge></TableCell>
                                <TableCell>{siswa.nama_kelas ? <Badge variant="outline" className="bg-purple-50">{siswa.nama_kelas}</Badge> : <Badge variant="outline" className="bg-amber-50">Belum kelas</Badge>}</TableCell>
                                <TableCell className="text-center"><Badge className={siswa.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{siswa.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                                <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditDialog(siswa)}><Edit className="h-4 w-4 text-blue-500" /></Button>{siswa.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmDeactivate(siswa)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmActivate(siswa)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                              </TableRow>
                            ))}
                            {((userType === "guru" && !displayedGuruList.length) || (userType === "siswa" && !displayedSiswaList.length)) && <TableRow><TableCell colSpan={userType === "guru" ? (selectMode ? 8 : 7) : (selectMode ? 9 : 8)} className="text-center py-8 text-slate-500"><Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />Tidak ada data</TableCell></TableRow>}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    {totalData > 0 && (
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                        <div className="flex items-center gap-2"><span className="text-sm">Tampilkan</span><Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}><SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select><span>per halaman</span></div>
                        <div className="flex gap-1"><Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button><div className="px-2"><span className="font-medium">{currentPage}</span><span className="text-slate-400"> / {totalPages || 1}</span></div><Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage === totalPages || totalPages === 0}><ChevronsRight className="h-4 w-4" /></Button></div>
                        <div className="text-sm">Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalData)} dari {totalData} data</div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* TAB KELOLA KELAS (dengan tombol aktif/nonaktif) */}
              <TabsContent value="kelas" className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <Button onClick={handleAddKelas} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Kelas
                  </Button>
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input type="text" placeholder="Cari kelas (nama kelas, wali kelas, ID)..." value={searchKelasQuery} onChange={(e) => setSearchKelasQuery(e.target.value)} className="pl-10 pr-10 rounded-xl border-slate-200 h-9 text-sm" />
                    {searchKelasQuery && <button onClick={() => setSearchKelasQuery("")} className="absolute right-3 top-1/2"><X className="h-4 w-4" /></button>}
                  </div>
                  <Button variant="outline" onClick={fetchKelas} disabled={isFetchingKelas} className="rounded-xl h-9 text-sm"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingKelas ? "animate-spin" : ""}`} /> Segarkan</Button>
                </div>
                {searchKelasQuery && <div className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg">Menampilkan {filteredKelasList.length} dari {kelasList.length} kelas</div>}
                {isFetchingKelas ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold">Nama Kelas</TableHead>
                            <TableHead className="font-semibold">Wali Kelas</TableHead>
                            <TableHead className="font-semibold text-center">Status</TableHead>
                            <TableHead className="font-semibold">Dibuat Pada</TableHead>
                            <TableHead className="font-semibold text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredKelasList.map(kelas => (
                            <TableRow key={kelas.id_kelas} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-medium">{kelas.nama}</TableCell>
                              <TableCell><div className="flex items-center gap-2"><div className="bg-purple-100 p-1.5 rounded-lg"><User className="h-3 w-3 text-purple-600" /></div>{kelas.guru_nama || "-"}</div></TableCell>
                              <TableCell className="text-center"><Badge className={kelas.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{kelas.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                              <TableCell className="text-slate-500 text-sm">{new Date(kelas.dibuat_pada).toLocaleDateString()}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditKelas(kelas)} className="h-8 w-8 p-0 rounded-lg"><Edit className="h-4 w-4 text-blue-500" /></Button>
                                  {kelas.aktif ? (
                                    <Button variant="ghost" size="sm" onClick={() => confirmToggleActiveKelas(kelas, false)} className="h-8 w-8 p-0 rounded-lg"><UserMinus className="h-4 w-4 text-red-500" /></Button>
                                  ) : (
                                    <Button variant="ghost" size="sm" onClick={() => confirmToggleActiveKelas(kelas, true)} className="h-8 w-8 p-0 rounded-lg"><UserPlus className="h-4 w-4 text-green-500" /></Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!filteredKelasList.length && (
                            <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">{searchKelasQuery ? <><Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />Tidak ada kelas yang cocok dengan "{searchKelasQuery}"</> : <><School className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada data kelas</>}</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 max-w-3xl mx-auto">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl"><Sparkles className="h-6 w-6 text-indigo-600" /></div>
              <div><h3 className="font-semibold text-slate-800 mb-1">Tips Mengelola Data</h3><p className="text-sm text-slate-600">Gunakan fitur import Excel untuk menambahkan banyak data sekaligus. Pastikan format file sesuai template. Data duplikat (email, NIP, NIS) akan otomatis dilewati saat import. Data ditampilkan dengan urutan nama (A-Z) untuk memudahkan pencarian. Gunakan mode Select untuk mengaktifkan/nonaktifkan banyak pengguna sekaligus. Kelas dapat dinonaktifkan (soft delete) dan diaktifkan kembali.</p></div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4"><Separator className="mb-4" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen Pengguna & Kelas - SmartAS</p><p className="text-[10px] text-slate-300 mt-1">Sistem Informasi Akademik</p></div>
      </div>

      {/* DIALOG EDIT PENGGUNA */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle><Edit className="h-5 w-5 inline mr-2 text-blue-600" /> Edit Pengguna</DialogTitle><DialogDescription>Ubah informasi user. Kosongkan password jika tidak ingin mengubah.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama</Label><Input value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} className="rounded-xl mt-1" /></div>
            <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="rounded-xl mt-1" /></div>
            {userType === "guru" && <div><Label>NIP</Label><Input value={editForm.nip} onChange={e => setEditForm({...editForm, nip: e.target.value})} className="rounded-xl mt-1" /></div>}
            {userType === "siswa" && <div><Label>NIS</Label><Input value={editForm.nis} onChange={e => setEditForm({...editForm, nis: e.target.value})} className="rounded-xl mt-1" /></div>}
            <div><Label>Gender</Label><Select value={editForm.gender} onValueChange={v => setEditForm({...editForm, gender: v})}><SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></div>
            {userType === "siswa" && <div><Label>Kelas</Label><Select value={editForm.kelas_id} onValueChange={v => setEditForm({...editForm, kelas_id: v})}><SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Pilih kelas" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada kelas</SelectItem>{kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label>Password Baru (Opsional)</Label><Input type="password" placeholder="Kosongkan jika tidak ingin mengubah" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="rounded-xl mt-1" /></div>
            <div className="flex items-center space-x-2"><Checkbox id="aktif" checked={editForm.aktif} onCheckedChange={(checked) => setEditForm({...editForm, aktif: checked === true})} /><Label htmlFor="aktif">Aktif (centang agar pengguna dapat login)</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button><Button onClick={handleUpdateUser} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG KONFIRMASI AKTIFKAN / NONAKTIFKAN PENGGUNA */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>{isActivatingMode ? <UserPlus className="h-5 w-5 inline mr-2 text-green-600" /> : <UserMinus className="h-5 w-5 inline mr-2 text-red-600" />}{isActivatingMode ? "Aktifkan Pengguna" : "Nonaktifkan Pengguna"}</DialogTitle><DialogDescription>{isActivatingMode ? `Aktifkan kembali pengguna ${deactivatingUser?.nama}?` : `Yakin ingin menonaktifkan ${deactivatingUser?.nama}?`}</DialogDescription></DialogHeader>
          {!isActivatingMode && deactivateConstraints.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="font-medium text-amber-800 text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Informasi - Data Terkait</p><ul className="list-disc list-inside text-xs text-amber-700 mt-2">{deactivateConstraints.map((c,i)=><li key={i}>{c}</li>)}</ul><p className="text-xs text-amber-600 mt-2">User akan dinonaktifkan, namun data terkait tetap tersimpan.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>Batal</Button><Button variant={isActivatingMode ? "default" : "destructive"} onClick={executeToggleActive} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isActivatingMode ? "Ya, Aktifkan" : "Nonaktifkan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG KONFIRMASI AKTIFKAN / NONAKTIFKAN KELAS */}
      <Dialog open={toggleKelasDialogOpen} onOpenChange={setToggleKelasDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {isActivatingKelasMode ? <UserPlus className="h-5 w-5 text-green-600" /> : <UserMinus className="h-5 w-5 text-red-600" />}
              {isActivatingKelasMode ? "Aktifkan Kelas" : "Nonaktifkan Kelas"}
            </DialogTitle>
            <DialogDescription>
              {isActivatingKelasMode 
                ? `Aktifkan kembali kelas ${togglingKelas?.nama}? Kelas yang aktif dapat digunakan untuk siswa.`
                : `Yakin ingin menonaktifkan kelas ${togglingKelas?.nama}? Kelas yang dinonaktifkan tidak dapat dipilih untuk siswa.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleKelasDialogOpen(false)}>Batal</Button>
            <Button variant={isActivatingKelasMode ? "default" : "destructive"} onClick={executeToggleActiveKelas} disabled={isSavingKelas}>
              {isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isActivatingKelasMode ? "Ya, Aktifkan" : "Nonaktifkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG BULK ACTION */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>{bulkActionType === "activate" ? "Aktifkan Massal" : "Nonaktifkan Massal"}</DialogTitle><DialogDescription>Anda akan {bulkActionType === "activate" ? "mengaktifkan" : "menonaktifkan"} {bulkActionData?.users.length} pengguna.</DialogDescription></DialogHeader>
          {bulkActionData && bulkActionData.cannotProcess.length > 0 && bulkActionType === "deactivate" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="font-medium text-amber-800 text-sm">⚠️ Beberapa pengguna memiliki data terkait:</p><ul className="list-disc list-inside text-xs mt-1">{bulkActionData.cannotProcess.map(c=><li key={c.id}>{c.nama}: {c.reasons.join(", ")}</li>)}</ul><p className="text-xs text-amber-600 mt-2">User tersebut tetap dapat dinonaktifkan, data terkait akan tetap tersimpan.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setBulkActionDialogOpen(false)}>Batal</Button><Button variant={bulkActionType === "activate" ? "default" : "destructive"} onClick={executeBulkAction} disabled={isProcessingSelected}>{isProcessingSelected && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ya, {bulkActionType === "activate" ? "Aktifkan" : "Nonaktifkan"} {bulkActionData?.canProcessIds.length} User</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG KELAS (TAMBAH/EDIT) */}
      <Dialog open={kelasDialogOpen} onOpenChange={setKelasDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle><School className="h-5 w-5 inline mr-2 text-blue-600" />{editingKelas ? "Ubah Kelas" : "Tambah Kelas Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama Kelas</Label><Input value={kelasForm.nama} onChange={e => setKelasForm({...kelasForm, nama: e.target.value})} placeholder="Contoh: XII RPL 1" className="rounded-xl mt-1" /></div>
            <div><Label>Wali Kelas</Label><Select value={kelasForm.id_guru} onValueChange={v => setKelasForm({...kelasForm, id_guru: v})}><SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Pilih wali kelas (opsional)" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada wali kelas</SelectItem>{guruOptions.map(guru => <SelectItem key={guru.id_guru} value={guru.id_guru.toString()}>{guru.nama} (NIP: {guru.nip})</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setKelasDialogOpen(false)}>Batal</Button><Button onClick={handleSaveKelas} disabled={isSavingKelas} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}