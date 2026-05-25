// src/pages/admin/UserManagement.tsx
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  Database,
  Building2,
} from "lucide-react";

// ==================== TYPES ====================
interface GuruImportData {
  nama: string;
  nik: string;
  username: string;
  gender: string;
  password?: string;
}

interface SiswaImportData {
  nama: string;
  nis: string;
  username: string;
  gender: string;
  kelas: string;
  password?: string;
}

// Data umum untuk semua tipe user
interface BaseUser {
  id: string | number;
  nama: string;
  username: string;
  peran: string;
  aktif: boolean;
}

// Untuk guru
interface GuruData extends BaseUser {
  id: number;
  nik: string;
  gender: string;
  peran: "guru";
}

// Untuk siswa
interface SiswaData extends BaseUser {
  id: number;
  nis: string;
  gender: string;
  id_kelas: number | null;
  nama_kelas: string | null;
  peran: "siswa";
}

// Untuk admin_jurusan
interface AdminJurusanData extends BaseUser {
  id: string;
  id_jurusan: number | null;
  jurusan_nama: string;
  peran: "admin_jurusan";
}

// Untuk BK
interface BKData extends BaseUser {
  id: string;
  peran: "bk";
}

type UserItem = GuruData | SiswaData | AdminJurusanData | BKData;

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
  nik: string;
}

interface Jurusan {
  id_jurusan: number;
  nama_jurusan: string;
}

type ExcelRow = Record<string, string | number | boolean | null | undefined>;

type KelasWithGuru = {
  id_kelas: number;
  nama: string;
  aktif: boolean;
  dibuat_pada: string;
  id_guru: number | null;
  guru: { nama: string } | null;
};

interface GuruUpdateData {
  nama: string;
  gender: string;
  aktif: boolean;
  nik?: number;
}

interface SiswaUpdateData {
  nama: string;
  gender: string;
  aktif: boolean;
  nis?: number;
  id_kelas?: number | null;
}

