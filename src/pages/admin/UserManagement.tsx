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
  Trash2,
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
  Filter
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

  // State untuk search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKelasQuery, setSearchKelasQuery] = useState("");
  
  // State untuk filter kelas (BARU)
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [showFilter, setShowFilter] = useState(false);

  // State untuk pagination (BARU)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalData, setTotalData] = useState(0);

  // State untuk import
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // State untuk daftar user
  const [guruList, setGuruList] = useState<GuruData[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaData[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // State untuk daftar kelas
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [isFetchingKelas, setIsFetchingKelas] = useState(false);
  const [guruOptions, setGuruOptions] = useState<GuruSimple[]>([]);

  // State untuk edit dialog (user)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    nama: "",
    email: "",
    gender: "",
    kelas_id: "",
    password: "",
  });

  // State untuk delete dialog (user)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<any>(null);

  // State untuk dialog kelas
  const [kelasDialogOpen, setKelasDialogOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);
  const [kelasForm, setKelasForm] = useState({ nama: "", id_guru: "" });
  const [isSavingKelas, setIsSavingKelas] = useState(false);
  const [deleteKelasDialogOpen, setDeleteKelasDialogOpen] = useState(false);
  const [deletingKelas, setDeletingKelas] = useState<Kelas | null>(null);

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

  // ==================== RESET PAGINATION ====================
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // ==================== FILTER DATA BERDASARKAN SEARCH & KELAS ====================
  const filteredGuruList = guruList.filter(guru => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      guru.nama.toLowerCase().includes(query) ||
      guru.nip.toLowerCase().includes(query) ||
      guru.email.toLowerCase().includes(query) ||
      guru.id_guru.toString().includes(query)
    );
  });

  const filteredSiswaList = siswaList.filter(siswa => {
    // Filter berdasarkan search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        siswa.nama.toLowerCase().includes(query) ||
        siswa.nis.toLowerCase().includes(query) ||
        siswa.email.toLowerCase().includes(query) ||
        siswa.id_siswa.toString().includes(query) ||
        (siswa.nama_kelas && siswa.nama_kelas.toLowerCase().includes(query))
      );
      if (!matchesSearch) return false;
    }
    
    // Filter berdasarkan kelas
    if (filterKelas !== "all") {
      if (filterKelas === "unassigned") {
        return siswa.id_kelas === null;
      }
      return siswa.id_kelas?.toString() === filterKelas;
    }
    
    return true;
  });

  // Pagination untuk filtered data
  const getPaginatedData = (data: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const paginatedGuruList = getPaginatedData(filteredGuruList);
  const paginatedSiswaList = getPaginatedData(filteredSiswaList);
  const totalFilteredData = userType === "guru" ? filteredGuruList.length : filteredSiswaList.length;
  const totalPages = Math.ceil(totalFilteredData / itemsPerPage);

  const filteredKelasList = kelasList.filter(kelas => {
    if (!searchKelasQuery) return true;
    const query = searchKelasQuery.toLowerCase();
    return (
      kelas.nama.toLowerCase().includes(query) ||
      (kelas.guru_nama && kelas.guru_nama.toLowerCase().includes(query)) ||
      kelas.id_kelas.toString().includes(query)
    );
  });

  // ==================== FETCH GURU UNTUK WALI KELAS ====================
  const fetchGuruOptions = async () => {
    try {
      const { data, error } = await supabase
        .from("guru")
        .select("id_guru, nama, nip")
        .eq("aktif", true)
        .order("nama");
      if (error) throw error;
      const formatted = data.map((g: any) => ({
        ...g,
        nip: g.nip?.toString() || "",
      }));
      setGuruOptions(formatted);
    } catch (error: any) {
      console.error("Fetch guru options error:", error);
    }
  };

  // ==================== FETCH KELAS ====================
  const fetchKelas = async () => {
    setIsFetchingKelas(true);
    try {
      const { data, error } = await supabase
        .from("kelas")
        .select(`
          *,
          guru:guru (nama)
        `)
        .order("nama");
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
    } catch (error: any) {
      console.error("Fetch kelas error:", error);
      toast({
        title: "Error",
        description: "Gagal mengambil data kelas",
        variant: "destructive",
      });
    } finally {
      setIsFetchingKelas(false);
    }
  };

  // ==================== CRUD KELAS ====================
  const handleAddKelas = () => {
    setEditingKelas(null);
    setKelasForm({ nama: "", id_guru: "" });
    setKelasDialogOpen(true);
  };

  const handleEditKelas = (kelas: Kelas) => {
    setEditingKelas(kelas);
    setKelasForm({
      nama: kelas.nama,
      id_guru: kelas.id_guru?.toString() || "",
    });
    setKelasDialogOpen(true);
  };

  const handleSaveKelas = async () => {
    if (!kelasForm.nama.trim()) {
      toast({ title: "Error", description: "Nama kelas tidak boleh kosong", variant: "destructive" });
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
        toast({ title: "Berhasil", description: "Kelas berhasil diupdate" });
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
      console.error("Save kelas error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
    }
  };

  const confirmDeleteKelas = (kelas: Kelas) => {
    setDeletingKelas(kelas);
    setDeleteKelasDialogOpen(true);
  };

  const handleDeleteKelas = async () => {
    if (!deletingKelas) return;
    setIsSavingKelas(true);
    try {
      const { data: siswaCount, error: countError } = await supabase
        .from("siswa")
        .select("id_siswa", { count: "exact", head: true })
        .eq("id_kelas", deletingKelas.id_kelas);
      if (countError) throw countError;
      if (siswaCount && siswaCount.length > 0) {
        toast({
          title: "Tidak bisa menghapus",
          description: `Masih ada ${siswaCount.length} siswa yang terdaftar di kelas ini. Pindahkan atau hapus siswa terlebih dahulu.`,
          variant: "destructive",
        });
        setDeleteKelasDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from("kelas")
        .delete()
        .eq("id_kelas", deletingKelas.id_kelas);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Kelas berhasil dihapus" });
      setDeleteKelasDialogOpen(false);
      fetchKelas();
    } catch (error: any) {
      console.error("Delete kelas error:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
    }
  };

  // ==================== FETCH USERS WITH PAGINATION ====================
  const fetchGuru = async () => {
    setIsFetching(true);
    try {
      // Hitung total data terlebih dahulu
      const { count: totalCount, error: countError } = await supabase
        .from("guru")
        .select("*", { count: "exact", head: true });
      
      if (countError) throw countError;
      setTotalData(totalCount || 0);

      // Ambil data dengan limit dan offset
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: guruData, error: guruError } = await supabase
        .from("guru")
        .select("id_guru, nama, nip, gender, aktif")
        .order("id_guru")
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
      toast({ title: "Error", description: "Gagal mengambil data guru", variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  };

  const fetchSiswa = async () => {
    setIsFetching(true);
    try {
      // Hitung total data terlebih dahulu
      let query = supabase.from("siswa").select("*", { count: "exact", head: true });
      
      // Jika ada filter kelas, terapkan ke count juga
      if (filterKelas !== "all") {
        if (filterKelas === "unassigned") {
          query = query.is("id_kelas", null);
        } else {
          query = query.eq("id_kelas", parseInt(filterKelas));
        }
      }
      
      const { count: totalCount, error: countError } = await query;
      
      if (countError) throw countError;
      setTotalData(totalCount || 0);

      // Ambil data dengan limit dan offset
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      let siswaQuery = supabase
        .from("siswa")
        .select("id_siswa, nama, nis, gender, aktif, id_kelas")
        .order("id_siswa")
        .range(from, to);
      
      // Terapkan filter kelas
      if (filterKelas !== "all") {
        if (filterKelas === "unassigned") {
          siswaQuery = siswaQuery.is("id_kelas", null);
        } else {
          siswaQuery = siswaQuery.eq("id_kelas", parseInt(filterKelas));
        }
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
          kelasData?.forEach(k => kelasMap.set(k.id_kelas, k.nama));
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
      toast({ title: "Error", description: "Gagal mengambil data siswa", variant: "destructive" });
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
      resetPagination();
      if (userType === "guru") {
        fetchGuru();
      } else {
        fetchSiswa();
      }
    } else if (activeTab === "kelas") {
      fetchKelas();
    }
  }, [activeTab, userType, currentPage, itemsPerPage, filterKelas]);

  // Reset page when search changes
  useEffect(() => {
    resetPagination();
  }, [searchQuery, filterKelas]);

  // ==================== RESET FILTER ====================
  const resetFilters = () => {
    setSearchQuery("");
    setFilterKelas("all");
    resetPagination();
  };

  // ==================== PAGINATION HANDLERS ====================
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
      toast({ title: "Berhasil", description: `${jsonData.length} data siap diimport` });
    } catch (error: any) {
      setUploadError(error.message);
      setPreviewData([]);
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
    const { existingEmails, existingNipNis } = await checkExistingData("guru", data);
    const filteredData = data.filter(item => 
      !existingEmails.includes(item.email) && 
      !existingNipNis.includes(item.nip)
    );
    const skippedCount = data.length - filteredData.length;
    if (!filteredData.length) throw new Error(`Semua data sudah ada (${skippedCount} duplikat)`);
    
    const nextId = await getNextId("guru");
    const guruRecords = filteredData.map((item, idx) => ({
      id_guru: nextId + idx,
      nama: item.nama,
      nip: parseInt(item.nip),
      gender: item.gender.toUpperCase(),
      aktif: true,
      dibuat_pada: new Date().toISOString(),
    }));
    
    const { error: guruError } = await supabase.from("guru").insert(guruRecords);
    if (guruError) throw guruError;
    
    const akunRecords = await Promise.all(filteredData.map(async (item, idx) => {
      const plainPassword = item.password || "password123";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      return {
        nama: item.nama,
        email: item.email,
        peran: "guru",
        aktif: true,
        dibuat_pada: new Date().toISOString(),
        id_guru: nextId + idx,
        id_siswa: null,
        kata_sandi: hashedPassword,
      };
    }));
    
    const { error: akunError } = await supabase.from("akun").insert(akunRecords);
    if (akunError) throw akunError;
    
    return { success: filteredData.length, skipped: skippedCount };
  };

  const importSiswa = async (data: SiswaImportData[]) => {
    const kelasNames = [...new Set(data.map(item => item.kelas).filter(Boolean))];
    const kelasMap = new Map<string, number>();
    for (const nama of kelasNames) {
      const id = await getKelasIdFromName(nama);
      if (!id) throw new Error(`Kelas "${nama}" tidak ditemukan. Silakan tambah kelas ter dahulu.`);
      kelasMap.set(nama, id);
    }
    
    const { existingEmails, existingNipNis } = await checkExistingData("siswa", data);
    const filteredData = data.filter(item => 
      !existingEmails.includes(item.email) && 
      !existingNipNis.includes(item.nis)
    );
    const skippedCount = data.length - filteredData.length;
    if (!filteredData.length) throw new Error(`Semua data sudah ada (${skippedCount} duplikat)`);
    
    const nextId = await getNextId("siswa");
    const siswaRecords = filteredData.map((item, idx) => ({
      id_siswa: nextId + idx,
      nama: item.nama,
      nis: parseInt(item.nis),
      gender: item.gender.toUpperCase(),
      aktif: true,
      dibuat_pada: new Date().toISOString(),
      id_kelas: kelasMap.get(item.kelas) || null,
    }));
    
    const { error: siswaError } = await supabase.from("siswa").insert(siswaRecords);
    if (siswaError) throw siswaError;
    
    const akunRecords = await Promise.all(filteredData.map(async (item, idx) => {
      const plainPassword = item.password || "password123";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      return {
        nama: item.nama,
        email: item.email,
        peran: "siswa",
        aktif: true,
        dibuat_pada: new Date().toISOString(),
        id_guru: null,
        id_siswa: nextId + idx,
        kata_sandi: hashedPassword,
      };
    }));
    
    const { error: akunError } = await supabase.from("akun").insert(akunRecords);
    if (akunError) throw akunError;
    
    return { success: filteredData.length, skipped: skippedCount };
  };

  const handleImport = async () => {
    if (!previewData.length) {
      toast({ title: "Error", description: "Tidak ada data untuk diimport", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      let result;
      if (userType === "guru") {
        result = await importGuru(previewData as GuruImportData[]);
      } else {
        result = await importSiswa(previewData as SiswaImportData[]);
      }
      toast({ 
        title: "Import Berhasil", 
        description: `${result.success} data berhasil diimport${result.skipped ? `, ${result.skipped} duplikat dilewati` : ""}` 
      });
      setPreviewData([]);
      if (activeTab === "list") {
        resetPagination();
        if (userType === "guru") fetchGuru();
        else fetchSiswa();
      }
    } catch (error: any) {
      toast({ title: "Import Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== UPDATE & DELETE USER ====================
  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setEditForm({
      nama: user.nama,
      email: user.email,
      gender: user.gender,
      kelas_id: user.id_kelas?.toString() || "",
      password: "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      const isGuru = userType === "guru";
      const userId = isGuru ? editingUser.id_guru : editingUser.id_siswa;
      const tableName = isGuru ? "guru" : "siswa";
      const idField = isGuru ? "id_guru" : "id_siswa";
      
      const updateData: any = { 
        nama: editForm.nama, 
        gender: editForm.gender.toUpperCase() 
      };
      if (!isGuru && editForm.kelas_id) {
        updateData.id_kelas = parseInt(editForm.kelas_id);
      }
      
      const { error: updateError } = await supabase
        .from(tableName as any)
        .update(updateData)
        .eq(idField, userId as any);
      if (updateError) throw updateError;
      
      const akunUpdate: any = { 
        nama: editForm.nama, 
        email: editForm.email 
      };
      if (editForm.password.trim()) {
        akunUpdate.kata_sandi = await bcrypt.hash(editForm.password, 10);
      }
      
      const { error: akunError } = await supabase
        .from("akun")
        .update(akunUpdate)
        .eq(isGuru ? "id_guru" : "id_siswa", userId as any);
      if (akunError) throw akunError;
      
      toast({ title: "Berhasil", description: "Data user berhasil diupdate" });
      setEditDialogOpen(false);
      resetPagination();
      if (isGuru) fetchGuru(); else fetchSiswa();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (user: any) => {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsLoading(true);
    try {
      const isGuru = userType === "guru";
      const userId = isGuru ? deletingUser.id_guru : deletingUser.id_siswa;
      const tableName = isGuru ? "guru" : "siswa";
      const idField = isGuru ? "id_guru" : "id_siswa";
      
      const { error: akunError } = await supabase
        .from("akun")
        .delete()
        .eq(isGuru ? "id_guru" : "id_siswa", userId as any);
      if (akunError) throw akunError;
      
      const { error: deleteError } = await supabase
        .from(tableName as any)
        .delete()
        .eq(idField, userId as any);
      if (deleteError) throw deleteError;
      
      toast({ title: "Berhasil", description: "User berhasil dihapus" });
      setDeleteDialogOpen(false);
      resetPagination();
      if (isGuru) fetchGuru(); else fetchSiswa();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Hitung statistik
  const totalGuru = guruList.length;
  const totalSiswa = siswaList.length;
  const totalKelas = kelasList.length;
  
  // Hitung jumlah siswa per kelas untuk ditampilkan di filter
  const getSiswaCountByKelas = (kelasId: number) => {
    return siswaList.filter(s => s.id_kelas === kelasId).length;
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Manajemen Data User & Kelas</h1>
                <p className="text-blue-100 text-sm">
                  Import, edit, hapus data guru/siswa, serta kelola data kelas dengan wali kelas
                </p>
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
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Guru</p>
                  <p className="text-2xl font-bold text-blue-900">{totalGuru}</p>
                </div>
                <User className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Total Siswa</p>
                  <p className="text-2xl font-bold text-emerald-900">{totalSiswa}</p>
                </div>
                <GraduationCap className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Total Kelas</p>
                  <p className="text-2xl font-bold text-purple-900">{totalKelas}</p>
                </div>
                <School className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Total Akun</p>
                  <p className="text-2xl font-bold text-amber-900">{totalGuru + totalSiswa}</p>
                </div>
                <UserCheck className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN TABS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Manajemen User & Kelas</CardTitle>
                <CardDescription className="text-slate-300 text-sm">
                  Kelola data guru, siswa, dan kelas dengan mudah
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
              {/* TABS LIST */}
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="import" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <Upload className="h-3.5 w-3.5" />
                    Import Data
                  </TabsTrigger>
                  <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <Users className="h-3.5 w-3.5" />
                    Daftar User
                  </TabsTrigger>
                  <TabsTrigger value="kelas" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <School className="h-3.5 w-3.5" />
                    Kelola Kelas
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB IMPORT */}
              <TabsContent value="import" className="space-y-6">
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
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download Template
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
                      {isLoading ? "Memproses..." : "Upload File"}
                    </Button>
                  </div>
                </div>
                
                {uploadError && (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}
                
                {previewData.length > 0 && (
                  <>
                    <Alert className="rounded-xl bg-emerald-50 border-emerald-200 max-w-md mx-auto">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-700">{previewData.length} data siap diimport</AlertDescription>
                    </Alert>
                    <div className="border rounded-xl overflow-auto max-h-96 shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold">Nama</TableHead>
                            <TableHead className="font-semibold">{userType === "guru" ? "NIP" : "NIS"}</TableHead>
                            <TableHead className="font-semibold">Email</TableHead>
                            <TableHead className="font-semibold">Gender</TableHead>
                            {userType === "siswa" && <TableHead className="font-semibold">Kelas</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.slice(0, 10).map((item: any, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50 transition-colors">
                              <TableCell>{item.nama}</TableCell>
                              <TableCell className="font-mono text-sm">{userType === "guru" ? item.nip : item.nis}</TableCell>
                              <TableCell>{item.email}</TableCell>
                              <TableCell>
                                <Badge className={item.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"} rounded-full>
                                  {item.gender === "L" ? "Laki-laki" : "Perempuan"}
                                </Badge>
                              </TableCell>
                              {userType === "siswa" && <TableCell>{item.kelas}</TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-center">
                      <Button onClick={handleImport} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Import Data
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* TAB DAFTAR USER - DENGAN PAGINATION */}
              <TabsContent value="list" className="space-y-6">
                <div className="flex flex-col gap-4">
                  {/* Baris pertama: Pilih tipe user dan tombol refresh */}
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <Select value={userType} onValueChange={(v) => {
                      setUserType(v as "guru" | "siswa");
                      resetFilters();
                    }}>
                      <SelectTrigger className="w-[180px] rounded-xl border-slate-200 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="siswa">Siswa</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        resetPagination();
                        userType === "guru" ? fetchGuru() : fetchSiswa();
                      }} 
                      disabled={isFetching}
                      className="rounded-xl h-9 text-sm"
                    >
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> 
                      Refresh
                    </Button>
                  </div>
                  
                  {/* Baris kedua: Search bar dan filter kelas (khusus siswa) */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* SEARCH BAR */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder={`Cari ${userType === "guru" ? "guru" : "siswa"} (nama, NIP/NIS, email, ID)...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10 rounded-xl border-slate-200 h-9 text-sm"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                          <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                        </button>
                      )}
                    </div>
                    
                    {/* FILTER KELAS - KHUSUS UNTUK SISWA */}
                    {userType === "siswa" && (
                      <div className="relative">
                        <Button
                          variant="outline"
                          onClick={() => setShowFilter(!showFilter)}
                          className={`rounded-xl h-9 text-sm gap-2 ${filterKelas !== "all" ? "bg-blue-50 border-blue-300 text-blue-700" : ""}`}
                        >
                          <Filter className="h-3.5 w-3.5" />
                          Filter Kelas
                          {filterKelas !== "all" && (
                            <Badge className="bg-blue-500 text-white text-xs ml-1">
                              {filterKelas === "unassigned" ? "Tanpa Kelas" : kelasList.find(k => k.id_kelas.toString() === filterKelas)?.nama || "1"}
                            </Badge>
                          )}
                        </Button>
                        
                        {/* Dropdown filter */}
                        {showFilter && (
                          <div className="absolute top-full mt-2 right-0 z-20 bg-white rounded-xl shadow-xl border p-2 min-w-[220px]">
                            <div className="text-xs font-medium text-slate-500 px-2 py-1 border-b mb-1">Filter berdasarkan kelas</div>
                            <button
                              onClick={() => {
                                setFilterKelas("all");
                                setShowFilter(false);
                                resetPagination();
                              }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center ${filterKelas === "all" ? "bg-blue-50 text-blue-700" : ""}`}
                            >
                              <span>Semua Kelas</span>
                              <Badge className="bg-slate-100 text-slate-600">{siswaList.length}</Badge>
                            </button>
                            <button
                              onClick={() => {
                                setFilterKelas("unassigned");
                                setShowFilter(false);
                                resetPagination();
                              }}
                              className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center ${filterKelas === "unassigned" ? "bg-blue-50 text-blue-700" : ""}`}
                            >
                              <span className="text-amber-600">⚠️ Tanpa Kelas</span>
                              <Badge className="bg-amber-100 text-amber-600">{siswaList.filter(s => s.id_kelas === null).length}</Badge>
                            </button>
                            <div className="border-t my-1"></div>
                            {kelasList.map(kelas => (
                              <button
                                key={kelas.id_kelas}
                                onClick={() => {
                                  setFilterKelas(kelas.id_kelas.toString());
                                  setShowFilter(false);
                                  resetPagination();
                                }}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center ${filterKelas === kelas.id_kelas.toString() ? "bg-blue-50 text-blue-700" : ""}`}
                              >
                                <span>{kelas.nama}</span>
                                <Badge className="bg-slate-100 text-slate-600">{getSiswaCountByKelas(kelas.id_kelas)}</Badge>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Hasil pencarian & filter info */}
                {(searchQuery || filterKelas !== "all") && (
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                    <div className="text-sm text-slate-500">
                      Menampilkan {totalFilteredData} dari {userType === "guru" ? guruList.length : siswaList.length} data
                      {filterKelas !== "all" && filterKelas !== "unassigned" && (
                        <span className="ml-2 text-blue-600">
                          (Kelas: {kelasList.find(k => k.id_kelas.toString() === filterKelas)?.nama})
                        </span>
                      )}
                      {filterKelas === "unassigned" && (
                        <span className="ml-2 text-amber-600">(Tanpa Kelas)</span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
                      <X className="h-3 w-3 mr-1" /> Reset Filter
                    </Button>
                  </div>
                )}
                
                {isFetching ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="font-semibold">ID</TableHead>
                              <TableHead className="font-semibold">Nama</TableHead>
                              <TableHead className="font-semibold">{userType === "guru" ? "NIP" : "NIS"}</TableHead>
                              <TableHead className="font-semibold">Email</TableHead>
                              <TableHead className="font-semibold">Gender</TableHead>
                              {userType === "siswa" && <TableHead className="font-semibold">Kelas</TableHead>}
                              <TableHead className="font-semibold text-center">Status</TableHead>
                              <TableHead className="font-semibold text-center">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userType === "guru" ? (
                              paginatedGuruList.map(guru => (
                                <TableRow key={guru.id_guru} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="font-mono text-sm">{guru.id_guru}</TableCell>
                                  <TableCell className="font-medium">{guru.nama}</TableCell>
                                  <TableCell className="font-mono text-sm">{guru.nip}</TableCell>
                                  <TableCell>{guru.email}</TableCell>
                                  <TableCell>
                                    <Badge className={guru.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"} rounded-full>
                                      {guru.gender === "L" ? "Laki-laki" : "Perempuan"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={guru.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} rounded-full>
                                      {guru.aktif ? "Aktif" : "Nonaktif"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex gap-1 justify-center">
                                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(guru)} className="h-8 w-8 p-0 rounded-lg">
                                        <Edit className="h-4 w-4 text-blue-500" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => confirmDelete(guru)} className="h-8 w-8 p-0 rounded-lg">
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              paginatedSiswaList.map(siswa => (
                                <TableRow key={siswa.id_siswa} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="font-mono text-sm">{siswa.id_siswa}</TableCell>
                                  <TableCell className="font-medium">{siswa.nama}</TableCell>
                                  <TableCell className="font-mono text-sm">{siswa.nis}</TableCell>
                                  <TableCell>{siswa.email}</TableCell>
                                  <TableCell>
                                    <Badge className={siswa.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"} rounded-full>
                                      {siswa.gender === "L" ? "Laki-laki" : "Perempuan"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {siswa.nama_kelas ? (
                                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                        {siswa.nama_kelas}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                                        Belum punya kelas
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={siswa.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} rounded-full>
                                      {siswa.aktif ? "Aktif" : "Nonaktif"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex gap-1 justify-center">
                                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(siswa)} className="h-8 w-8 p-0 rounded-lg">
                                        <Edit className="h-4 w-4 text-blue-500" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => confirmDelete(siswa)} className="h-8 w-8 p-0 rounded-lg">
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                            {((userType === "guru" && !paginatedGuruList.length) || (userType === "siswa" && !paginatedSiswaList.length)) && (
                              <TableRow>
                                <TableCell colSpan={userType === "guru" ? 7 : 8} className="text-center py-8 text-slate-500">
                                  {searchQuery || filterKelas !== "all" ? (
                                    <>
                                      <Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                      Tidak ada data yang cocok dengan kriteria pencarian
                                    </>
                                  ) : (
                                    <>
                                      <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                      Tidak ada data
                                    </>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    
                    {/* PAGINATION CONTROLS */}
                    {totalFilteredData > 0 && (
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">Tampilkan</span>
                          <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                            <SelectTrigger className="w-[70px] h-8 text-sm rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg">
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-slate-500">per halaman</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToFirstPage}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0 rounded-lg"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPreviousPage}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0 rounded-lg"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          
                          <div className="flex items-center gap-1 px-2">
                            <span className="text-sm font-medium">{currentPage}</span>
                            <span className="text-sm text-slate-400">/</span>
                            <span className="text-sm text-slate-500">{totalPages || 1}</span>
                          </div>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 w-8 p-0 rounded-lg"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToLastPage}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 w-8 p-0 rounded-lg"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="text-sm text-slate-500">
                          Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalFilteredData)} dari {totalFilteredData} data
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* TAB KELOLA KELAS */}
              <TabsContent value="kelas" className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <Button onClick={handleAddKelas} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Kelas
                  </Button>
                  
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Cari kelas (nama kelas, wali kelas, ID)..."
                      value={searchKelasQuery}
                      onChange={(e) => setSearchKelasQuery(e.target.value)}
                      className="pl-10 pr-10 rounded-xl border-slate-200 h-9 text-sm"
                    />
                    {searchKelasQuery && (
                      <button
                        onClick={() => setSearchKelasQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      >
                        <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                  
                  <Button variant="outline" onClick={fetchKelas} disabled={isFetchingKelas} className="rounded-xl h-9 text-sm">
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingKelas ? "animate-spin" : ""}`} /> 
                    Refresh
                  </Button>
                </div>
                
                {searchKelasQuery && (
                  <div className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg">
                    Menampilkan {filteredKelasList.length} dari {kelasList.length} kelas
                  </div>
                )}
                
                {isFetchingKelas ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold">ID</TableHead>
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
                              <TableCell className="font-mono text-sm">{kelas.id_kelas}</TableCell>
                              <TableCell className="font-medium">{kelas.nama}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="bg-purple-100 p-1.5 rounded-lg">
                                    <User className="h-3 w-3 text-purple-600" />
                                  </div>
                                  {kelas.guru_nama || "-"}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={kelas.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} rounded-full>
                                  {kelas.aktif ? "Aktif" : "Nonaktif"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 text-sm">{new Date(kelas.dibuat_pada).toLocaleDateString()}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditKelas(kelas)} className="h-8 w-8 p-0 rounded-lg">
                                    <Edit className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => confirmDeleteKelas(kelas)} className="h-8 w-8 p-0 rounded-lg">
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!filteredKelasList.length && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                {searchKelasQuery ? (
                                  <>
                                    <Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                    Tidak ada kelas yang cocok dengan "{searchKelasQuery}"
                                  </>
                                ) : (
                                  <>
                                    <School className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                    Belum ada data kelas
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
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
              <div className="bg-indigo-100 p-3 rounded-xl flex-shrink-0">
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Tips Mengelola Data</h3>
                <p className="text-sm text-slate-600">
                  Gunakan fitur import Excel untuk menambahkan banyak data sekaligus. Pastikan format file sesuai 
                  dengan template yang disediakan. Data duplikat akan otomatis dilewati saat import. Gunakan fitur 
                  pencarian dan filter kelas untuk menemukan data siswa dengan cepat. Data ditampilkan dengan sistem 
                  pagination untuk performa yang lebih baik.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Manajemen User & Kelas - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Sistem Informasi Akademik
          </p>
        </div>
      </div>

      {/* Dialog Edit User */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Ubah informasi user. Kosongkan password jika tidak ingin mengubah.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-700">Nama</Label>
              <Input 
                value={editForm.nama} 
                onChange={e => setEditForm({...editForm, nama: e.target.value})} 
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-700">Email</Label>
              <Input 
                type="email" 
                value={editForm.email} 
                onChange={e => setEditForm({...editForm, email: e.target.value})} 
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-700">Gender</Label>
              <Select 
                value={editForm.gender} 
                onValueChange={v => setEditForm({...editForm, gender: v})}
              >
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userType === "siswa" && (
              <div>
                <Label className="text-slate-700">Kelas</Label>
                <Select 
                  value={editForm.kelas_id} 
                  onValueChange={v => setEditForm({...editForm, kelas_id: v})}
                >
                  <SelectTrigger className="rounded-xl mt-1">
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="">Tidak ada kelas</SelectItem>
                    {kelasList.map(k => (
                      <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>
                        {k.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-slate-700">Password Baru (Opsional)</Label>
              <Input 
                type="password" 
                placeholder="Kosongkan jika tidak ingin mengubah" 
                value={editForm.password} 
                onChange={e => setEditForm({...editForm, password: e.target.value})} 
                className="rounded-xl mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleUpdateUser} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete User */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Hapus User
            </DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus <strong>{deletingUser?.nama}</strong>? Tindakan tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isLoading} className="rounded-xl">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kelas (Add/Edit) */}
      <Dialog open={kelasDialogOpen} onOpenChange={setKelasDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <School className="h-5 w-5 text-blue-600" />
              {editingKelas ? "Edit Kelas" : "Tambah Kelas Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-700">Nama Kelas</Label>
              <Input 
                value={kelasForm.nama} 
                onChange={e => setKelasForm({ ...kelasForm, nama: e.target.value })} 
                placeholder="Contoh: XII RPL 1" 
                className="rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-700">Wali Kelas</Label>
              <Select 
                value={kelasForm.id_guru} 
                onValueChange={v => setKelasForm({ ...kelasForm, id_guru: v })}
              >
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue placeholder="Pilih wali kelas (opsional)" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="">Tidak ada wali kelas</SelectItem>
                  {guruOptions.map(guru => (
                    <SelectItem key={guru.id_guru} value={guru.id_guru.toString()}>
                      {guru.nama} (NIP: {guru.nip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKelasDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleSaveKelas} disabled={isSavingKelas} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
              {isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Kelas */}
      <Dialog open={deleteKelasDialogOpen} onOpenChange={setDeleteKelasDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Hapus Kelas
            </DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus kelas <strong>{deletingKelas?.nama}</strong>? 
              Siswa yang memiliki kelas ini akan kehilangan referensi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKelasDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button variant="destructive" onClick={handleDeleteKelas} disabled={isSavingKelas} className="rounded-xl">
              {isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}