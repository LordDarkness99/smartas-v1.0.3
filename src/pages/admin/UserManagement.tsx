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

  // Dialog untuk konfirmasi aktif/nonaktif single (user)
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [actionType, setActionType] = useState<"activate" | "deactivate">("deactivate");
  const [actionConstraints, setActionConstraints] = useState<string[]>([]);

  // State untuk kelas (soft delete)
  const [kelasDialogOpen, setKelasDialogOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);
  const [kelasForm, setKelasForm] = useState({
    nama: "",
    id_guru: "",
    aktif: true,
  });
  const [isSavingKelas, setIsSavingKelas] = useState(false);

  // Dialog konfirmasi untuk nonaktifkan/aktifkan kelas
  const [kelasActionDialogOpen, setKelasActionDialogOpen] = useState(false);
  const [targetKelas, setTargetKelas] = useState<Kelas | null>(null);
  const [kelasActionType, setKelasActionType] = useState<"activate" | "deactivate">("deactivate");

  // ========= SELECT & BULK ACTION (USER) =========
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"activate" | "deactivate">("deactivate");
  const [bulkData, setBulkData] = useState<{
    users: { id: number; nama: string; aktif: boolean }[];
    cannotProcess: { id: number; nama: string; reasons: string[] }[];
    canProcessIds: number[];
  } | null>(null);

  // ==================== GREETING ====================
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

  const resetPagination = () => setCurrentPage(1);

  useEffect(() => {
    if (!selectMode) setSelectedIds([]);
  }, [selectMode]);

  useEffect(() => {
    if (selectMode) setSelectedIds([]);
  }, [currentPage, filterKelas, searchQuery, userType]);

  // ==================== FILTER CLIENT-SIDE ====================
  const filteredGuruList = guruList.filter((guru) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      guru.nama.toLowerCase().includes(q) ||
      guru.nip.toLowerCase().includes(q) ||
      guru.email.toLowerCase().includes(q) ||
      guru.id_guru.toString().includes(q)
    );
  });

  const filteredSiswaList = siswaList.filter((siswa) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      siswa.nama.toLowerCase().includes(q) ||
      siswa.nis.toLowerCase().includes(q) ||
      siswa.email.toLowerCase().includes(q) ||
      siswa.id_siswa.toString().includes(q) ||
      (siswa.nama_kelas && siswa.nama_kelas.toLowerCase().includes(q))
    );
  });

  // Urutkan: aktif di atas, nonaktif di bawah
  const displayedGuruList = [...filteredGuruList].sort((a, b) => {
    if (a.aktif === b.aktif) return a.id_guru - b.id_guru;
    return a.aktif ? -1 : 1;
  });
  const displayedSiswaList = [...filteredSiswaList].sort((a, b) => {
    if (a.aktif === b.aktif) return a.id_siswa - b.id_siswa;
    return a.aktif ? -1 : 1;
  });

  const totalPages = Math.ceil(totalData / itemsPerPage);

  // Filter dan sorting untuk kelas (aktif di atas)
  const filteredKelasList = kelasList.filter((kelas) => {
    if (!searchKelasQuery) return true;
    const q = searchKelasQuery.toLowerCase();
    return (
      kelas.nama.toLowerCase().includes(q) ||
      (kelas.guru_nama && kelas.guru_nama.toLowerCase().includes(q)) ||
      kelas.id_kelas.toString().includes(q)
    );
  }).sort((a, b) => {
    if (a.aktif === b.aktif) return a.id_kelas - b.id_kelas;
    return a.aktif ? -1 : 1;
  });

  // ==================== FETCH GURU & KELAS ====================
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
    } catch (error) {
      console.error(error);
    }
  };

  const fetchKelas = async () => {
    setIsFetchingKelas(true);
    try {
      // Ambil semua kelas (tanpa filter aktif)
      const { data, error } = await supabase
        .from("kelas")
        .select(`*, guru:guru (nama)`)
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengambil data kelas",
        variant: "destructive",
      });
    } finally {
      setIsFetchingKelas(false);
    }
  };

  // ==================== CRUD KELAS (SOFT DELETE) ====================
  const handleAddKelas = () => {
    setEditingKelas(null);
    setKelasForm({ nama: "", id_guru: "", aktif: true });
    setKelasDialogOpen(true);
  };

  const handleEditKelas = (kelas: Kelas) => {
    setEditingKelas(kelas);
    setKelasForm({
      nama: kelas.nama,
      id_guru: kelas.id_guru?.toString() || "",
      aktif: kelas.aktif,
    });
    setKelasDialogOpen(true);
  };

  const handleSaveKelas = async () => {
    if (!kelasForm.nama.trim()) {
      toast({
        title: "Error",
        description: "Nama kelas tidak boleh kosong",
        variant: "destructive",
      });
      return;
    }
    setIsSavingKelas(true);
    try {
      const data: any = {
        nama: kelasForm.nama.trim(),
        id_guru: kelasForm.id_guru ? parseInt(kelasForm.id_guru) : null,
        aktif: kelasForm.aktif,
      };
      if (editingKelas) {
        const { error } = await supabase
          .from("kelas")
          .update(data)
          .eq("id_kelas", editingKelas.id_kelas);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Kelas berhasil diupdate" });
      } else {
        const { error } = await supabase.from("kelas").insert({
          ...data,
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

  const confirmDeactivateKelas = (kelas: Kelas) => {
    setTargetKelas(kelas);
    setKelasActionType("deactivate");
    setKelasActionDialogOpen(true);
  };

  const confirmActivateKelas = (kelas: Kelas) => {
    setTargetKelas(kelas);
    setKelasActionType("activate");
    setKelasActionDialogOpen(true);
  };

  const executeKelasAction = async () => {
    if (!targetKelas) return;
    setIsSavingKelas(true);
    setKelasActionDialogOpen(false);
    const newActiveStatus = kelasActionType === "activate";
    try {
      const { error } = await supabase
        .from("kelas")
        .update({ aktif: newActiveStatus })
        .eq("id_kelas", targetKelas.id_kelas);
      if (error) throw error;
      toast({
        title: "Berhasil",
        description: `Kelas ${targetKelas.nama} telah ${newActiveStatus ? "diaktifkan" : "dinonaktifkan"}.`,
      });
      fetchKelas();
    } catch (error: any) {
      console.error("Error update kelas:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
      setTargetKelas(null);
    }
  };

  // ==================== FETCH USERS (SEMUA, URUT AKTIF DESC) ====================
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
        .order("aktif", { ascending: false })
        .order("id_guru", { ascending: true })
        .range(from, to);
      if (guruError) throw guruError;

      const guruIds = guruData?.map((g) => g.id_guru) || [];
      const { data: akunData, error: akunError } = await supabase
        .from("akun")
        .select("id_guru, email")
        .in("id_guru", guruIds);
      if (akunError) throw akunError;

      const emailMap = new Map();
      akunData?.forEach((akun) => emailMap.set(akun.id_guru, akun.email));

      const combined: GuruData[] =
        guruData?.map((guru) => ({
          ...guru,
          email: emailMap.get(guru.id_guru) || "",
          nip: guru.nip?.toString() || "",
        })) || [];
      setGuruList(combined);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Gagal mengambil data guru",
        variant: "destructive",
      });
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
        .order("aktif", { ascending: false })
        .order("id_siswa", { ascending: true })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (filterKelas !== "all") {
        if (filterKelas === "unassigned") siswaQuery = siswaQuery.is("id_kelas", null);
        else siswaQuery = siswaQuery.eq("id_kelas", parseInt(filterKelas));
      }
      const { data: siswaData, error: siswaError } = await siswaQuery;
      if (siswaError) throw siswaError;

      const siswaIds = siswaData?.map((s) => s.id_siswa) || [];
      const { data: akunData, error: akunError } = await supabase
        .from("akun")
        .select("id_siswa, email")
        .in("id_siswa", siswaIds);
      if (akunError) throw akunError;

      const emailMap = new Map();
      akunData?.forEach((akun) => emailMap.set(akun.id_siswa, akun.email));

      const kelasIds = siswaData?.map((s) => s.id_kelas).filter(Boolean) || [];
      let kelasMap = new Map();
      if (kelasIds.length > 0) {
        const { data: kelasData, error: kelasError } = await supabase
          .from("kelas")
          .select("id_kelas, nama")
          .in("id_kelas", kelasIds);
        if (!kelasError && kelasData) {
          kelasData.forEach((k) => kelasMap.set(k.id_kelas, k.nama));
        }
      }

      const combined: SiswaData[] =
        siswaData?.map((siswa) => ({
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
      toast({
        title: "Error",
        description: "Gagal mengambil data siswa",
        variant: "destructive",
      });
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
    resetPagination();
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));
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

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
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
        const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
        if (missingColumns.length)
          throw new Error(`Kolom diperlukan tidak ditemukan: ${missingColumns.join(", ")}`);

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
    },
    [userType, toast]
  );

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
    const emails = data.map((item) => item.email).filter(Boolean);
    const nipNisValues = data.map((item) => (type === "guru" ? item.nip : item.nis)).filter(Boolean);

    const { data: existingAccounts } = await supabase
      .from("akun")
      .select("email")
      .in("email", emails);
    const existingEmails = existingAccounts?.map((acc) => acc.email) || [];

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
    const filteredData = data.filter(
      (item) => !existingEmails.includes(item.email) && !existingNipNis.includes(item.nip)
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

    const akunRecords = await Promise.all(
      filteredData.map(async (item, idx) => {
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
      })
    );

    const { error: akunError } = await supabase.from("akun").insert(akunRecords);
    if (akunError) throw akunError;

    return { success: filteredData.length, skipped: skippedCount };
  };

  const importSiswa = async (data: SiswaImportData[]) => {
    const kelasNames = [...new Set(data.map((item) => item.kelas).filter(Boolean))];
    const kelasMap = new Map<string, number>();
    for (const nama of kelasNames) {
      const id = await getKelasIdFromName(nama);
      if (!id) throw new Error(`Kelas "${nama}" tidak ditemukan. Silakan tambah kelas terlebih dahulu.`);
      kelasMap.set(nama, id);
    }

    const { existingEmails, existingNipNis } = await checkExistingData("siswa", data);
    const filteredData = data.filter(
      (item) => !existingEmails.includes(item.email) && !existingNipNis.includes(item.nis)
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

    const akunRecords = await Promise.all(
      filteredData.map(async (item, idx) => {
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
      })
    );

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
        description: `${result.success} data berhasil diimport${
          result.skipped ? `, ${result.skipped} duplikat dilewati` : ""
        }`,
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

  // ==================== EDIT USER ====================
  const checkDuplicateEmail = async (
    email: string,
    excludeId?: { type: "guru" | "siswa"; id: number }
  ): Promise<boolean> => {
    let query = supabase.from("akun").select("email").eq("email", email);
    if (excludeId) {
      if (excludeId.type === "guru") query = query.not("id_guru", "eq", excludeId.id);
      else query = query.not("id_siswa", "eq", excludeId.id);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0;
  };

  const checkDuplicateNip = async (nip: string, excludeGuruId?: number): Promise<boolean> => {
    const numericNip = parseInt(nip);
    if (isNaN(numericNip)) return false;
    let query = supabase.from("guru").select("nip").eq("nip", numericNip);
    if (excludeGuruId) query = query.not("id_guru", "eq", excludeGuruId);
    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0;
  };

  const checkDuplicateNis = async (nis: string, excludeSiswaId?: number): Promise<boolean> => {
    const numericNis = parseInt(nis);
    if (isNaN(numericNis)) return false;
    let query = supabase.from("siswa").select("nis").eq("nis", numericNis);
    if (excludeSiswaId) query = query.not("id_siswa", "eq", excludeSiswaId);
    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0;
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
        toast({ title: "Error", description: "Email sudah digunakan oleh user lain.", variant: "destructive" });
        return;
      }

      if (isGuru) {
        if (editForm.nip && editForm.nip !== editingUser.nip) {
          const isNipExist = await checkDuplicateNip(editForm.nip, userId);
          if (isNipExist) {
            toast({ title: "Error", description: "NIP sudah digunakan oleh guru lain.", variant: "destructive" });
            return;
          }
        }
      } else {
        if (editForm.nis && editForm.nis !== editingUser.nis) {
          const isNisExist = await checkDuplicateNis(editForm.nis, userId);
          if (isNisExist) {
            toast({ title: "Error", description: "NIS sudah digunakan oleh siswa lain.", variant: "destructive" });
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

      toast({ title: "Berhasil", description: "Data user berhasil diupdate" });
      setEditDialogOpen(false);
      resetPagination();
      if (isGuru) fetchGuru();
      else fetchSiswa();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== CEK DATA TERKAIT UNTUK NONAKTIFKAN USER ====================
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
      const { data: presHarian } = await supabase
        .from("presensi_harian")
        .select("id_presensi_harian")
        .eq("id_siswa", id);
      if (presHarian?.length) related.push(`📅 Memiliki ${presHarian.length} data presensi harian`);
      const { data: presMapel } = await supabase
        .from("presensi_siswa_mapel")
        .select("id_pre_siswa")
        .eq("id_siswa", id);
      if (presMapel?.length) related.push(`📖 Memiliki ${presMapel.length} data presensi mata pelajaran`);
    }
    return related;
  };

  // ==================== AKTIFKAN / NONAKTIFKAN USER SINGLE ====================
  const confirmActivate = (user: any) => {
    setTargetUser(user);
    setActionType("activate");
    setActionConstraints([]);
    setActionDialogOpen(true);
  };

  const confirmDeactivate = async (user: any) => {
    const isGuru = userType === "guru";
    const userId = isGuru ? user.id_guru : user.id_siswa;
    const constraints = await checkUserRelatedData(userType, userId);
    setTargetUser(user);
    setActionType("deactivate");
    setActionConstraints(constraints);
    setActionDialogOpen(true);
  };

  const executeToggleActive = async () => {
    if (!targetUser) return;
    setIsLoading(true);
    setActionDialogOpen(false);
    const isGuru = userType === "guru";
    const userId = isGuru ? targetUser.id_guru : targetUser.id_siswa;
    const tableName = isGuru ? "guru" : "siswa";
    const idField = isGuru ? "id_guru" : "id_siswa";
    const newActiveStatus = actionType === "activate";

    try {
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ aktif: newActiveStatus })
        .eq(idField, userId);
      if (updateError) throw updateError;
      const { error: akunError } = await supabase
        .from("akun")
        .update({ aktif: newActiveStatus })
        .eq(isGuru ? "id_guru" : "id_siswa", userId);
      if (akunError) throw akunError;

      toast({
        title: "Berhasil",
        description: `User ${targetUser.nama} telah ${newActiveStatus ? "diaktifkan" : "dinonaktifkan"}.`,
      });
      resetPagination();
      if (isGuru) fetchGuru();
      else fetchSiswa();
      if (selectMode) {
        setSelectMode(false);
        setSelectedIds([]);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setTargetUser(null);
      setActionConstraints([]);
    }
  };

  // ==================== BULK ACTIONS (USER) ====================
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) setSelectedIds([]);
  };

  const handleSelectAll = () => {
    const currentIds =
      userType === "guru"
        ? displayedGuruList.map((g) => g.id_guru)
        : displayedSiswaList.map((s) => s.id_siswa);
    if (selectedIds.length === currentIds.length && currentIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentIds);
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBulkAction = async (type: "activate" | "deactivate") => {
    if (selectedIds.length === 0) {
      toast({ title: "Tidak ada data dipilih", variant: "destructive" });
      return;
    }

    const isGuru = userType === "guru";
    const usersSelected = selectedIds.map((id) => {
      if (isGuru) {
        const guru = guruList.find((g) => g.id_guru === id);
        return { id, nama: guru?.nama || `ID ${id}`, aktif: guru?.aktif ?? false };
      } else {
        const siswa = siswaList.find((s) => s.id_siswa === id);
        return { id, nama: siswa?.nama || `ID ${id}`, aktif: siswa?.aktif ?? false };
      }
    });

    const cannotProcess: { id: number; nama: string; reasons: string[] }[] = [];
    const canProcessIds: number[] = [];

    if (type === "deactivate") {
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

    setBulkData({
      users: usersSelected,
      cannotProcess,
      canProcessIds,
    });
    setBulkActionType(type);
    setBulkDialogOpen(true);
  };

  const executeBulkAction = async () => {
    if (!bulkData) return;
    const { canProcessIds } = bulkData;
    const isGuru = userType === "guru";
    const tableName = isGuru ? "guru" : "siswa";
    const idField = isGuru ? "id_guru" : "id_siswa";
    const newActiveStatus = bulkActionType === "activate";

    setIsProcessingBulk(true);
    setBulkDialogOpen(false);

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
        description: `${successCount} user berhasil ${bulkActionType === "activate" ? "diaktifkan" : "dinonaktifkan"}${
          failCount > 0 ? `, ${failCount} gagal` : ""
        }`,
      });
      resetPagination();
      if (isGuru) fetchGuru();
      else fetchSiswa();
      setSelectMode(false);
      setSelectedIds([]);
    } else {
      toast({ title: "Gagal", description: "Tidak ada perubahan.", variant: "destructive" });
    }
    setIsProcessingBulk(false);
    setBulkData(null);
  };

  // ==================== STATS ====================
  const totalAllGuru = guruList.length;
  const totalAllSiswa = siswaList.length;
  const totalAllAkun = totalAllGuru + totalAllSiswa;
  const totalAllKelas = kelasList.length;

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
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Manajemen Data User & Kelas</h1>
                <p className="text-blue-100 text-sm">Import, edit, aktifkan/nonaktifkan data guru/siswa, serta kelola kelas (soft delete)</p>
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
                <div><p className="text-xs text-purple-600 font-medium">Total Kelas</p><p className="text-2xl font-bold text-purple-900">{totalAllKelas}</p></div>
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
              <div><CardTitle className="text-xl">Manajemen User & Kelas</CardTitle><CardDescription className="text-slate-300 text-sm">Kelola data guru, siswa, dan kelas dengan soft delete</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="import" className="rounded-lg data-[state=active]:bg-white"><Upload className="h-3.5 w-3.5 mr-1" /> Import Data</TabsTrigger>
                  <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white"><Users className="h-3.5 w-3.5 mr-1" /> Daftar User</TabsTrigger>
                  <TabsTrigger value="kelas" className="rounded-lg data-[state=active]:bg-white"><School className="h-3.5 w-3.5 mr-1" /> Kelola Kelas</TabsTrigger>
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
                                <Badge className={item.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}>
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

              {/* TAB DAFTAR USER */}
              <TabsContent value="list" className="space-y-6">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <Select value={userType} onValueChange={(v) => { setUserType(v as "guru" | "siswa"); resetFilters(); }}>
                      <SelectTrigger className="w-[180px] rounded-xl border-slate-200 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl"><SelectItem value="guru">Guru</SelectItem><SelectItem value="siswa">Siswa</SelectItem></SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => { resetPagination(); userType === "guru" ? fetchGuru() : fetchSiswa(); }} disabled={isFetching} className="rounded-xl h-9 text-sm">
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-end justify-between">
                    <div className="flex-1 flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input type="text" placeholder={`Cari ${userType === "guru" ? "guru" : "siswa"} (nama, NIP/NIS, email, ID)...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-10 rounded-xl border-slate-200 h-9 text-sm" />
                        {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2"><X className="h-4 w-4 text-slate-400" /></button>}
                      </div>
                      {userType === "siswa" && (
                        <div className="relative">
                          <Button variant="outline" onClick={() => setShowFilter(!showFilter)} className={`rounded-xl h-9 text-sm gap-2 ${filterKelas !== "all" ? "bg-blue-50 border-blue-300 text-blue-700" : ""}`}>
                            <Filter className="h-3.5 w-3.5" /> Filter Kelas
                            {filterKelas !== "all" && <Badge className="bg-blue-500 text-white text-xs ml-1">{filterKelas === "unassigned" ? "Tanpa Kelas" : kelasList.find(k => k.id_kelas.toString() === filterKelas)?.nama || "1"}</Badge>}
                          </Button>
                          {showFilter && (
                            <div className="absolute top-full mt-2 right-0 z-20 bg-white rounded-xl shadow-xl border p-2 min-w-[220px]">
                              <div className="text-xs font-medium text-slate-500 px-2 py-1 border-b mb-1">Filter berdasarkan kelas</div>
                              <button onClick={() => { setFilterKelas("all"); setShowFilter(false); resetPagination(); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center ${filterKelas === "all" ? "bg-blue-50 text-blue-700" : ""}`}><span>Semua Kelas</span><Badge className="bg-slate-100 text-slate-600">{totalData}</Badge></button>
                              <button onClick={() => { setFilterKelas("unassigned"); setShowFilter(false); resetPagination(); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center ${filterKelas === "unassigned" ? "bg-blue-50 text-blue-700" : ""}`}><span className="text-amber-600">⚠️ Tanpa Kelas</span><Badge className="bg-amber-100 text-amber-600">-</Badge></button>
                              <div className="border-t my-1"></div>
                              {kelasList.map(kelas => (
                                <button key={kelas.id_kelas} onClick={() => { setFilterKelas(kelas.id_kelas.toString()); setShowFilter(false); resetPagination(); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center ${filterKelas === kelas.id_kelas.toString() ? "bg-blue-50 text-blue-700" : ""}`}><span>{kelas.nama}</span><Badge className="bg-slate-100 text-slate-600">-</Badge></button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button variant={selectMode ? "default" : "outline"} onClick={toggleSelectMode} className="rounded-xl h-9 text-sm">{selectMode ? "Deselect Mode" : "Select Mode"}</Button>
                      {selectMode && (
                        <>
                          <Button variant="default" onClick={() => handleBulkAction("activate")} disabled={selectedIds.length === 0 || isProcessingBulk} className="bg-green-600 hover:bg-green-700 rounded-xl h-9 text-sm">
                            {isProcessingBulk && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Aktifkan ({selectedIds.filter(id => { const u = userType === "guru" ? guruList.find(g => g.id_guru === id) : siswaList.find(s => s.id_siswa === id); return u && !u.aktif; }).length})
                          </Button>
                          <Button variant="destructive" onClick={() => handleBulkAction("deactivate")} disabled={selectedIds.length === 0 || isProcessingBulk} className="rounded-xl h-9 text-sm">
                            {isProcessingBulk && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Nonaktifkan ({selectedIds.filter(id => { const u = userType === "guru" ? guruList.find(g => g.id_guru === id) : siswaList.find(s => s.id_siswa === id); return u && u.aktif; }).length})
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {(searchQuery || filterKelas !== "all") && (
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                    <div className="text-sm text-slate-500">Menampilkan {totalData} data {userType === "guru" ? "guru" : "siswa"}{filterKelas !== "all" && filterKelas !== "unassigned" && <span className="ml-2 text-blue-600">(Kelas: {kelasList.find(k => k.id_kelas.toString() === filterKelas)?.nama})</span>}{filterKelas === "unassigned" && <span className="ml-2 text-amber-600">(Tanpa Kelas)</span>}</div>
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs"><X className="h-3 w-3 mr-1" /> Reset Filter</Button>
                  </div>
                )}
                {isFetching ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
                ) : (
                  <>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              {selectMode && <TableHead className="w-10"><Checkbox checked={selectedIds.length > 0 && selectedIds.length === (userType === "guru" ? displayedGuruList.length : displayedSiswaList.length)} onCheckedChange={handleSelectAll} /></TableHead>}
                              <TableHead className="font-semibold">ID</TableHead><TableHead className="font-semibold">Nama</TableHead><TableHead className="font-semibold">{userType === "guru" ? "NIP" : "NIS"}</TableHead><TableHead className="font-semibold">Email</TableHead><TableHead className="font-semibold">Gender</TableHead>{userType === "siswa" && <TableHead className="font-semibold">Kelas</TableHead>}<TableHead className="font-semibold text-center">Status</TableHead><TableHead className="font-semibold text-center">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userType === "guru" ? displayedGuruList.map(guru => (
                              <TableRow key={guru.id_guru} className="hover:bg-slate-50">
                                {selectMode && <TableCell><Checkbox checked={selectedIds.includes(guru.id_guru)} onCheckedChange={() => handleSelectItem(guru.id_guru)} /></TableCell>}
                                <TableCell className="font-mono text-sm">{guru.id_guru}</TableCell><TableCell className="font-medium">{guru.nama}</TableCell><TableCell className="font-mono text-sm">{guru.nip}</TableCell><TableCell>{guru.email}</TableCell><TableCell><Badge className={guru.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}>{guru.gender === "L" ? "Laki-laki" : "Perempuan"}</Badge></TableCell>
                                <TableCell className="text-center"><Badge className={guru.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{guru.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                                <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditDialog(guru)} className="h-8 w-8 p-0 rounded-lg"><Edit className="h-4 w-4 text-blue-500" /></Button>{guru.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmDeactivate(guru)} className="h-8 w-8 p-0 rounded-lg"><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmActivate(guru)} className="h-8 w-8 p-0 rounded-lg"><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                              </TableRow>
                            )) : displayedSiswaList.map(siswa => (
                              <TableRow key={siswa.id_siswa} className="hover:bg-slate-50">
                                {selectMode && <TableCell><Checkbox checked={selectedIds.includes(siswa.id_siswa)} onCheckedChange={() => handleSelectItem(siswa.id_siswa)} /></TableCell>}
                                <TableCell className="font-mono text-sm">{siswa.id_siswa}</TableCell><TableCell className="font-medium">{siswa.nama}</TableCell><TableCell className="font-mono text-sm">{siswa.nis}</TableCell><TableCell>{siswa.email}</TableCell><TableCell><Badge className={siswa.gender === "L" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}>{siswa.gender === "L" ? "Laki-laki" : "Perempuan"}</Badge></TableCell>
                                <TableCell>{siswa.nama_kelas ? <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{siswa.nama_kelas}</Badge> : <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Belum punya kelas</Badge>}</TableCell>
                                <TableCell className="text-center"><Badge className={siswa.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{siswa.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                                <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditDialog(siswa)} className="h-8 w-8 p-0 rounded-lg"><Edit className="h-4 w-4 text-blue-500" /></Button>{siswa.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmDeactivate(siswa)} className="h-8 w-8 p-0 rounded-lg"><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmActivate(siswa)} className="h-8 w-8 p-0 rounded-lg"><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                              </TableRow>
                            ))}
                            {((userType === "guru" && !displayedGuruList.length) || (userType === "siswa" && !displayedSiswaList.length)) && <TableRow><TableCell colSpan={userType === "guru" ? (selectMode ? 8 : 7) : (selectMode ? 9 : 8)} className="text-center py-8 text-slate-500"><Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />Tidak ada data</TableCell></TableRow>}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    {totalData > 0 && (
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                        <div className="flex items-center gap-2"><span className="text-sm text-slate-500">Tampilkan</span><Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}><SelectTrigger className="w-[70px] h-8 text-sm rounded-lg"><SelectValue /></SelectTrigger><SelectContent className="rounded-lg"><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select><span className="text-sm text-slate-500">per halaman</span></div>
                        <div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1} className="h-8 w-8 p-0 rounded-lg"><ChevronsLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage === 1} className="h-8 w-8 p-0 rounded-lg"><ChevronLeft className="h-4 w-4" /></Button><div className="flex items-center gap-1 px-2"><span className="text-sm font-medium">{currentPage}</span><span className="text-sm text-slate-400">/</span><span className="text-sm text-slate-500">{totalPages || 1}</span></div><Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0} className="h-8 w-8 p-0 rounded-lg"><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage === totalPages || totalPages === 0} className="h-8 w-8 p-0 rounded-lg"><ChevronsRight className="h-4 w-4" /></Button></div>
                        <div className="text-sm text-slate-500">Menampilkan {(currentPage-1)*itemsPerPage+1} - {Math.min(currentPage*itemsPerPage, totalData)} dari {totalData} data</div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* TAB KELOLA KELAS (dengan soft delete) */}
              <TabsContent value="kelas" className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <Button onClick={handleAddKelas} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Kelas
                  </Button>
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input type="text" placeholder="Cari kelas (nama kelas, wali kelas, ID)..." value={searchKelasQuery} onChange={(e) => setSearchKelasQuery(e.target.value)} className="pl-10 pr-10 rounded-xl border-slate-200 h-9 text-sm" />
                    {searchKelasQuery && <button onClick={() => setSearchKelasQuery("")} className="absolute right-3 top-1/2"><X className="h-4 w-4 text-slate-400 hover:text-slate-600" /></button>}
                  </div>
                  <Button variant="outline" onClick={fetchKelas} disabled={isFetchingKelas} className="rounded-xl h-9 text-sm">
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingKelas ? "animate-spin" : ""}`} /> Refresh
                  </Button>
                </div>
                {searchKelasQuery && <div className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg">Menampilkan {filteredKelasList.length} dari {kelasList.length} kelas</div>}
                {isFetchingKelas ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
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
                          {filteredKelasList.map((kelas) => (
                            <TableRow key={kelas.id_kelas} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-mono text-sm">{kelas.id_kelas}</TableCell>
                              <TableCell className="font-medium">{kelas.nama}</TableCell>
                              <TableCell><div className="flex items-center gap-2"><div className="bg-purple-100 p-1.5 rounded-lg"><User className="h-3 w-3 text-purple-600" /></div>{kelas.guru_nama || "-"}</div></TableCell>
                              <TableCell className="text-center"><Badge className={kelas.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{kelas.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                              <TableCell className="text-slate-500 text-sm">{new Date(kelas.dibuat_pada).toLocaleDateString()}</TableCell>
                              <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => handleEditKelas(kelas)} className="h-8 w-8 p-0 rounded-lg"><Edit className="h-4 w-4 text-blue-500" /></Button>{kelas.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmDeactivateKelas(kelas)} className="h-8 w-8 p-0 rounded-lg"><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmActivateKelas(kelas)} className="h-8 w-8 p-0 rounded-lg"><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                            </TableRow>
                          ))}
                          {!filteredKelasList.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">{searchKelasQuery ? <><Search className="h-8 w-8 mx-auto mb-2 text-slate-300" /> Tidak ada kelas yang cocok dengan "{searchKelasQuery}"</> : <><School className="h-8 w-8 mx-auto mb-2 text-slate-300" /> Belum ada data kelas</>}</TableCell></TableRow>}
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
              <div className="bg-indigo-100 p-3 rounded-xl flex-shrink-0"><Sparkles className="h-6 w-6 text-indigo-600" /></div>
              <div><h3 className="font-semibold text-slate-800 mb-1">Tips Mengelola Data</h3><p className="text-sm text-slate-600">Gunakan import Excel, filter, pencarian, dan mode select untuk mengaktifkan/nonaktifkan massal user. Kelas juga dapat dinonaktifkan dan diaktifkan kembali kapan saja tanpa menghapus data. User yang dinonaktifkan tetap muncul di daftar (paling bawah) dan dapat diaktifkan kembali.</p></div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4"><Separator className="mb-4" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen User & Kelas - SmartAS</p><p className="text-[10px] text-slate-300 mt-1">Sistem Informasi Akademik</p></div>
      </div>

      {/* Dialog Edit User */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><Edit className="h-5 w-5 text-blue-600" /> Edit User</DialogTitle><DialogDescription>Ubah informasi user. Kosongkan password jika tidak ingin mengubah.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-slate-700">Nama</Label><Input value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} className="rounded-xl mt-1" /></div>
            <div><Label className="text-slate-700">Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="rounded-xl mt-1" /></div>
            {userType === "guru" && <div><Label className="text-slate-700">NIP</Label><Input value={editForm.nip} onChange={e => setEditForm({...editForm, nip: e.target.value})} className="rounded-xl mt-1" /></div>}
            {userType === "siswa" && <div><Label className="text-slate-700">NIS</Label><Input value={editForm.nis} onChange={e => setEditForm({...editForm, nis: e.target.value})} className="rounded-xl mt-1" /></div>}
            <div><Label className="text-slate-700">Gender</Label><Select value={editForm.gender} onValueChange={v => setEditForm({...editForm, gender: v})}><SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></div>
            {userType === "siswa" && <div><Label className="text-slate-700">Kelas</Label><Select value={editForm.kelas_id} onValueChange={v => setEditForm({...editForm, kelas_id: v})}><SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Pilih kelas" /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none">Tidak ada kelas</SelectItem>{kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label className="text-slate-700">Password Baru (Opsional)</Label><Input type="password" placeholder="Kosongkan jika tidak ingin mengubah" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="rounded-xl mt-1" /></div>
            <div className="flex items-center space-x-2"><Checkbox id="aktif" checked={editForm.aktif} onCheckedChange={(checked) => setEditForm({...editForm, aktif: checked === true})} /><Label htmlFor="aktif" className="text-slate-700">Aktif (centang agar user dapat login)</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl">Batal</Button><Button onClick={handleUpdateUser} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Aktifkan/Nonaktifkan User Single */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className={`text-xl flex items-center gap-2 ${actionType === "activate" ? "text-green-600" : "text-red-600"}`}>{actionType === "activate" ? <UserPlus className="h-5 w-5" /> : <UserMinus className="h-5 w-5" />}{actionType === "activate" ? "Aktifkan User" : "Nonaktifkan User"}</DialogTitle><DialogDescription>{actionType === "activate" ? `Aktifkan kembali user ${targetUser?.nama}?` : `Yakin ingin menonaktifkan ${targetUser?.nama}?`}</DialogDescription></DialogHeader>
          {actionType === "deactivate" && actionConstraints.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="font-medium text-amber-800 text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Informasi Data Terkait</p><ul className="list-disc list-inside text-xs text-amber-700 mt-2">{actionConstraints.map((c,i)=><li key={i}>{c}</li>)}</ul><p className="text-xs text-amber-600 mt-2">User akan dinonaktifkan, data terkait tetap tersimpan.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setActionDialogOpen(false)} className="rounded-xl">Batal</Button><Button variant={actionType === "activate" ? "default" : "destructive"} onClick={executeToggleActive} disabled={isLoading} className="rounded-xl">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{actionType === "activate" ? "Ya, Aktifkan" : "Nonaktifkan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Bulk Action User */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>{bulkActionType === "activate" ? "Aktifkan Massal" : "Nonaktifkan Massal"}</DialogTitle><DialogDescription>Anda akan {bulkActionType === "activate" ? "mengaktifkan" : "menonaktifkan"} {bulkData?.users.length} user.</DialogDescription></DialogHeader>
          {bulkData && bulkData.cannotProcess.length > 0 && bulkActionType === "deactivate" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="font-medium text-amber-800 text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Informasi Data Terkait</p><p className="text-xs text-amber-700 mt-1">Beberapa user memiliki data di tabel lain. Data tersebut tetap tersimpan setelah dinonaktifkan.</p><div className="mt-2 space-y-2 max-h-32 overflow-y-auto">{bulkData.cannotProcess.map(c => <div key={c.id} className="text-xs bg-white rounded p-2"><p className="font-semibold">{c.nama}</p><ul className="list-disc list-inside text-amber-600">{c.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul></div>)}</div></div>}
          <DialogFooter><Button variant="outline" onClick={() => setBulkDialogOpen(false)} className="rounded-xl">Batal</Button><Button variant={bulkActionType === "activate" ? "default" : "destructive"} onClick={executeBulkAction} disabled={isProcessingBulk} className="rounded-xl">{isProcessingBulk && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ya, {bulkActionType === "activate" ? "Aktifkan" : "Nonaktifkan"} {bulkData?.canProcessIds.length} User</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kelas (Add/Edit) - dengan checkbox aktif */}
      <Dialog open={kelasDialogOpen} onOpenChange={setKelasDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl flex items-center gap-2"><School className="h-5 w-5 text-blue-600" />{editingKelas ? "Edit Kelas" : "Tambah Kelas Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-slate-700">Nama Kelas</Label><Input value={kelasForm.nama} onChange={e => setKelasForm({...kelasForm, nama: e.target.value})} placeholder="Contoh: XII RPL 1" className="rounded-xl mt-1" /></div>
            <div><Label className="text-slate-700">Wali Kelas</Label><Select value={kelasForm.id_guru} onValueChange={v => setKelasForm({...kelasForm, id_guru: v})}><SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Pilih wali kelas (opsional)" /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none">Tidak ada wali kelas</SelectItem>{guruOptions.map(guru => <SelectItem key={guru.id_guru} value={guru.id_guru.toString()}>{guru.nama} (NIP: {guru.nip})</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center space-x-2"><Checkbox id="kelas_aktif" checked={kelasForm.aktif} onCheckedChange={(checked) => setKelasForm({...kelasForm, aktif: checked === true})} /><Label htmlFor="kelas_aktif" className="text-slate-700">Aktif (kelas dapat digunakan)</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setKelasDialogOpen(false)} className="rounded-xl">Batal</Button><Button onClick={handleSaveKelas} disabled={isSavingKelas} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Aktifkan/Nonaktifkan Kelas */}
      <Dialog open={kelasActionDialogOpen} onOpenChange={setKelasActionDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className={`text-xl flex items-center gap-2 ${kelasActionType === "activate" ? "text-green-600" : "text-red-600"}`}>{kelasActionType === "activate" ? <UserPlus className="h-5 w-5" /> : <UserMinus className="h-5 w-5" />}{kelasActionType === "activate" ? "Aktifkan Kelas" : "Nonaktifkan Kelas"}</DialogTitle><DialogDescription>{kelasActionType === "activate" ? `Aktifkan kembali kelas ${targetKelas?.nama}?` : `Yakin ingin menonaktifkan kelas ${targetKelas?.nama}?`}</DialogDescription></DialogHeader>
          {kelasActionType === "deactivate" && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="font-medium text-amber-800 text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Informasi</p><p className="text-xs text-amber-700 mt-1">Kelas yang dinonaktifkan tetap tersimpan di database dan dapat diaktifkan kembali kapan saja. Siswa yang memiliki kelas ini tidak akan kehilangan referensi.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setKelasActionDialogOpen(false)} className="rounded-xl">Batal</Button><Button variant={kelasActionType === "activate" ? "default" : "destructive"} onClick={executeKelasAction} disabled={isSavingKelas} className="rounded-xl">{isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{kelasActionType === "activate" ? "Ya, Aktifkan" : "Nonaktifkan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}