export default function UserManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"list" | "kelas">("list");
  const [userType, setUserType] = useState<"guru" | "siswa" | "admin_jurusan" | "bk">("guru");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const isAdminSuper = user?.peran === "admin";

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKelasQuery, setSearchKelasQuery] = useState("");
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [showFilter, setShowFilter] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalData, setTotalData] = useState(0);
  const [userList, setUserList] = useState<UserItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Import user
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ExcelRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importStep, setImportStep] = useState<"upload" | "preview">("upload");
  const [importRawData, setImportRawData] = useState<ExcelRow[]>([]);

  // Add manual
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    nama: "",
    username: "",
    password: "",
    gender: "",
    nik: "",
    nis: "",
    kelas_id: "",
    peran: "guru" as "guru" | "siswa" | "admin_jurusan" | "bk",
    id_jurusan: "",
  });

  // Kelas related
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [isFetchingKelas, setIsFetchingKelas] = useState(false);
  const [guruOptions, setGuruOptions] = useState<GuruSimple[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);

  // Edit
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    nama: "",
    username: "",
    password: "",
    gender: "",
    nik: "",
    nis: "",
    kelas_id: "",
    peran: "guru" as "guru" | "siswa" | "admin_jurusan" | "bk",
    id_jurusan: "",
    aktif: true,
  });

  // Deactivate/Activate
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<UserItem | null>(null);
  const [deactivateConstraints, setDeactivateConstraints] = useState<string[]>([]);
  const [isActivatingMode, setIsActivatingMode] = useState(false);

  // Kelas CRUD
  const [kelasDialogOpen, setKelasDialogOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);
  const [kelasForm, setKelasForm] = useState({ nama: "", id_guru: "" });
  const [isSavingKelas, setIsSavingKelas] = useState(false);
  const [toggleKelasDialogOpen, setToggleKelasDialogOpen] = useState(false);
  const [togglingKelas, setTogglingKelas] = useState<Kelas | null>(null);
  const [isActivatingKelasMode, setIsActivatingKelasMode] = useState(false);

  // Import Kelas
  const [importKelasDialogOpen, setImportKelasDialogOpen] = useState(false);
  const [importKelasRawData, setImportKelasRawData] = useState<ExcelRow[]>([]);
  const [importKelasPreviewRows, setImportKelasPreviewRows] = useState<any[]>([]);
  const [importKelasMissingGurus, setImportKelasMissingGurus] = useState<Set<string>>(new Set());
  const [isImportingKelas, setIsImportingKelas] = useState(false);
  const [importKelasUploadError, setImportKelasUploadError] = useState<string | null>(null);
  const [missingGuruDialogOpen, setMissingGuruDialogOpen] = useState(false);
  const [importKelasStep, setImportKelasStep] = useState<"upload" | "preview">("upload");

  // Bulk actions
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [isProcessingSelected, setIsProcessingSelected] = useState(false);
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"activate" | "deactivate">("deactivate");
  const [bulkActionData, setBulkActionData] = useState<{
    users: { id: string | number; nama: string; aktif: boolean }[];
    cannotProcess: { id: string | number; nama: string; reasons: string[] }[];
    canProcessIds: (string | number)[];
  } | null>(null);

  // ========== GREETING ==========
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

  // ========== FETCH DATA UNIFIED ==========
  const fetchData = useCallback(async () => {
    setIsFetching(true);
    try {
      let data: UserItem[] = [];
      let total = 0;

      if (userType === "guru") {
        // Fetch guru + akun
        let query = supabase
          .from("guru")
          .select("id_guru, nama, nik, gender, aktif", { count: "exact" })
          .order("nama", { ascending: true })
          .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
        const { data: guruData, count, error } = await query;
        if (error) throw error;
        total = count || 0;
        const guruIds = guruData?.map(g => g.id_guru) || [];
        const { data: akunData } = await supabase
          .from("akun")
          .select("id_guru, username")
          .in("id_guru", guruIds);
        const usernameMap = new Map<number, string>();
        akunData?.forEach(akun => usernameMap.set(akun.id_guru, akun.username));
        data = (guruData || []).map(g => ({
          id: g.id_guru,
          nama: g.nama,
          username: usernameMap.get(g.id_guru) || "",
          peran: "guru" as const,
          aktif: g.aktif,
          nik: g.nik?.toString() || "",
          gender: g.gender,
        }));
      } else if (userType === "siswa") {
        // Fetch siswa + akun + kelas
        let siswaQuery = supabase
          .from("siswa")
          .select("id_siswa, nama, nis, gender, aktif, id_kelas", { count: "exact" })
          .order("nama", { ascending: true })
          .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
        if (filterKelas !== "all") {
          if (filterKelas === "unassigned") siswaQuery = siswaQuery.is("id_kelas", null);
          else siswaQuery = siswaQuery.eq("id_kelas", parseInt(filterKelas));
        }
        const { data: siswaData, count, error } = await siswaQuery;
        if (error) throw error;
        total = count || 0;
        const siswaIds = siswaData?.map(s => s.id_siswa) || [];
        const { data: akunData } = await supabase
          .from("akun")
          .select("id_siswa, username")
          .in("id_siswa", siswaIds);
        const usernameMap = new Map<number, string>();
        akunData?.forEach(akun => usernameMap.set(akun.id_siswa, akun.username));
        const kelasIds = siswaData?.map(s => s.id_kelas).filter(Boolean) as number[];
        const kelasMap = new Map<number, string>();
        if (kelasIds.length) {
          const { data: kelasData } = await supabase
            .from("kelas")
            .select("id_kelas, nama")
            .in("id_kelas", kelasIds);
          kelasData?.forEach(k => kelasMap.set(k.id_kelas, k.nama));
        }
        data = (siswaData || []).map(s => ({
          id: s.id_siswa,
          nama: s.nama,
          username: usernameMap.get(s.id_siswa) || "",
          peran: "siswa" as const,
          aktif: s.aktif,
          nis: s.nis?.toString() || "",
          gender: s.gender,
          id_kelas: s.id_kelas,
          nama_kelas: s.id_kelas ? kelasMap.get(s.id_kelas) || null : null,
        }));
      } else if (userType === "admin_jurusan") {
        // Langsung dari akun
        let query = supabase
          .from("akun")
          .select("id_akun, nama, username, peran, aktif, id_jurusan", { count: "exact" })
          .eq("peran", "admin_jurusan")
          .order("nama", { ascending: true })
          .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
        const { data: akunData, count, error } = await query;
        if (error) throw error;
        total = count || 0;
        const jurusanIds = akunData?.map(a => a.id_jurusan).filter(Boolean) as number[];
        const jurusanMap = new Map<number, string>();
        if (jurusanIds.length) {
          const { data: jurusanData } = await supabase
            .from("jurusan")
            .select("id_jurusan, nama_jurusan")
            .in("id_jurusan", jurusanIds);
          jurusanData?.forEach(j => jurusanMap.set(j.id_jurusan, j.nama_jurusan));
        }
        data = (akunData || []).map(a => ({
          id: a.id_akun,
          nama: a.nama,
          username: a.username,
          peran: "admin_jurusan" as const,
          aktif: a.aktif,
          id_jurusan: a.id_jurusan,
          jurusan_nama: a.id_jurusan ? jurusanMap.get(a.id_jurusan) || "-" : "-",
        }));
      } else if (userType === "bk") {
        let query = supabase
          .from("akun")
          .select("id_akun, nama, username, peran, aktif", { count: "exact" })
          .eq("peran", "bk")
          .order("nama", { ascending: true })
          .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
        const { data: akunData, count, error } = await query;
        if (error) throw error;
        total = count || 0;
        data = (akunData || []).map(a => ({
          id: a.id_akun,
          nama: a.nama,
          username: a.username,
          peran: "bk" as const,
          aktif: a.aktif,
        }));
      }

      setUserList(data);
      setTotalData(total);
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  }, [userType, currentPage, itemsPerPage, filterKelas, toast]);

  // ========== FETCH KELAS, GURU, JURUSAN ==========
  const fetchGuruOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("guru")
        .select("id_guru, nama, nik")
        .eq("aktif", true)
        .order("nama", { ascending: true });
      if (error) throw error;
      const formatted: GuruSimple[] = (data || []).map((g: { id_guru: number; nama: string; nik: number }) => ({ 
        id_guru: g.id_guru, 
        nama: g.nama, 
        nik: g.nik?.toString() || "" 
      }));
      setGuruOptions(formatted);
    } catch (error) { console.error(error); }
  }, []);

  const fetchKelas = useCallback(async () => {
    setIsFetchingKelas(true);
    try {
      const { data, error } = await supabase
        .from("kelas")
        .select(`*, guru:guru (nama)`)
        .order("nama", { ascending: true });
      if (error) throw error;
      const formatted: Kelas[] = (data || []).map((item: KelasWithGuru) => ({
        id_kelas: item.id_kelas,
        nama: item.nama,
        aktif: item.aktif,
        dibuat_pada: item.dibuat_pada,
        id_guru: item.id_guru,
        guru_nama: item.guru?.nama || null,
      }));
      setKelasList(formatted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data kelas";
      toast({ title: "Kesalahan", description: message, variant: "destructive" });
    } finally {
      setIsFetchingKelas(false);
    }
  }, [toast]);

  const fetchJurusan = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("jurusan")
        .select("id_jurusan, nama_jurusan")
        .eq("aktif", true)
        .order("nama_jurusan");
      if (error) throw error;
      setJurusanList(data || []);
    } catch (error) {
      console.error("Fetch jurusan error:", error);
    }
  }, []);

  // ========== DEPENDENCY EFFECTS ==========
  useEffect(() => {
    fetchGuruOptions();
    fetchKelas();
    fetchJurusan();
  }, [fetchGuruOptions, fetchKelas, fetchJurusan]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    resetPagination();
  }, [searchQuery, filterKelas, userType, itemsPerPage]);

  // ========== UTILITIES ==========
  const filteredUserList = userList.filter(user => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return user.nama.toLowerCase().includes(q) || user.username.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(totalData / itemsPerPage);
  const paginatedUserList = filteredUserList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

  // ========== CRUD UNIFIED ==========
  const openAddDialog = () => {
    setAddForm({
      nama: "",
      username: "",
      password: "",
      gender: "",
      nik: "",
      nis: "",
      kelas_id: "",
      peran: userType,
      id_jurusan: "",
    });
    setAddDialogOpen(true);
  };

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

  const handleAddUser = async () => {
    if (!addForm.nama.trim() || !addForm.username.trim()) {
      toast({ title: "Error", description: "Nama dan Username harus diisi", variant: "destructive" });
      return;
    }
    if (addForm.peran === "guru" && !addForm.nik.trim()) {
      toast({ title: "Error", description: "NIK harus diisi untuk guru", variant: "destructive" });
      return;
    }
    if (addForm.peran === "siswa" && !addForm.nis.trim()) {
      toast({ title: "Error", description: "NIS harus diisi untuk siswa", variant: "destructive" });
      return;
    }
    if (addForm.peran === "admin_jurusan" && !addForm.id_jurusan) {
      toast({ title: "Error", description: "Pilih jurusan untuk admin jurusan", variant: "destructive" });
      return;
    }
    if (addForm.peran !== "bk" && !addForm.gender) {
      toast({ title: "Error", description: "Jenis kelamin harus dipilih", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Check username unique
      const { data: existingUsername } = await supabase
        .from("akun")
        .select("username")
        .eq("username", addForm.username)
        .maybeSingle();
      if (existingUsername) throw new Error("Username sudah digunakan");

      const hashedPassword = await bcrypt.hash(addForm.password || "password123", 10);
      const now = new Date().toISOString();

      if (addForm.peran === "guru") {
        const { data: existingNik } = await supabase
          .from("guru")
          .select("nik")
          .eq("nik", parseInt(addForm.nik))
          .maybeSingle();
        if (existingNik) throw new Error("NIK sudah digunakan");
        const nextId = await getNextId("guru");
        await supabase.from("guru").insert({
          id_guru: nextId,
          nama: addForm.nama,
          nik: parseInt(addForm.nik),
          gender: addForm.gender.toUpperCase(),
          aktif: true,
          dibuat_pada: now,
        });
        await supabase.from("akun").insert({
          nama: addForm.nama,
          username: addForm.username,
          peran: "guru",
          aktif: true,
          dibuat_pada: now,
          id_guru: nextId,
          id_siswa: null,
          kata_sandi: hashedPassword,
        });
      } else if (addForm.peran === "siswa") {
        const { data: existingNis } = await supabase
          .from("siswa")
          .select("nis")
          .eq("nis", parseInt(addForm.nis))
          .maybeSingle();
        if (existingNis) throw new Error("NIS sudah digunakan");
        let kelasId: number | null = null;
        if (addForm.kelas_id && addForm.kelas_id !== "none") {
          kelasId = parseInt(addForm.kelas_id);
        }
        const nextId = await getNextId("siswa");
        await supabase.from("siswa").insert({
          id_siswa: nextId,
          nama: addForm.nama,
          nis: parseInt(addForm.nis),
          gender: addForm.gender.toUpperCase(),
          aktif: true,
          dibuat_pada: now,
          id_kelas: kelasId,
        });
        await supabase.from("akun").insert({
          nama: addForm.nama,
          username: addForm.username,
          peran: "siswa",
          aktif: true,
          dibuat_pada: now,
          id_guru: null,
          id_siswa: nextId,
          kata_sandi: hashedPassword,
        });
      } else if (addForm.peran === "admin_jurusan") {
        await supabase.from("akun").insert({
          nama: addForm.nama,
          username: addForm.username,
          peran: "admin_jurusan",
          aktif: true,
          dibuat_pada: now,
          id_guru: null,
          id_siswa: null,
          id_jurusan: parseInt(addForm.id_jurusan),
          kata_sandi: hashedPassword,
        });
      } else if (addForm.peran === "bk") {
        await supabase.from("akun").insert({
          nama: addForm.nama,
          username: addForm.username,
          peran: "bk",
          aktif: true,
          dibuat_pada: now,
          id_guru: null,
          id_siswa: null,
          id_jurusan: null,
          kata_sandi: hashedPassword,
        });
      }
      toast({ title: "Berhasil", description: "Pengguna berhasil ditambahkan" });
      setAddDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (userItem: UserItem) => {
    setEditingUser(userItem);
    if (userItem.peran === "guru") {
      const guru = userItem as GuruData;
      setEditForm({
        nama: guru.nama,
        username: guru.username,
        password: "",
        gender: guru.gender,
        nik: guru.nik,
        nis: "",
        kelas_id: "",
        peran: "guru",
        id_jurusan: "",
        aktif: guru.aktif,
      });
    } else if (userItem.peran === "siswa") {
      const siswa = userItem as SiswaData;
      setEditForm({
        nama: siswa.nama,
        username: siswa.username,
        password: "",
        gender: siswa.gender,
        nik: "",
        nis: siswa.nis,
        kelas_id: siswa.id_kelas?.toString() || "",
        peran: "siswa",
        id_jurusan: "",
        aktif: siswa.aktif,
      });
    } else if (userItem.peran === "admin_jurusan") {
      const adminJur = userItem as AdminJurusanData;
      setEditForm({
        nama: adminJur.nama,
        username: adminJur.username,
        password: "",
        gender: "",
        nik: "",
        nis: "",
        kelas_id: "",
        peran: "admin_jurusan",
        id_jurusan: adminJur.id_jurusan?.toString() || "",
        aktif: adminJur.aktif,
      });
    } else if (userItem.peran === "bk") {
      const bk = userItem as BKData;
      setEditForm({
        nama: bk.nama,
        username: bk.username,
        password: "",
        gender: "",
        nik: "",
        nis: "",
        kelas_id: "",
        peran: "bk",
        id_jurusan: "",
        aktif: bk.aktif,
      });
    }
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      // Check username uniqueness
      let query = supabase.from("akun").select("id_akun").eq("username", editForm.username);
      if (editingUser.peran === "guru") query = query.neq("id_guru", editingUser.id as number);
      else if (editingUser.peran === "siswa") query = query.neq("id_siswa", editingUser.id as number);
      else query = query.neq("id_akun", editingUser.id as string);
      const { data: existingUsername } = await query;
      if (existingUsername && existingUsername.length) {
        throw new Error("Username sudah digunakan oleh pengguna lain");
      }

      const updateData: any = { nama: editForm.nama, username: editForm.username, aktif: editForm.aktif };
      if (editForm.password.trim()) updateData.kata_sandi = await bcrypt.hash(editForm.password, 10);

      if (editingUser.peran === "guru") {
        const guruUser = editingUser as GuruData;
        if (editForm.nik && editForm.nik !== guruUser.nik) {
          const { data: existingNik } = await supabase
            .from("guru")
            .select("nik")
            .eq("nik", parseInt(editForm.nik))
            .neq("id_guru", guruUser.id)
            .maybeSingle();
          if (existingNik) throw new Error("NIK sudah digunakan oleh guru lain");
          await supabase.from("guru").update({ nik: parseInt(editForm.nik) }).eq("id_guru", guruUser.id);
        }
        await supabase.from("guru").update({ nama: editForm.nama, gender: editForm.gender.toUpperCase(), aktif: editForm.aktif }).eq("id_guru", guruUser.id);
        await supabase.from("akun").update(updateData).eq("id_guru", guruUser.id);
      } else if (editingUser.peran === "siswa") {
        const siswaUser = editingUser as SiswaData;
        if (editForm.nis && editForm.nis !== siswaUser.nis) {
          const { data: existingNis } = await supabase
            .from("siswa")
            .select("nis")
            .eq("nis", parseInt(editForm.nis))
            .neq("id_siswa", siswaUser.id)
            .maybeSingle();
          if (existingNis) throw new Error("NIS sudah digunakan oleh siswa lain");
          await supabase.from("siswa").update({ nis: parseInt(editForm.nis) }).eq("id_siswa", siswaUser.id);
        }
        let kelasId = null;
        if (editForm.kelas_id && editForm.kelas_id !== "none") kelasId = parseInt(editForm.kelas_id);
        await supabase.from("siswa").update({
          nama: editForm.nama,
          gender: editForm.gender.toUpperCase(),
          aktif: editForm.aktif,
          id_kelas: kelasId,
        }).eq("id_siswa", siswaUser.id);
        await supabase.from("akun").update(updateData).eq("id_siswa", siswaUser.id);
      } else if (editingUser.peran === "admin_jurusan") {
        if (editForm.peran !== "admin_jurusan") {
          // Change role
          await supabase.from("akun").update({ ...updateData, peran: editForm.peran, id_jurusan: null }).eq("id_akun", editingUser.id);
        } else {
          const data: any = { ...updateData, peran: "admin_jurusan" };
          if (editForm.id_jurusan) data.id_jurusan = parseInt(editForm.id_jurusan);
          else data.id_jurusan = null;
          await supabase.from("akun").update(data).eq("id_akun", editingUser.id);
        }
      } else if (editingUser.peran === "bk") {
        if (editForm.peran !== "bk") {
          await supabase.from("akun").update({ ...updateData, peran: editForm.peran, id_jurusan: null }).eq("id_akun", editingUser.id);
        } else {
          await supabase.from("akun").update({ ...updateData, peran: "bk", id_jurusan: null }).eq("id_akun", editingUser.id);
        }
      }
      toast({ title: "Berhasil", description: "Data pengguna berhasil diperbarui" });
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ========== DEACTIVATE / ACTIVATE ==========
  const checkUserRelatedData = async (userItem: UserItem): Promise<string[]> => {
    const related: string[] = [];
    if (userItem.peran === "guru") {
      const id = userItem.id as number;
      const { data: jadwalData } = await supabase.from("jadwal").select("id_jadwal").eq("id_guru", id);
      if (jadwalData?.length) related.push(`📚 Memiliki ${jadwalData.length} jadwal mengajar`);
      const { data: kelasData } = await supabase.from("kelas").select("id_kelas").eq("id_guru", id);
      if (kelasData?.length) related.push(`🏫 Menjadi wali kelas untuk ${kelasData.length} kelas`);
      const { data: pklData } = await supabase.from("pkl").select("id_pkl").eq("id_guru", id);
      if (pklData?.length) related.push(`🏢 Membimbing ${pklData.length} PKL`);
    } else if (userItem.peran === "siswa") {
      const id = userItem.id as number;
      const { data: presHarian } = await supabase.from("presensi_harian").select("id_presensi_harian").eq("id_siswa", id);
      if (presHarian?.length) related.push(`📅 Memiliki ${presHarian.length} data presensi harian`);
      const { data: presMapel } = await supabase.from("presensi_siswa_mapel").select("id_pre_siswa").eq("id_siswa", id);
      if (presMapel?.length) related.push(`📖 Memiliki ${presMapel.length} data presensi mata pelajaran`);
    }
    return related;
  };

  const confirmDeactivate = async (userItem: UserItem) => {
    const constraints = await checkUserRelatedData(userItem);
    setDeactivatingUser(userItem);
    setDeactivateConstraints(constraints);
    setIsActivatingMode(false);
    setDeactivateDialogOpen(true);
  };

  const confirmActivate = (userItem: UserItem) => {
    setDeactivatingUser(userItem);
    setDeactivateConstraints([]);
    setIsActivatingMode(true);
    setDeactivateDialogOpen(true);
  };

  const executeToggleActive = async () => {
    if (!deactivatingUser) return;
    setIsLoading(true);
    setDeactivateDialogOpen(false);
    try {
      const newStatus = !deactivatingUser.aktif;
      if (deactivatingUser.peran === "guru") {
        await supabase.from("guru").update({ aktif: newStatus }).eq("id_guru", deactivatingUser.id as number);
        await supabase.from("akun").update({ aktif: newStatus }).eq("id_guru", deactivatingUser.id as number);
      } else if (deactivatingUser.peran === "siswa") {
        await supabase.from("siswa").update({ aktif: newStatus }).eq("id_siswa", deactivatingUser.id as number);
        await supabase.from("akun").update({ aktif: newStatus }).eq("id_siswa", deactivatingUser.id as number);
      } else {
        await supabase.from("akun").update({ aktif: newStatus }).eq("id_akun", deactivatingUser.id as string);
      }
      toast({ title: "Berhasil", description: `Pengguna ${deactivatingUser.nama} telah ${newStatus ? "diaktifkan" : "dinonaktifkan"}.` });
      fetchData();
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setDeactivatingUser(null);
    }
  };

  // ========== SELECT MASSAL ==========
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) setSelectedIds([]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedUserList.length && paginatedUserList.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedUserList.map(u => u.id));
    }
  };

  const handleSelectItem = (id: string | number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = async (action: "activate" | "deactivate") => {
    if (selectedIds.length === 0) {
      toast({ title: "Tidak ada data dipilih", variant: "destructive" });
      return;
    }
    const usersSelected = selectedIds.map(id => {
      const u = userList.find(u => u.id === id);
      return { id, nama: u?.nama || `ID ${id}`, aktif: u?.aktif ?? false, peran: u?.peran };
    }).filter(u => u.peran) as { id: string | number; nama: string; aktif: boolean; peran: string }[];
    const cannotProcess: { id: string | number; nama: string; reasons: string[] }[] = [];
    const canProcessIds: (string | number)[] = [];
    if (action === "deactivate") {
      for (const u of usersSelected) {
        if (!u.aktif) continue;
        let reasons: string[] = [];
        if (u.peran === "guru") {
          const { data: jadwalData } = await supabase.from("jadwal").select("id_jadwal").eq("id_guru", u.id as number);
          if (jadwalData?.length) reasons.push(`📚 Memiliki ${jadwalData.length} jadwal`);
          const { data: kelasData } = await supabase.from("kelas").select("id_kelas").eq("id_guru", u.id as number);
          if (kelasData?.length) reasons.push(`🏫 Wali kelas ${kelasData.length} kelas`);
          const { data: pklData } = await supabase.from("pkl").select("id_pkl").eq("id_guru", u.id as number);
          if (pklData?.length) reasons.push(`🏢 Membimbing ${pklData.length} PKL`);
        } else if (u.peran === "siswa") {
          const { data: presHarian } = await supabase.from("presensi_harian").select("id_presensi_harian").eq("id_siswa", u.id as number);
          if (presHarian?.length) reasons.push(`📅 ${presHarian.length} presensi harian`);
          const { data: presMapel } = await supabase.from("presensi_siswa_mapel").select("id_pre_siswa").eq("id_siswa", u.id as number);
          if (presMapel?.length) reasons.push(`📖 ${presMapel.length} presensi mapel`);
        }
        if (reasons.length) cannotProcess.push({ id: u.id, nama: u.nama, reasons });
        else canProcessIds.push(u.id);
      }
    } else {
      for (const u of usersSelected) {
        if (!u.aktif) canProcessIds.push(u.id);
      }
    }
    setBulkActionData({ users: usersSelected, cannotProcess, canProcessIds });
    setBulkActionType(action);
    setBulkActionDialogOpen(true);
  };

  const executeBulkAction = async () => {
    if (!bulkActionData) return;
    const { canProcessIds } = bulkActionData;
    const newActiveStatus = bulkActionType === "activate";
    let successCount = 0, failCount = 0;
    for (const id of canProcessIds) {
      try {
        const targetUser = userList.find(u => u.id === id);
        if (!targetUser) continue;
        if (targetUser.peran === "guru") {
          await supabase.from("guru").update({ aktif: newActiveStatus }).eq("id_guru", id as number);
          await supabase.from("akun").update({ aktif: newActiveStatus }).eq("id_guru", id as number);
        } else if (targetUser.peran === "siswa") {
          await supabase.from("siswa").update({ aktif: newActiveStatus }).eq("id_siswa", id as number);
          await supabase.from("akun").update({ aktif: newActiveStatus }).eq("id_siswa", id as number);
        } else {
          await supabase.from("akun").update({ aktif: newActiveStatus }).eq("id_akun", id as string);
        }
        successCount++;
      } catch {
        failCount++;
      }
    }
    toast({ title: "Berhasil", description: `${successCount} pengguna berhasil ${bulkActionType === "activate" ? "diaktifkan" : "dinonaktifkan"}${failCount ? `, ${failCount} gagal` : ""}` });
    fetchData();
    setSelectMode(false);
    setSelectedIds([]);
    setBulkActionDialogOpen(false);
  };

  // ========== KELAS MANAGEMENT (same as before) ==========
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
      const data: { nama: string; id_guru: number | null } = {
        nama: kelasForm.nama.trim(),
        id_guru: kelasForm.id_guru ? parseInt(kelasForm.id_guru) : null,
      };
      if (editingKelas) {
        await supabase.from("kelas").update(data).eq("id_kelas", editingKelas.id_kelas);
        toast({ title: "Berhasil", description: "Kelas berhasil diperbarui" });
      } else {
        await supabase.from("kelas").insert({ ...data, aktif: true, dibuat_pada: new Date().toISOString() });
        toast({ title: "Berhasil", description: "Kelas baru berhasil ditambahkan" });
      }
      setKelasDialogOpen(false);
      fetchKelas();
    } catch (error) {
      toast({ title: "Kesalahan", description: error instanceof Error ? error.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
    }
  };
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
      await supabase.from("kelas").update({ aktif: !togglingKelas.aktif }).eq("id_kelas", togglingKelas.id_kelas);
      toast({ title: "Berhasil", description: `Kelas ${togglingKelas.nama} telah ${!togglingKelas.aktif ? "diaktifkan" : "dinonaktifkan"}.` });
      fetchKelas();
    } catch (error) {
      toast({ title: "Kesalahan", description: error instanceof Error ? error.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
      setTogglingKelas(null);
    }
  };

  // Import Kelas (same as before)
  const downloadKelasTemplate = () => {
    const headers = ["nama", "nik_wali", "aktif"];
    const data = [["X IPA 1", "198512342021011001", "1"], ["XI IPS 2", "198709152021012002", "1"], ["XII RPL 3", "", "0"]];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Kelas");
    XLSX.writeFile(wb, "template_import_kelas.xlsx");
  };
  const handleKelasFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportKelasUploadError(null);
    setIsImportingKelas(true);
    setImportKelasStep("upload");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
      if (jsonData.length === 0) throw new Error("File kosong");
      const firstRow = jsonData[0];
      if (!("nama" in firstRow)) throw new Error("Kolom 'nama' tidak ditemukan");
      setImportKelasRawData(jsonData);
      const missingGurusSet = new Set<string>();
      const previewWithValidation = [];
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const nama = row.nama?.toString().trim();
        const nikWali = row.nik_wali?.toString().trim();
        let guru = null;
        if (nikWali) {
          guru = guruOptions.find(g => g.nik === nikWali);
          if (!guru) missingGurusSet.add(nikWali);
        }
        const aktif = row.aktif === undefined ? true : (row.aktif === "1" || row.aktif === true);
        previewWithValidation.push({
          nama, nik_wali: nikWali || null, aktif, rowIndex: i + 1,
          guruId: guru?.id_guru || null, guruValid: !nikWali || !!guru,
          validationErrors: !nama ? ["Nama kelas tidak boleh kosong"] : [],
          isValid: !!nama && (!nikWali || !!guru),
        });
      }
      setImportKelasMissingGurus(missingGurusSet);
      setImportKelasPreviewRows(previewWithValidation);
      if (previewWithValidation.some(p => !p.guruValid && p.nik_wali)) setMissingGuruDialogOpen(true);
      else { setImportKelasStep("preview"); setImportKelasDialogOpen(true); }
    } catch (error: any) {
      setImportKelasUploadError(error.message);
      toast({ title: "Upload Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsImportingKelas(false);
      event.target.value = "";
    }
  };
  const confirmImportKelas = async () => {
    const validRows = importKelasPreviewRows.filter(row => row.isValid);
    if (validRows.length === 0) {
      toast({ title: "Tidak Ada Data Valid", description: "Tidak ada baris yang valid untuk diimpor.", variant: "destructive" });
      return;
    }
    setIsImportingKelas(true);
    let successCount = 0, failCount = 0;
    for (const row of validRows) {
      try {
        const { data: existing } = await supabase.from("kelas").select("id_kelas").eq("nama", row.nama).maybeSingle();
        if (existing) { failCount++; continue; }
        await supabase.from("kelas").insert({ nama: row.nama, id_guru: row.guruId, aktif: row.aktif, dibuat_pada: new Date().toISOString() });
        successCount++;
      } catch { failCount++; }
    }
    if (successCount > 0) toast({ title: "Impor Selesai", description: `${successCount} kelas berhasil diimpor, ${failCount} gagal.` });
    else toast({ title: "Impor Gagal", description: "Tidak ada kelas yang berhasil diimpor.", variant: "destructive" });
    fetchKelas();
    setImportKelasDialogOpen(false);
    setImportKelasRawData([]);
    setImportKelasPreviewRows([]);
    setImportKelasStep("upload");
    setIsImportingKelas(false);
  };
  const handleSkipMissingGurus = () => {
    const filteredRows = importKelasPreviewRows.map(row => {
      if (!row.guruValid && row.nik_wali) return { ...row, isValid: false, validationErrors: [...row.validationErrors, "NIK wali tidak ditemukan, baris akan dilewati"] };
      return row;
    });
    setImportKelasPreviewRows(filteredRows);
    setMissingGuruDialogOpen(false);
    setImportKelasStep("preview");
    setImportKelasDialogOpen(true);
  };

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-2xl backdrop-blur-sm"><Users className="h-6 w-6 sm:h-8 sm:w-8" /></div>
              <div>
                <div className="flex items-center gap-2">{greeting === "Selamat Pagi" ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-3 w-3 sm:h-4 sm:w-4" /> : <Cloud className="h-3 w-3 sm:h-4 sm:w-4" />}<p className="text-xs sm:text-sm text-blue-100">{greeting}</p></div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold leading-tight">Manajemen Data Pengguna &amp; Kelas</h1>
                <p className="text-blue-100 text-xs sm:text-sm">Kelola guru, siswa, admin jurusan, BK, serta kelas</p>
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
          <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100"><CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-blue-600 font-medium">Total Guru</p><p className="text-lg sm:text-2xl font-bold text-blue-900">{userList.filter(u => u.peran === "guru").length}</p></div><User className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" /></div></CardContent></Card>
          <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100"><CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-emerald-600 font-medium">Total Siswa</p><p className="text-lg sm:text-2xl font-bold text-emerald-900">{userList.filter(u => u.peran === "siswa").length}</p></div><GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500" /></div></CardContent></Card>
          <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100"><CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-purple-600 font-medium">Total Admin Jurusan</p><p className="text-lg sm:text-2xl font-bold text-purple-900">{userList.filter(u => u.peran === "admin_jurusan").length}</p></div><Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" /></div></CardContent></Card>
          <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100"><CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] sm:text-xs text-amber-600 font-medium">Total BK</p><p className="text-lg sm:text-2xl font-bold text-amber-900">{userList.filter(u => u.peran === "bk").length}</p></div><Shield className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" /></div></CardContent></Card>
        </div>

        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3"><div className="bg-white/10 p-1.5 sm:p-2 rounded-xl"><Shield className="h-5 w-5 sm:h-6 sm:w-6" /></div><div><CardTitle className="text-base sm:text-xl">Manajemen Pengguna &amp; Kelas</CardTitle><CardDescription className="text-slate-300 text-xs sm:text-sm">Kelola semua jenis pengguna dan kelas</CardDescription></div></div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "list" | "kelas")} className="space-y-4 sm:space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white text-xs sm:text-sm px-3 sm:px-4"><Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> Daftar Pengguna</TabsTrigger>
                  <TabsTrigger value="kelas" className="rounded-lg data-[state=active]:bg-white text-xs sm:text-sm px-3 sm:px-4"><School className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> Kelola Kelas</TabsTrigger>
                </TabsList>
              </div>

              {/* TAB DAFTAR PENGGUNA */}
              <TabsContent value="list" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-start">
                    <Select value={userType} onValueChange={(v) => { setUserType(v as any); resetPagination(); }}>
                      <SelectTrigger className="w-[180px] rounded-xl h-8 sm:h-9 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="siswa">Siswa</SelectItem>
                        <SelectItem value="admin_jurusan">Admin Jurusan</SelectItem>
                        <SelectItem value="bk">BK (Bimbingan Konseling)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
                    <Button onClick={openAddDialog} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 w-full"><Plus className="mr-1 h-3 w-3" /> Tambah</Button>
                    <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full"><Upload className="mr-1 h-3 w-3" /> Impor</Button>
                    <Button variant="outline" onClick={fetchData} disabled={isFetching} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full"><RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> Segarkan</Button>
                  </div>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                    <Input placeholder="Cari nama atau username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8 rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full" />
                    {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                    <Button variant={selectMode ? "default" : "outline"} onClick={toggleSelectMode} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-auto">{selectMode ? "Batalkan Mode Pilih" : "Mode Pilih"}</Button>
                    {selectMode && <div className="flex gap-2 w-full sm:w-auto justify-center"><Button onClick={() => handleBulkAction("activate")} disabled={selectedIds.length === 0} className="bg-green-600 hover:bg-green-700 rounded-xl text-xs">Aktifkan ({selectedIds.filter(id => !userList.find(u => u.id === id)?.aktif).length})</Button><Button variant="destructive" onClick={() => handleBulkAction("deactivate")} disabled={selectedIds.length === 0} className="rounded-xl text-xs">Nonaktifkan ({selectedIds.filter(id => userList.find(u => u.id === id)?.aktif).length})</Button></div>}
                  </div>
                </div>
                {isFetching ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            {selectMode && <TableHead className="w-10"><Checkbox checked={selectedIds.length === paginatedUserList.length && paginatedUserList.length > 0} onCheckedChange={handleSelectAll} /></TableHead>}
                            <TableHead>Nama</TableHead>
                            <TableHead>Nama Pengguna</TableHead>
                            {userType === "guru" && <TableHead>NIK</TableHead>}
                            {userType === "siswa" && <TableHead>NIS</TableHead>}
                            {userType === "siswa" && <TableHead>Kelas</TableHead>}
                            {userType === "admin_jurusan" && <TableHead>Jurusan</TableHead>}
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedUserList.map(item => (
                            <TableRow key={item.id} className="hover:bg-slate-50">
                              {selectMode && <TableCell><Checkbox checked={selectedIds.includes(item.id)} onCheckedChange={() => handleSelectItem(item.id)} /></TableCell>}
                              <TableCell className="whitespace-nowrap">{item.nama}</TableCell>
                              <TableCell className="break-all min-w-[180px]">{item.username}</TableCell>
                              {userType === "guru" && <TableCell>{(item as GuruData).nik}</TableCell>}
                              {userType === "siswa" && <TableCell>{(item as SiswaData).nis}</TableCell>}
                              {userType === "siswa" && <TableCell>{(item as SiswaData).nama_kelas || "-"}</TableCell>}
                              {userType === "admin_jurusan" && <TableCell>{(item as AdminJurusanData).jurusan_nama || "-"}</TableCell>}
                              <TableCell><Badge className={item.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{item.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                              <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}><Edit className="h-4 w-4 text-blue-500" /></Button>{item.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmDeactivate(item)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmActivate(item)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                            </TableRow>
                          ))}
                          {paginatedUserList.length === 0 && <TableRow><TableCell colSpan={selectMode ? 8 : 7} className="text-center py-8 text-slate-500"><Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />Tidak ada data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                {totalData > 0 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                    <div className="flex items-center gap-2"><span className="text-xs">Tampilkan</span><Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}><SelectTrigger className="w-[70px] h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select><span className="text-xs">per halaman</span></div>
                    <div className="flex gap-1"><Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}><ChevronsLeft className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage === 1}><ChevronLeft className="h-3.5 w-3.5" /></Button><div className="px-2 text-sm"><span className="font-medium">{currentPage}</span><span className="text-slate-400"> / {totalPages || 1}</span></div><Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage === totalPages || totalPages === 0}><ChevronsRight className="h-3.5 w-3.5" /></Button></div>
                    <div className="text-xs">Menampilkan {(currentPage-1)*itemsPerPage+1} - {Math.min(currentPage*itemsPerPage, totalData)} dari {totalData} data</div>
                  </div>
                )}
              </TabsContent>

              {/* TAB KELAS (sama seperti sebelumnya) */}
              <TabsContent value="kelas" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start"><Button onClick={handleAddKelas} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600"><Plus className="mr-1 h-3 w-3" /> Tambah Kelas</Button><Button variant="outline" onClick={() => setImportKelasDialogOpen(true)} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm"><Upload className="mr-1 h-3 w-3" /> Impor Excel</Button></div>
                  <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Cari kelas..." value={searchKelasQuery} onChange={(e) => setSearchKelasQuery(e.target.value)} className="pl-9 pr-8 rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full" />{searchKelasQuery && <button onClick={() => setSearchKelasQuery("")} className="absolute right-3 top-1/2"><X className="h-3.5 w-3.5" /></button>}</div>
                  <Button variant="outline" onClick={fetchKelas} disabled={isFetchingKelas} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm"><RefreshCw className={`mr-1 h-3 w-3 ${isFetchingKelas ? "animate-spin" : ""}`} /> Segarkan</Button>
                </div>
                {isFetchingKelas ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : (
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow className="bg-slate-50"><TableHead>Nama Kelas</TableHead><TableHead>Wali Kelas</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-center">Aksi</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {kelasList.filter(k => !searchKelasQuery || k.nama.toLowerCase().includes(searchKelasQuery.toLowerCase())).map(kelas => (
                            <TableRow key={kelas.id_kelas}><TableCell className="font-medium">{kelas.nama}</TableCell><TableCell><div className="flex items-center gap-2"><div className="bg-purple-100 p-1.5 rounded-lg"><User className="h-3 w-3 text-purple-600" /></div>{kelas.guru_nama || "-"}</div></TableCell><TableCell className="text-center"><Badge className={kelas.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{kelas.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell><TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => handleEditKelas(kelas)}><Edit className="h-4 w-4 text-blue-500" /></Button>{kelas.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmToggleActiveKelas(kelas, false)}><UserMinus className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmToggleActiveKelas(kelas, true)}><UserPlus className="h-4 w-4 text-green-500" /></Button>}</div></TableCell></TableRow>
                          ))}
                          {kelasList.filter(k => !searchKelasQuery || k.nama.toLowerCase().includes(searchKelasQuery.toLowerCase())).length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">Belum ada data kelas</TableCell></TableRow>}
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
        <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 max-w-3xl mx-auto">
          <CardContent className="p-4 sm:p-5"><div className="flex gap-3"><div className="bg-indigo-100 p-2 rounded-xl"><Sparkles className="h-5 w-5 text-indigo-600" /></div><div><h3 className="font-semibold text-sm">Tips Mengelola Data</h3><p className="text-xs text-slate-600">Gunakan impor Excel untuk data massal. Untuk admin jurusan, pastikan jurusan sudah tersedia. Data duplikat akan dilewati. Gunakan mode pilih untuk mengaktifkan/nonaktifkan banyak pengguna sekaligus.</p></div></div></CardContent>
        </Card>
        <div className="text-center pt-4"><Separator className="mb-4" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen Pengguna &amp; Kelas - SmartAS</p></div>
      </div>

      {/* DIALOGS (Add, Edit, Import, Bulk, Kelas) - similar to before, but adapted for unified types */}
      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle><Plus className="h-5 w-5 inline mr-2 text-emerald-600" /> Tambah {addForm.peran === "guru" ? "Guru" : addForm.peran === "siswa" ? "Siswa" : addForm.peran === "admin_jurusan" ? "Admin Jurusan" : "BK"}</DialogTitle><DialogDescription>Isi data pengguna baru. Kata sandi default "password123".</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama Lengkap</Label><Input value={addForm.nama} onChange={e => setAddForm({...addForm, nama: e.target.value})} className="rounded-xl" /></div>
            <div><Label>Nama Pengguna</Label><Input value={addForm.username} onChange={e => setAddForm({...addForm, username: e.target.value})} className="rounded-xl" /></div>
            {addForm.peran !== "bk" && (addForm.peran !== "admin_jurusan") && (
              <div><Label>Jenis Kelamin</Label><Select value={addForm.gender} onValueChange={v => setAddForm({...addForm, gender: v})}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih jenis kelamin" /></SelectTrigger><SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></div>
            )}
            {addForm.peran === "guru" && <div><Label>NIK</Label><Input value={addForm.nik} onChange={e => setAddForm({...addForm, nik: e.target.value})} className="rounded-xl" /></div>}
            {addForm.peran === "siswa" && <div><Label>NIS</Label><Input value={addForm.nis} onChange={e => setAddForm({...addForm, nis: e.target.value})} className="rounded-xl" /></div>}
            {addForm.peran === "siswa" && (
              <div><Label>Kelas</Label>
                <Select value={addForm.kelas_id} onValueChange={v => setAddForm({...addForm, kelas_id: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih kelas (opsional)" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Tidak ada kelas</SelectItem>{kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {addForm.peran === "admin_jurusan" && (
              <div><Label>Jurusan</Label>
                <Select value={addForm.id_jurusan} onValueChange={v => setAddForm({...addForm, id_jurusan: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih jurusan" /></SelectTrigger>
                  <SelectContent>{jurusanList.map(j => <SelectItem key={j.id_jurusan} value={j.id_jurusan.toString()}>{j.nama_jurusan}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Kata Sandi (opsional)</Label><Input type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} className="rounded-xl" placeholder="Kosongkan untuk default: password123" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddDialogOpen(false)}>Batal</Button><Button onClick={handleAddUser} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle><Edit className="h-5 w-5 inline mr-2 text-blue-600" /> Edit Pengguna</DialogTitle><DialogDescription>Ubah informasi pengguna. Kosongkan kata sandi jika tidak ingin mengubah.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama</Label><Input value={editForm.nama} onChange={e => setEditForm({...editForm, nama: e.target.value})} className="rounded-xl" /></div>
            <div><Label>Nama Pengguna</Label><Input value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="rounded-xl" /></div>
            {editForm.peran !== "bk" && editForm.peran !== "admin_jurusan" && (
              <div><Label>Jenis Kelamin</Label><Select value={editForm.gender} onValueChange={v => setEditForm({...editForm, gender: v})}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></div>
            )}
            {editForm.peran === "guru" && <div><Label>NIK</Label><Input value={editForm.nik} onChange={e => setEditForm({...editForm, nik: e.target.value})} className="rounded-xl" /></div>}
            {editForm.peran === "siswa" && <div><Label>NIS</Label><Input value={editForm.nis} onChange={e => setEditForm({...editForm, nis: e.target.value})} className="rounded-xl" /></div>}
            {editForm.peran === "siswa" && (
              <div><Label>Kelas</Label>
                <Select value={editForm.kelas_id} onValueChange={v => setEditForm({...editForm, kelas_id: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Tidak ada kelas</SelectItem>{kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {editForm.peran === "admin_jurusan" && (
              <div><Label>Jurusan</Label>
                <Select value={editForm.id_jurusan} onValueChange={v => setEditForm({...editForm, id_jurusan: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih jurusan" /></SelectTrigger>
                  <SelectContent>{jurusanList.map(j => <SelectItem key={j.id_jurusan} value={j.id_jurusan.toString()}>{j.nama_jurusan}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Role</Label>
              <Select value={editForm.peran} onValueChange={v => setEditForm({...editForm, peran: v as any})}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="guru">Guru</SelectItem>
                  <SelectItem value="siswa">Siswa</SelectItem>
                  <SelectItem value="admin_jurusan">Admin Jurusan</SelectItem>
                  <SelectItem value="bk">BK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Kata Sandi Baru (Opsional)</Label><Input type="password" placeholder="Kosongkan jika tidak ingin mengubah" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="rounded-xl" /></div>
            <div className="flex items-center space-x-2"><Checkbox id="edit_aktif" checked={editForm.aktif} onCheckedChange={(checked) => setEditForm({...editForm, aktif: checked === true})} /><Label htmlFor="edit_aktif">Aktif (centang agar pengguna dapat login)</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button><Button onClick={handleUpdateUser} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>{isActivatingMode ? "Aktifkan Pengguna" : "Nonaktifkan Pengguna"}</DialogTitle><DialogDescription>{isActivatingMode ? `Aktifkan kembali ${deactivatingUser?.nama}?` : `Yakin ingin menonaktifkan ${deactivatingUser?.nama}?`}</DialogDescription></DialogHeader>
          {!isActivatingMode && deactivateConstraints.length > 0 && <div className="bg-amber-50 border p-3 rounded-lg"><p className="font-medium text-amber-800">Data terkait:</p><ul className="list-disc list-inside text-xs">{deactivateConstraints.map((c,i)=><li key={i}>{c}</li>)}</ul><p className="text-xs mt-1">Pengguna akan dinonaktifkan, namun data terkait tetap tersimpan.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>Batal</Button><Button variant={isActivatingMode ? "default" : "destructive"} onClick={executeToggleActive} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isActivatingMode ? "Aktifkan" : "Nonaktifkan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>{bulkActionType === "activate" ? "Aktifkan Massal" : "Nonaktifkan Massal"}</DialogTitle><DialogDescription>Anda akan {bulkActionType === "activate" ? "mengaktifkan" : "menonaktifkan"} {bulkActionData?.users.length} pengguna.</DialogDescription></DialogHeader>
          {bulkActionData && bulkActionData.cannotProcess.length > 0 && <div className="bg-amber-50 border p-3 rounded-lg"><p className="font-medium text-amber-800">⚠️ Beberapa pengguna memiliki data terkait:</p><ul className="list-disc list-inside text-xs">{bulkActionData.cannotProcess.map(c=><li key={c.id}>{c.nama}: {c.reasons.join(", ")}</li>)}</ul><p className="text-xs mt-1">Tetap dapat dinonaktifkan, data terkait tetap tersimpan.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setBulkActionDialogOpen(false)}>Batal</Button><Button variant={bulkActionType === "activate" ? "default" : "destructive"} onClick={executeBulkAction} disabled={isProcessingSelected}>{isProcessingSelected && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ya, {bulkActionType === "activate" ? "Aktifkan" : "Nonaktifkan"} {bulkActionData?.canProcessIds.length} Pengguna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kelas Dialogs */}
      <Dialog open={kelasDialogOpen} onOpenChange={setKelasDialogOpen}>
        <DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>{editingKelas ? "Ubah Kelas" : "Tambah Kelas Baru"}</DialogTitle></DialogHeader><div><Label>Nama Kelas</Label><Input value={kelasForm.nama} onChange={e => setKelasForm({...kelasForm, nama: e.target.value})} className="rounded-xl mt-1" /></div><div><Label>Wali Kelas</Label><Select value={kelasForm.id_guru} onValueChange={v => setKelasForm({...kelasForm, id_guru: v})}><SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Pilih wali kelas (opsional)" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada wali kelas</SelectItem>{guruOptions.map(g => <SelectItem key={g.id_guru} value={g.id_guru.toString()}>{g.nama} (NIK: {g.nik})</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setKelasDialogOpen(false)}>Batal</Button><Button onClick={handleSaveKelas} disabled={isSavingKelas} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">{isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={toggleKelasDialogOpen} onOpenChange={setToggleKelasDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg"><DialogHeader><DialogTitle>{isActivatingKelasMode ? "Aktifkan Kelas" : "Nonaktifkan Kelas"}</DialogTitle><DialogDescription>{isActivatingKelasMode ? `Aktifkan kembali kelas ${togglingKelas?.nama}?` : `Yakin ingin menonaktifkan kelas ${togglingKelas?.nama}?`}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setToggleKelasDialogOpen(false)}>Batal</Button><Button onClick={executeToggleActiveKelas} disabled={isSavingKelas}>{isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isActivatingKelasMode ? "Aktifkan" : "Nonaktifkan"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={importKelasDialogOpen} onOpenChange={setImportKelasDialogOpen}>
        <DialogContent className="rounded-xl max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>Impor Kelas dari Excel</DialogTitle><DialogDescription>Unggah file Excel untuk menambah kelas secara massal</DialogDescription></DialogHeader>
          {importKelasStep === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50"><div className="flex flex-col items-center gap-2"><Upload className="h-8 w-8 text-slate-400" /><label htmlFor="kelas-file-input" className="cursor-pointer"><span className="text-sm font-medium text-blue-600 hover:text-blue-700">Klik untuk unggah</span><input id="kelas-file-input" type="file" accept=".xlsx,.xls" onChange={handleKelasFileUpload} className="hidden" disabled={isImportingKelas} /></label><p className="text-xs text-slate-500">atau tarik & lepas file Excel di sini</p></div></div>
              {importKelasUploadError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{importKelasUploadError}</AlertDescription></Alert>}
              <Button variant="outline" onClick={downloadKelasTemplate} className="w-full"><Download className="h-4 w-4 mr-2" /> Unduh Template Excel Kelas</Button>
              <div className="bg-blue-50 p-3 rounded-lg text-sm"><p className="font-semibold">Format File:</p><p>Kolom yang diperlukan: <strong>nama</strong> (wajib), <strong>nik_wali</strong> (opsional), <strong>aktif</strong> (opsional, 1 untuk aktif)</p><p className="text-xs text-red-600">* NIK wali harus sesuai dengan data guru di database</p></div>
            </div>
          )}
          {importKelasStep === "preview" && importKelasPreviewRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between"><p className="text-sm font-medium">Pratinjau Data ({importKelasPreviewRows.length} baris)</p><Badge>{importKelasPreviewRows.filter(r=>r.isValid).length} dari {importKelasPreviewRows.length} valid</Badge></div>
              <div className="border rounded-lg overflow-x-auto max-h-96"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nama Kelas</TableHead><TableHead>NIK Wali</TableHead><TableHead>Aktif</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{importKelasPreviewRows.map((row,idx)=>(<TableRow key={idx} className={!row.isValid?"bg-red-50":""}><TableCell>{row.rowIndex}</TableCell><TableCell>{row.nama}</TableCell><TableCell>{row.nik_wali||"-"}{!row.guruValid && row.nik_wali && <span className="text-red-500">(tidak ditemukan)</span>}</TableCell><TableCell>{row.aktif ? "Aktif" : "Nonaktif"}</TableCell><TableCell>{row.isValid ? "Valid" : <div className="text-red-600 text-xs">{row.validationErrors.join(", ")}</div>}</TableCell></TableRow>))}</TableBody></Table></div>
              <div className="flex justify-end gap-3"><Button variant="outline" onClick={()=>{setImportKelasDialogOpen(false);setImportKelasRawData([]);setImportKelasPreviewRows([]);setImportKelasStep("upload");}}>Batal</Button><Button onClick={confirmImportKelas} disabled={isImportingKelas || importKelasPreviewRows.filter(r=>r.isValid).length===0} className="bg-gradient-to-r from-blue-600 to-indigo-600">{isImportingKelas && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Impor Data</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={missingGuruDialogOpen} onOpenChange={setMissingGuruDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader><DialogTitle>Wali Kelas Tidak Ditemukan</DialogTitle><DialogDescription>Beberapa NIK wali kelas tidak ditemukan.</DialogDescription></DialogHeader>
          <div className="bg-yellow-50 p-3 rounded-lg"><p className="font-medium">NIK tidak ditemukan:</p><ul className="list-disc list-inside mt-1">{Array.from(importKelasMissingGurus).map(nik=><li key={nik} className="font-mono">{nik}</li>)}</ul><p className="text-sm mt-2">Baris dengan NIK tidak ditemukan akan dilewati. Lanjutkan?</p></div>
          <DialogFooter><Button variant="outline" onClick={() => { setMissingGuruDialogOpen(false); setImportKelasDialogOpen(false); setImportKelasRawData([]); }}>Batalkan Impor</Button><Button onClick={handleSkipMissingGurus} className="bg-green-600">Lanjutkan (Lewati Baris Bermasalah)</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}