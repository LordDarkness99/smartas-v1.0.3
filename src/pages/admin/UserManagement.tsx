// src/pages/admin/UserManagement.tsx
import { useState, useCallback, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";
import * as bcrypt from "bcryptjs";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Upload, Download, AlertCircle, Loader2, Edit, RefreshCw,
  Plus, Sun, Moon, Cloud, Users, School, User, UserCheck,
  Sparkles, Shield, GraduationCap, Search, X, Filter,
  PowerOff, Power, Building2, ChevronDown,
} from "lucide-react";

// ==================== TYPES ====================
interface GuruImportData { nama: string; nik: string; username: string; gender: string; password?: string; nama_jurusan?: string; }
interface SiswaImportData { nama: string; nis: string; username: string; gender: string; kelas: string; password?: string; }
interface BaseUser { id_akun: string; nama: string; username: string; peran: string; aktif: boolean; }
interface GuruData extends BaseUser { id_guru: number; nik: string; gender: string; id_jurusan?: number | null; }
interface SiswaData extends BaseUser { id_siswa: number; nis: string; gender: string; id_kelas: number | null; nama_kelas: string | null; }
interface AdminJurusanData extends BaseUser { id_jurusan: number | null; jurusan_nama: string; }
interface BKData extends BaseUser { }
type UserItem = GuruData | SiswaData | AdminJurusanData | BKData;
interface Kelas { id_kelas: number; nama: string; aktif: boolean; dibuat_pada: string; id_guru: number | null; guru_nama?: string | null; id_jurusan?: number | null; }
interface GuruSimple { id_guru: number; nama: string; nik: string; id_jurusan?: number | null; }
interface Jurusan { id_jurusan: number; nama_jurusan: string; }
type ExcelRow = Record<string, string | number | boolean | null | undefined>;
type KelasWithGuru = {
  id_kelas: number; nama: string; aktif: boolean; dibuat_pada: string;
  id_guru: number | null; guru: { nama: string } | null; id_jurusan?: number | null;
};

// ==================== KOMPONEN UTAMA ====================
export default function UserManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdminSuper = user?.peran === "admin";
  const isAdminJurusan = user?.peran === "admin_jurusan";

  // UI state
  const [activeTab, setActiveTab] = useState<"list" | "kelas">("list");
  const [userType, setUserType] = useState<"guru" | "siswa" | "admin_jurusan" | "bk">("guru");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchKelasQuery, setSearchKelasQuery] = useState("");
  const [filterKelas, setFilterKelas] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessingSelected, setIsProcessingSelected] = useState(false);

  // Data state
  const [totalGuru, setTotalGuru] = useState(0);
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [totalAdminJurusan, setTotalAdminJurusan] = useState(0);
  const [totalBK, setTotalBK] = useState(0);
  const [userList, setUserList] = useState<UserItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [isFetchingKelas, setIsFetchingKelas] = useState(false);
  const [guruOptions, setGuruOptions] = useState<GuruSimple[]>([]);
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

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
    nama: "", username: "", password: "", gender: "", nik: "", nis: "",
    kelas_id: "", peran: "guru" as "guru" | "siswa" | "admin_jurusan" | "bk",
    id_jurusan: "",
  });

  // Edit
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({
    nama: "", username: "", password: "", gender: "", nik: "", nis: "",
    kelas_id: "", peran: "guru" as "guru" | "siswa" | "admin_jurusan" | "bk",
    id_jurusan: "", aktif: true,
  });

  // Deactivate/Activate
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<UserItem | null>(null);
  const [deactivateConstraints, setDeactivateConstraints] = useState<string[]>([]);
  const [isActivatingMode, setIsActivatingMode] = useState(false);

  // Kelas CRUD
  const [kelasDialogOpen, setKelasDialogOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);
  // MODIFIKASI: tambah id_jurusan ke kelasForm
  const [kelasForm, setKelasForm] = useState({ nama: "", id_guru: "", id_jurusan: "" });
  const [isSavingKelas, setIsSavingKelas] = useState(false);
  const [toggleKelasDialogOpen, setToggleKelasDialogOpen] = useState(false);
  const [togglingKelas, setTogglingKelas] = useState<Kelas | null>(null);
  const [isActivatingKelasMode, setIsActivatingKelasMode] = useState(false);

  // Popover wali kelas
  const [openWaliKelas, setOpenWaliKelas] = useState(false);
  const [searchWaliKelas, setSearchWaliKelas] = useState("");

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
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"activate" | "deactivate">("deactivate");
  const [bulkActionData, setBulkActionData] = useState<{
    users: { id_akun: string; nama: string; aktif: boolean }[];
    cannotProcess: { id_akun: string; nama: string; reasons: string[] }[];
    canProcessIds: string[];
  } | null>(null);

  // Jurusan missing saat import admin_jurusan
  const [importJurusanMissing, setImportJurusanMissing] = useState<string[]>([]);
  const [missingJurusanDialogOpen, setMissingJurusanDialogOpen] = useState(false);
  const [isAddingMissingJurusan, setIsAddingMissingJurusan] = useState(false);

  // Kelas missing saat import siswa
  const [importSiswaMissingKelas, setImportSiswaMissingKelas] = useState<string[]>([]);
  const [missingKelasDialogOpen, setMissingKelasDialogOpen] = useState(false);
  const [isAddingMissingKelas, setIsAddingMissingKelas] = useState(false);
  const [selectedJurusanForNewKelas, setSelectedJurusanForNewKelas] = useState<string>("");

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
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };
  const resetPagination = () => setCurrentPage(1);

  // ========== FETCH TOTAL COUNTS ==========
  const fetchTotalCounts = useCallback(async () => {
    try {
      const { count: guruCount } = await supabase
        .from("guru").select("*", { count: "exact", head: true });
      setTotalGuru(guruCount || 0);
      const { count: siswaCount } = await supabase
        .from("siswa").select("*", { count: "exact", head: true });
      setTotalSiswa(siswaCount || 0);
      const { count: adminJurusanCount } = await supabase
        .from("akun").select("*", { count: "exact", head: true }).eq("peran", "admin_jurusan");
      setTotalAdminJurusan(adminJurusanCount || 0);
      const { count: bkCount } = await supabase
        .from("akun").select("*", { count: "exact", head: true }).eq("peran", "bk");
      setTotalBK(bkCount || 0);
    } catch (error) { console.error(error); }
  }, []);

  // ========== FETCH DATA ==========
  const fetchData = useCallback(async () => {
    setIsFetching(true);
    try {
      let data: UserItem[] = [];
      const jurusanFilter = isAdminJurusan && user?.id_jurusan ? user.id_jurusan : null;

      if (userType === "guru") {
        if (!isAdminSuper && !isAdminJurusan) { setUserList([]); setIsFetching(false); return; }
        let query = supabase
          .from("guru")
          .select("id_guru, nama, nik, gender, aktif, id_jurusan")
          .order("nama", { ascending: true });
        if (jurusanFilter) query = query.or(`id_jurusan.eq.${jurusanFilter},id_jurusan.is.null`);
        const { data: guruData, error } = await query;
        if (error) throw error;
        const guruIds = guruData?.map(g => g.id_guru) || [];
        const { data: akunData } = await supabase
          .from("akun").select("id_akun, id_guru, username").in("id_guru", guruIds);
        const akunMap = new Map<number, { id_akun: string; username: string }>();
        akunData?.forEach(akun => akunMap.set(akun.id_guru, { id_akun: akun.id_akun, username: akun.username }));
        data = (guruData || []).map(g => {
          const akun = akunMap.get(g.id_guru);
          return {
            id_akun: akun?.id_akun || "",
            nama: g.nama,
            username: akun?.username || "",
            peran: "guru" as const,
            aktif: g.aktif,
            id_guru: g.id_guru,
            nik: g.nik?.toString() || "",
            gender: g.gender,
            id_jurusan: g.id_jurusan,
          };
        });
      } else if (userType === "siswa") {
        if (!isAdminSuper && !isAdminJurusan) { setUserList([]); setIsFetching(false); return; }
        let siswaQuery = supabase
          .from("siswa")
          .select("id_siswa, nama, nis, gender, aktif, id_kelas")
          .order("nama", { ascending: true });
        if (filterKelas !== "all") {
          if (filterKelas === "unassigned") siswaQuery = siswaQuery.is("id_kelas", null);
          else siswaQuery = siswaQuery.eq("id_kelas", parseInt(filterKelas));
        }
        if (jurusanFilter) {
          const { data: kelasDiJurusan } = await supabase
            .from("kelas").select("id_kelas").eq("id_jurusan", jurusanFilter);
          const kelasIds = kelasDiJurusan?.map(k => k.id_kelas) || [];
          if (kelasIds.length === 0) { setUserList([]); setIsFetching(false); return; }
          siswaQuery = siswaQuery.in("id_kelas", kelasIds);
        }
        const { data: siswaData, error } = await siswaQuery;
        if (error) throw error;
        const siswaIds = siswaData?.map(s => s.id_siswa) || [];
        const { data: akunData } = await supabase
          .from("akun").select("id_akun, id_siswa, username").in("id_siswa", siswaIds);
        const akunMap = new Map<number, { id_akun: string; username: string }>();
        akunData?.forEach(akun => akunMap.set(akun.id_siswa, { id_akun: akun.id_akun, username: akun.username }));
        const kelasIds = siswaData?.map(s => s.id_kelas).filter(Boolean) as number[];
        const kelasMap = new Map<number, string>();
        if (kelasIds.length) {
          const { data: kelasData } = await supabase
            .from("kelas").select("id_kelas, nama").in("id_kelas", kelasIds);
          kelasData?.forEach(k => kelasMap.set(k.id_kelas, k.nama));
        }
        data = (siswaData || []).map(s => {
          const akun = akunMap.get(s.id_siswa);
          return {
            id_akun: akun?.id_akun || "",
            nama: s.nama,
            username: akun?.username || "",
            peran: "siswa" as const,
            aktif: s.aktif,
            id_siswa: s.id_siswa,
            nis: s.nis?.toString() || "",
            gender: s.gender,
            id_kelas: s.id_kelas,
            nama_kelas: s.id_kelas ? kelasMap.get(s.id_kelas) || null : null,
          };
        });
      } else if (userType === "admin_jurusan") {
        if (!isAdminSuper) { setUserList([]); setIsFetching(false); return; }
        const { data: akunData, error } = await supabase
          .from("akun")
          .select("id_akun, nama, username, peran, aktif, id_jurusan")
          .eq("peran", "admin_jurusan")
          .order("nama", { ascending: true });
        if (error) throw error;
        const jurusanIds = akunData?.map(a => a.id_jurusan).filter(Boolean) as number[];
        const jurusanMap = new Map<number, string>();
        if (jurusanIds.length) {
          const { data: jurusanData } = await supabase
            .from("jurusan").select("id_jurusan, nama_jurusan").in("id_jurusan", jurusanIds);
          jurusanData?.forEach(j => jurusanMap.set(j.id_jurusan, j.nama_jurusan));
        }
        data = (akunData || []).map(a => ({
          id_akun: a.id_akun,
          nama: a.nama,
          username: a.username,
          peran: "admin_jurusan" as const,
          aktif: a.aktif,
          id_jurusan: a.id_jurusan,
          jurusan_nama: a.id_jurusan ? jurusanMap.get(a.id_jurusan) || "-" : "-",
        }));
      } else if (userType === "bk") {
        if (!isAdminSuper) { setUserList([]); setIsFetching(false); return; }
        const { data: akunData, error } = await supabase
          .from("akun")
          .select("id_akun, nama, username, peran, aktif")
          .eq("peran", "bk")
          .order("nama", { ascending: true });
        if (error) throw error;
        data = (akunData || []).map(a => ({
          id_akun: a.id_akun,
          nama: a.nama,
          username: a.username,
          peran: "bk" as const,
          aktif: a.aktif,
        }));
      }
      setUserList(data);
      setCurrentPage(1);
    } catch (error: any) {
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsFetching(false);
    }
  }, [userType, filterKelas, isAdminSuper, isAdminJurusan, user?.id_jurusan, toast]);

  const fetchGuruOptions = useCallback(async () => {
    try {
      let query = supabase
        .from("guru")
        .select("id_guru, nama, nik, id_jurusan")
        .eq("aktif", true)
        .order("nama");
      if (isAdminJurusan && user?.id_jurusan) {
        query = query.or(`id_jurusan.eq.${user.id_jurusan},id_jurusan.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      const formatted: GuruSimple[] = (data || []).map((g: any) => ({
        id_guru: g.id_guru, nama: g.nama, nik: g.nik?.toString() || "", id_jurusan: g.id_jurusan,
      }));
      setGuruOptions(formatted);
    } catch (error) { console.error(error); }
  }, [isAdminJurusan, user?.id_jurusan]);

  const fetchKelas = useCallback(async () => {
    setIsFetchingKelas(true);
    try {
      let query = supabase
        .from("kelas")
        .select(`*, guru:guru (nama), id_jurusan`)
        .order("nama");
      if (isAdminJurusan && user?.id_jurusan) query = query.eq("id_jurusan", user.id_jurusan);
      const { data, error } = await query;
      if (error) throw error;
      const formatted: Kelas[] = (data || []).map((item: KelasWithGuru) => ({
        id_kelas: item.id_kelas, nama: item.nama, aktif: item.aktif,
        dibuat_pada: item.dibuat_pada, id_guru: item.id_guru,
        guru_nama: item.guru?.nama || null, id_jurusan: item.id_jurusan,
      }));
      setKelasList(formatted);
    } catch (error) {
      toast({
        title: "Kesalahan",
        description: error instanceof Error ? error.message : "Gagal mengambil data kelas",
        variant: "destructive",
      });
    } finally {
      setIsFetchingKelas(false);
    }
  }, [isAdminJurusan, user?.id_jurusan, toast]);

  const fetchJurusan = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("jurusan")
        .select("id_jurusan, nama_jurusan")
        .eq("aktif", true)
        .order("nama_jurusan");
      if (error) throw error;
      setJurusanList(data || []);
    } catch (error) { console.error(error); }
  }, []);

  const refreshAll = useCallback(() => {
    fetchTotalCounts();
    fetchData();
    fetchGuruOptions();
    fetchKelas();
    fetchJurusan();
  }, [fetchTotalCounts, fetchData, fetchGuruOptions, fetchKelas, fetchJurusan]);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { resetPagination(); }, [searchQuery, filterKelas, userType, itemsPerPage]);

  // ========== FILTER, SORT, PAGINATION ==========
  const filteredUserList = useMemo(() => {
    let filtered = [...userList];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(userItem => {
        if (userItem.nama.toLowerCase().includes(q)) return true;
        if (userItem.username.toLowerCase().includes(q)) return true;
        if (userType === "guru") {
          const guru = userItem as GuruData;
          if (guru.nik && guru.nik.toLowerCase().includes(q)) return true;
        }
        if (userType === "siswa") {
          const siswa = userItem as SiswaData;
          if (siswa.nis && siswa.nis.toLowerCase().includes(q)) return true;
          if (siswa.nama_kelas && siswa.nama_kelas.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    filtered.sort((a, b) => {
      if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
      return a.nama.localeCompare(b.nama);
    });
    return filtered;
  }, [userList, searchQuery, userType]);

  const totalFiltered = filteredUserList.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage);
  const paginatedUserList = filteredUserList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToFirstPage = () => setCurrentPage(1);
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));
  const goToLastPage = () => setCurrentPage(totalPages);
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // ========== UTILITY ==========
  const getNextId = async (table: "guru" | "siswa"): Promise<number> => {
    const idField = table === "guru" ? "id_guru" : "id_siswa";
    const { data, error } = await supabase
      .from(table)
      .select(idField)
      .order(idField, { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return 1;
    return (data[0][idField] as number) + 1;
  };

  // ========== CRUD ==========
  const openAddDialog = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAddForm({
      nama: "", username: "", password: "", gender: "", nik: "", nis: "",
      kelas_id: "", peran: userType, id_jurusan: "",
    });
    setAddDialogOpen(true);
  }, [userType]);

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
    if (addForm.peran !== "bk" && !addForm.gender && addForm.peran !== "admin_jurusan") {
      toast({ title: "Error", description: "Jenis kelamin harus dipilih", variant: "destructive" });
      return;
    }
    if ((addForm.peran === "admin_jurusan" || addForm.peran === "bk") && !isAdminSuper) {
      toast({ title: "Error", description: "Hanya admin super yang dapat menambahkan pengguna sistem", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data: existingUsername } = await supabase
        .from("akun").select("username").eq("username", addForm.username).maybeSingle();
      if (existingUsername) throw new Error("Username sudah digunakan");

      const hashedPassword = await bcrypt.hash(addForm.password || "password123", 10);
      const now = new Date().toISOString();

      if (addForm.peran === "guru") {
        const { data: existingNik } = await supabase
          .from("guru").select("nik").eq("nik", parseInt(addForm.nik)).maybeSingle();
        if (existingNik) throw new Error("NIK sudah digunakan");

        const nextId = await getNextId("guru");
        let jurusanId = null;
        if (isAdminJurusan && user?.id_jurusan) jurusanId = user.id_jurusan;
        else if (addForm.id_jurusan) jurusanId = parseInt(addForm.id_jurusan);

        const { error: guruError } = await supabase.from("guru").insert({
          id_guru: nextId,
          nama: addForm.nama,
          nik: parseInt(addForm.nik),
          gender: addForm.gender.toUpperCase(),
          aktif: true,
          dibuat_pada: now,
          id_jurusan: jurusanId,
        });
        if (guruError) throw guruError;

        const { error: akunError } = await supabase.from("akun").insert({
          nama: addForm.nama,
          username: addForm.username,
          peran: "guru",
          aktif: true,
          dibuat_pada: now,
          id_guru: nextId,
          id_siswa: null,
          kata_sandi: hashedPassword,
        });
        if (akunError) throw akunError;

      } else if (addForm.peran === "siswa") {
        const { data: existingNis } = await supabase
          .from("siswa").select("nis").eq("nis", parseInt(addForm.nis)).maybeSingle();
        if (existingNis) throw new Error("NIS sudah digunakan");

        let kelasId = null;
        if (addForm.kelas_id && addForm.kelas_id !== "none") {
          kelasId = parseInt(addForm.kelas_id);
          if (isAdminJurusan && user?.id_jurusan) {
            const { data: kelas } = await supabase
              .from("kelas").select("id_jurusan").eq("id_kelas", kelasId).single();
            if (!kelas || kelas.id_jurusan !== user.id_jurusan) {
              throw new Error("Kelas tidak berada dalam jurusan Anda");
            }
          }
        }
        const nextId = await getNextId("siswa");

        const { error: siswaError } = await supabase.from("siswa").insert({
          id_siswa: nextId,
          nama: addForm.nama,
          nis: parseInt(addForm.nis),
          gender: addForm.gender.toUpperCase(),
          aktif: true,
          dibuat_pada: now,
          id_kelas: kelasId,
        });
        if (siswaError) throw siswaError;

        const { error: akunError } = await supabase.from("akun").insert({
          nama: addForm.nama,
          username: addForm.username,
          peran: "siswa",
          aktif: true,
          dibuat_pada: now,
          id_guru: null,
          id_siswa: nextId,
          kata_sandi: hashedPassword,
        });
        if (akunError) throw akunError;

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
      refreshAll();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (userItem: UserItem) => {
    if ((userItem.peran === "admin_jurusan" || userItem.peran === "bk") && !isAdminSuper) {
      toast({ title: "Error", description: "Hanya admin super yang dapat mengedit akun sistem", variant: "destructive" });
      return;
    }
    if (userItem.peran === "siswa") {
      toast({ title: "Informasi", description: "Role siswa tidak dapat diubah.", variant: "default" });
    }
    setEditingUser(userItem);
    if (userItem.peran === "guru") {
      const guru = userItem as GuruData;
      setEditForm({
        nama: guru.nama, username: guru.username, password: "", gender: guru.gender,
        nik: guru.nik, nis: "", kelas_id: "", peran: "guru",
        id_jurusan: guru.id_jurusan?.toString() || "", aktif: guru.aktif,
      });
    } else if (userItem.peran === "siswa") {
      const siswa = userItem as SiswaData;
      setEditForm({
        nama: siswa.nama, username: siswa.username, password: "", gender: siswa.gender,
        nik: "", nis: siswa.nis, kelas_id: siswa.id_kelas?.toString() || "",
        peran: "siswa", id_jurusan: "", aktif: siswa.aktif,
      });
    } else if (userItem.peran === "admin_jurusan") {
      const adminJur = userItem as AdminJurusanData;
      setEditForm({
        nama: adminJur.nama, username: adminJur.username, password: "", gender: "",
        nik: "", nis: "", kelas_id: "", peran: "admin_jurusan",
        id_jurusan: adminJur.id_jurusan?.toString() || "", aktif: adminJur.aktif,
      });
    } else if (userItem.peran === "bk") {
      const bk = userItem as BKData;
      setEditForm({
        nama: bk.nama, username: bk.username, password: "", gender: "",
        nik: "", nis: "", kelas_id: "", peran: "bk", id_jurusan: "", aktif: bk.aktif,
      });
    }
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if ((editForm.peran === "admin_jurusan" || editForm.peran === "bk") && !isAdminSuper) {
      toast({ title: "Error", description: "Hanya admin super yang dapat mengubah ke role sistem", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      let query = supabase.from("akun").select("id_akun").eq("username", editForm.username);
      if (editingUser.peran === "guru") query = query.neq("id_guru", (editingUser as GuruData).id_guru);
      else if (editingUser.peran === "siswa") query = query.neq("id_siswa", (editingUser as SiswaData).id_siswa);
      else query = query.neq("id_akun", editingUser.id_akun);
      const { data: existingUsername } = await query;
      if (existingUsername && existingUsername.length) throw new Error("Username sudah digunakan oleh pengguna lain");

      const updateData: any = { nama: editForm.nama, username: editForm.username, aktif: editForm.aktif };
      if (editForm.password.trim()) updateData.kata_sandi = await bcrypt.hash(editForm.password, 10);

      const oldRole = editingUser.peran;
      const newRole = editForm.peran;
      const roleChanged = oldRole !== newRole;

      if (roleChanged) {
        if (oldRole === "siswa" || newRole === "siswa") {
          throw new Error("Role siswa tidak dapat diubah ke role lain, dan role lain tidak dapat diubah menjadi siswa.");
        }
      }

      if (roleChanged) {
        updateData.peran = newRole;
        if (oldRole === "guru") {
          updateData.id_guru = null;
        } else if (oldRole === "siswa") {
          updateData.id_siswa = null;
        } else if (oldRole === "admin_jurusan" || oldRole === "bk") {
          updateData.id_jurusan = null;
        }
      }

      const { error: updateAkunError } = await supabase
        .from("akun")
        .update(updateData)
        .eq("id_akun", editingUser.id_akun);
      if (updateAkunError) throw updateAkunError;

      if (roleChanged) {
        if (oldRole === "guru") {
          const guru = editingUser as GuruData;
          await supabase.from("jadwal").delete().eq("id_guru", guru.id_guru);
          await supabase.from("kelas").update({ id_guru: null }).eq("id_guru", guru.id_guru);
          await supabase.from("pkl").delete().eq("id_guru", guru.id_guru);
          await supabase.from("guru").delete().eq("id_guru", guru.id_guru);
        } 
        else if (oldRole === "siswa") {
          const siswa = editingUser as SiswaData;
          await supabase.from("presensi_harian").delete().eq("id_siswa", siswa.id_siswa);
          await supabase.from("presensi_siswa_mapel").delete().eq("id_siswa", siswa.id_siswa);
          await supabase.from("siswa").delete().eq("id_siswa", siswa.id_siswa);
        }
      }

      if (roleChanged) {
        if (newRole === "guru" && oldRole !== "guru") {
          const nextId = await getNextId("guru");
          const jurusanId = (editForm.id_jurusan && editForm.id_jurusan !== "none") 
            ? parseInt(editForm.id_jurusan) 
            : (isAdminJurusan && user?.id_jurusan ? user.id_jurusan : null);
          await supabase.from("guru").insert({
            id_guru: nextId, nama: editForm.nama, nik: editForm.nik ? parseInt(editForm.nik) : 0,
            gender: editForm.gender?.toUpperCase() || "L", aktif: editForm.aktif,
            dibuat_pada: new Date().toISOString(), id_jurusan: jurusanId,
          });
          await supabase.from("akun").update({ id_guru: nextId }).eq("id_akun", editingUser.id_akun);
        } 
        else if (newRole === "siswa" && oldRole !== "siswa") {
          throw new Error("Tidak dapat mengubah role menjadi siswa.");
        } 
        else if (newRole === "admin_jurusan" && oldRole !== "admin_jurusan") {
          if (editForm.id_jurusan && editForm.id_jurusan !== "none") {
            await supabase.from("akun").update({ id_jurusan: parseInt(editForm.id_jurusan) }).eq("id_akun", editingUser.id_akun);
          }
        }
      } else {
        if (newRole === "admin_jurusan" && editForm.id_jurusan && editForm.id_jurusan !== "none") {
          await supabase.from("akun").update({ id_jurusan: parseInt(editForm.id_jurusan) }).eq("id_akun", editingUser.id_akun);
        }
        if (newRole === "guru") {
          const guru = editingUser as GuruData;
          if (editForm.nik && editForm.nik !== guru.nik) {
            await supabase.from("guru").update({ nik: parseInt(editForm.nik) }).eq("id_guru", guru.id_guru);
          }
          let jurusanId = (editForm.id_jurusan && editForm.id_jurusan !== "none") ? parseInt(editForm.id_jurusan) : (isAdminJurusan && user?.id_jurusan ? user.id_jurusan : null);
          await supabase.from("guru").update({
            nama: editForm.nama, gender: editForm.gender?.toUpperCase(), aktif: editForm.aktif, id_jurusan: jurusanId,
          }).eq("id_guru", guru.id_guru);
        } else if (newRole === "siswa") {
          const siswa = editingUser as SiswaData;
          if (editForm.nis && editForm.nis !== siswa.nis) {
            await supabase.from("siswa").update({ nis: parseInt(editForm.nis) }).eq("id_siswa", siswa.id_siswa);
          }
          let kelasId = (editForm.kelas_id && editForm.kelas_id !== "none") ? parseInt(editForm.kelas_id) : null;
          await supabase.from("siswa").update({
            nama: editForm.nama, gender: editForm.gender?.toUpperCase(), aktif: editForm.aktif, id_kelas: kelasId,
          }).eq("id_siswa", siswa.id_siswa);
        }
      }

      toast({ title: "Berhasil", description: "Data pengguna berhasil diperbarui" });
      setEditDialogOpen(false);
      refreshAll();
    } catch (error: any) {
      console.error("Update user error:", error);
      toast({ title: "Kesalahan", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ========== DEACTIVATE / ACTIVATE ==========
  const checkUserRelatedData = async (userItem: UserItem): Promise<string[]> => {
    const related: string[] = [];
    if (userItem.peran === "guru") {
      const id = (userItem as GuruData).id_guru;
      const { data: jadwalData } = await supabase.from("jadwal").select("id_jadwal").eq("id_guru", id);
      if (jadwalData?.length) related.push(`📚 Memiliki ${jadwalData.length} jadwal mengajar`);
      const { data: kelasData } = await supabase.from("kelas").select("id_kelas").eq("id_guru", id);
      if (kelasData?.length) related.push(`🏫 Menjadi wali kelas untuk ${kelasData.length} kelas`);
      const { data: pklData } = await supabase.from("pkl").select("id_pkl").eq("id_guru", id);
      if (pklData?.length) related.push(`🏢 Membimbing ${pklData.length} PKL`);
    } else if (userItem.peran === "siswa") {
      const id = (userItem as SiswaData).id_siswa;
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
        const id = (deactivatingUser as GuruData).id_guru;
        await supabase.from("guru").update({ aktif: newStatus }).eq("id_guru", id);
        await supabase.from("akun").update({ aktif: newStatus }).eq("id_guru", id);
      } else if (deactivatingUser.peran === "siswa") {
        const id = (deactivatingUser as SiswaData).id_siswa;
        await supabase.from("siswa").update({ aktif: newStatus }).eq("id_siswa", id);
        await supabase.from("akun").update({ aktif: newStatus }).eq("id_siswa", id);
      } else {
        await supabase.from("akun").update({ aktif: newStatus }).eq("id_akun", deactivatingUser.id_akun);
      }
      toast({ title: "Berhasil", description: `Pengguna ${deactivatingUser.nama} telah ${newStatus ? "diaktifkan" : "dinonaktifkan"}.` });
      refreshAll();
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
    if (selectedIds.length === paginatedUserList.length && paginatedUserList.length > 0) setSelectedIds([]);
    else setSelectedIds(paginatedUserList.map(u => u.id_akun));
  };
  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = async (action: "activate" | "deactivate") => {
    if (selectedIds.length === 0) {
      toast({ title: "Tidak ada data dipilih", variant: "destructive" });
      return;
    }
    const usersSelected = selectedIds.map(id_akun => {
      const u = userList.find(u => u.id_akun === id_akun);
      return { id_akun, nama: u?.nama || `ID ${id_akun}`, aktif: u?.aktif ?? false, peran: u?.peran };
    }).filter(u => u.peran) as { id_akun: string; nama: string; aktif: boolean; peran: string }[];
    const cannotProcess: { id_akun: string; nama: string; reasons: string[] }[] = [];
    const canProcessIds: string[] = [];
    if (action === "deactivate") {
      for (const u of usersSelected) {
        if (!u.aktif) continue;
        let reasons: string[] = [];
        if (u.peran === "guru") {
          const guru = userList.find(gu => gu.id_akun === u.id_akun) as GuruData;
          if (guru) {
            const { data: jadwalData } = await supabase.from("jadwal").select("id_jadwal").eq("id_guru", guru.id_guru);
            if (jadwalData?.length) reasons.push(`📚 Memiliki ${jadwalData.length} jadwal`);
            const { data: kelasData } = await supabase.from("kelas").select("id_kelas").eq("id_guru", guru.id_guru);
            if (kelasData?.length) reasons.push(`🏫 Wali kelas ${kelasData.length} kelas`);
            const { data: pklData } = await supabase.from("pkl").select("id_pkl").eq("id_guru", guru.id_guru);
            if (pklData?.length) reasons.push(`🏢 Membimbing ${pklData.length} PKL`);
          }
        } else if (u.peran === "siswa") {
          const siswa = userList.find(s => s.id_akun === u.id_akun) as SiswaData;
          if (siswa) {
            const { data: presHarian } = await supabase.from("presensi_harian").select("id_presensi_harian").eq("id_siswa", siswa.id_siswa);
            if (presHarian?.length) reasons.push(`📅 ${presHarian.length} presensi harian`);
            const { data: presMapel } = await supabase.from("presensi_siswa_mapel").select("id_pre_siswa").eq("id_siswa", siswa.id_siswa);
            if (presMapel?.length) reasons.push(`📖 ${presMapel.length} presensi mapel`);
          }
        }
        if (reasons.length) cannotProcess.push({ id_akun: u.id_akun, nama: u.nama, reasons });
        else canProcessIds.push(u.id_akun);
      }
    } else {
      for (const u of usersSelected) { if (!u.aktif) canProcessIds.push(u.id_akun); }
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
    for (const id_akun of canProcessIds) {
      try {
        const targetUser = userList.find(u => u.id_akun === id_akun);
        if (!targetUser) continue;
        if (targetUser.peran === "guru") {
          const guru = targetUser as GuruData;
          await supabase.from("guru").update({ aktif: newActiveStatus }).eq("id_guru", guru.id_guru);
          await supabase.from("akun").update({ aktif: newActiveStatus }).eq("id_guru", guru.id_guru);
        } else if (targetUser.peran === "siswa") {
          const siswa = targetUser as SiswaData;
          await supabase.from("siswa").update({ aktif: newActiveStatus }).eq("id_siswa", siswa.id_siswa);
          await supabase.from("akun").update({ aktif: newActiveStatus }).eq("id_siswa", siswa.id_siswa);
        } else {
          await supabase.from("akun").update({ aktif: newActiveStatus }).eq("id_akun", id_akun);
        }
        successCount++;
      } catch { failCount++; }
    }
    toast({ title: "Berhasil", description: `${successCount} pengguna berhasil ${bulkActionType === "activate" ? "diaktifkan" : "dinonaktifkan"}${failCount ? `, ${failCount} gagal` : ""}` });
    refreshAll();
    setSelectMode(false);
    setSelectedIds([]);
    setBulkActionDialogOpen(false);
  };

  // ========== KELAS MANAGEMENT (DENGAN JURUSAN) ==========
  // MODIFIKASI: handleAddKelas dengan jurusan default untuk admin jurusan
  const handleAddKelas = () => {
    if (isAdminJurusan && !user?.id_jurusan) {
      toast({ title: "Error", description: "Admin jurusan tidak memiliki jurusan", variant: "destructive" });
      return;
    }
    setEditingKelas(null);
    setKelasForm({
      nama: "",
      id_guru: "",
      id_jurusan: isAdminJurusan && user?.id_jurusan ? user.id_jurusan.toString() : ""
    });
    setKelasDialogOpen(true);
  };

  // MODIFIKASI: handleEditKelas mengambil id_jurusan dari kelas yang diedit
  const handleEditKelas = (kelas: Kelas) => {
    setEditingKelas(kelas);
    setKelasForm({
      nama: kelas.nama,
      id_guru: kelas.id_guru?.toString() || "",
      id_jurusan: kelas.id_jurusan?.toString() || ""
    });
    setKelasDialogOpen(true);
  };

  // MODIFIKASI: handleSaveKelas menyertakan id_jurusan
  const handleSaveKelas = async () => {
    if (!kelasForm.nama.trim()) {
      toast({ title: "Kesalahan", description: "Nama kelas tidak boleh kosong", variant: "destructive" });
      return;
    }
    setIsSavingKelas(true);
    try {
      const data: { nama: string; id_guru: number | null; id_jurusan?: number | null } = {
        nama: kelasForm.nama.trim(),
        id_guru: kelasForm.id_guru ? parseInt(kelasForm.id_guru) : null,
      };

      // Tentukan id_jurusan berdasarkan role
      if (isAdminSuper) {
        // Admin super: pilih dari form (bisa null jika pilih "none")
        data.id_jurusan = kelasForm.id_jurusan ? parseInt(kelasForm.id_jurusan) : null;
      } else if (isAdminJurusan && user?.id_jurusan) {
        // Admin jurusan: otomatis menggunakan jurusannya
        data.id_jurusan = user.id_jurusan;
      }

      if (editingKelas) {
        await supabase.from("kelas").update(data).eq("id_kelas", editingKelas.id_kelas);
        toast({ title: "Berhasil", description: "Kelas berhasil diperbarui" });
      } else {
        await supabase.from("kelas").insert({
          ...data,
          aktif: true,
          dibuat_pada: new Date().toISOString()
        });
        toast({ title: "Berhasil", description: "Kelas baru berhasil ditambahkan" });
      }
      setKelasDialogOpen(false);
      refreshAll();
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
      refreshAll();
    } catch (error) {
      toast({ title: "Kesalahan", description: error instanceof Error ? error.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setIsSavingKelas(false);
      setTogglingKelas(null);
    }
  };

  // ========== IMPORT KELAS ==========
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
      if (!("nama" in jsonData[0])) throw new Error("Kolom 'nama' tidak ditemukan");
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
      if (previewWithValidation.some(p => !p.guruValid && p.nik_wali)) {
        setMissingGuruDialogOpen(true);
      } else {
        setImportKelasStep("preview");
        setImportKelasDialogOpen(true);
      }
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
        const dataInsert: any = { nama: row.nama, id_guru: row.guruId, aktif: row.aktif, dibuat_pada: new Date().toISOString() };
        if (isAdminJurusan && user?.id_jurusan) dataInsert.id_jurusan = user.id_jurusan;
        await supabase.from("kelas").insert(dataInsert);
        successCount++;
      } catch { failCount++; }
    }
    if (successCount > 0) {
      toast({ title: "Impor Selesai", description: `${successCount} kelas berhasil diimpor, ${failCount} gagal.` });
    } else {
      toast({ title: "Impor Gagal", description: "Tidak ada kelas yang berhasil diimpor.", variant: "destructive" });
    }
    refreshAll();
    setImportKelasDialogOpen(false);
    setImportKelasRawData([]);
    setImportKelasPreviewRows([]);
    setImportKelasStep("upload");
    setIsImportingKelas(false);
  };
  const handleSkipMissingGurus = () => {
    const filteredRows = importKelasPreviewRows.map(row => {
      if (!row.guruValid && row.nik_wali) {
        return { ...row, isValid: false, validationErrors: [...row.validationErrors, "NIK wali tidak ditemukan, baris akan dilewati"] };
      }
      return row;
    });
    setImportKelasPreviewRows(filteredRows);
    setMissingGuruDialogOpen(false);
    setImportKelasStep("preview");
    setImportKelasDialogOpen(true);
  };

  // ========== IMPORT EXCEL UNTUK PENGGUNA ==========
  const downloadTemplate = (type: "guru" | "siswa" | "admin_jurusan" | "bk") => {
    let headers: string[];
    let data: (string | number)[][];
    if (type === "guru") {
      headers = ["nama", "nik", "username", "gender", "nama_jurusan", "password"];
      data = [
        ["Ahmad Santoso", "198512342021011001", "ahmad.santoso@school.com", "L", "RPL", "password123"],
        ["Siti Aminah", "198709152021012002", "siti.aminah@school.com", "P", "TKJ", "password123"],
      ];
    } else if (type === "siswa") {
      headers = ["nama", "nis", "username", "gender", "kelas", "password"];
      data = [
        ["Budi Raharjo", "1234567890", "budi.raharjo@student.com", "L", "XII RPL 1", "password123"],
        ["Anisa Fitri", "1234567891", "anisa.fitri@student.com", "P", "XII RPL 2", "password123"],
      ];
    } else if (type === "admin_jurusan") {
      headers = ["nama", "username", "nama_jurusan", "password"];
      data = [
        ["Dr. Ahmad", "ahmad.admin", "RPL", "password123"],
        ["Dra. Siti", "siti.admin", "TKJ", "password123"],
      ];
    } else {
      headers = ["nama", "username", "password"];
      data = [
        ["Bapak Budi BK", "budi.bk", "password123"],
        ["Ibu Ani BK", "ani.bk", "password123"],
      ];
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Template_${type}`);
    XLSX.writeFile(wb, `template_import_${type}.xlsx`);
  };

  const handleUserFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsLoading(true);
    setImportStep("upload");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
      if (jsonData.length === 0) throw new Error("File kosong");

      let requiredColumns: string[];
      if (userType === "guru") requiredColumns = ["nama", "nik", "username", "gender"];
      else if (userType === "siswa") requiredColumns = ["nama", "nis", "username", "gender", "kelas"];
      else if (userType === "admin_jurusan") requiredColumns = ["nama", "username", "nama_jurusan"];
      else requiredColumns = ["nama", "username"];

      const firstRow = jsonData[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRow));
      if (missingColumns.length) throw new Error(`Kolom tidak ditemukan: ${missingColumns.join(", ")}`);

      setImportRawData(jsonData);
      setPreviewData(jsonData);
      setImportStep("preview");
      setImportDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload gagal";
      setUploadError(message);
      setPreviewData([]);
      toast({ title: "Upload Gagal", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (!previewData.length) {
      toast({ title: "Kesalahan", description: "Tidak ada data untuk diimpor", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    let successCount = 0;
    let skipCount = 0;
    const errors: string[] = [];

    try {
      if (userType === "guru") {
        for (const row of previewData) {
          try {
            const nama = row.nama?.toString().trim();
            const nik = row.nik?.toString().trim();
            const username = row.username?.toString().trim();
            const gender = row.gender?.toString().toUpperCase();
            const password = row.password?.toString() || "password123";
            const namaJurusan = row.nama_jurusan?.toString().trim();

            if (!nama || !nik || !username || !gender) {
              skipCount++;
              continue;
            }

            const { data: existingUsername } = await supabase
              .from("akun")
              .select("username")
              .eq("username", username)
              .maybeSingle();
            if (existingUsername) {
              skipCount++;
              continue;
            }

            const { data: existingNik } = await supabase
              .from("guru")
              .select("nik")
              .eq("nik", parseInt(nik))
              .maybeSingle();
            if (existingNik) {
              skipCount++;
              continue;
            }

            let jurusanId = null;
            if (namaJurusan) {
              const { data: jurusan } = await supabase
                .from("jurusan")
                .select("id_jurusan")
                .eq("nama_jurusan", namaJurusan)
                .maybeSingle();
              if (!jurusan) {
                skipCount++;
                continue;
              }
              jurusanId = jurusan.id_jurusan;
            } else if (isAdminJurusan && user?.id_jurusan) {
              jurusanId = user.id_jurusan;
            }

            const nextId = await getNextId("guru");
            const hashedPassword = await bcrypt.hash(password, 10);

            const { error: guruError } = await supabase.from("guru").insert({
              id_guru: nextId,
              nama,
              nik: parseInt(nik),
              gender,
              aktif: true,
              dibuat_pada: new Date().toISOString(),
              id_jurusan: jurusanId,
            });
            if (guruError) throw guruError;

            const { error: akunError } = await supabase.from("akun").insert({
              nama,
              username,
              peran: "guru",
              aktif: true,
              dibuat_pada: new Date().toISOString(),
              id_guru: nextId,
              id_siswa: null,
              kata_sandi: hashedPassword,
            });
            if (akunError) throw akunError;

            successCount++;
          } catch (err) {
            console.error("Gagal import guru:", row, err);
            skipCount++;
            errors.push(`Gagal import baris: ${JSON.stringify(row)} - ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }
      } else if (userType === "siswa") {
        const missingKelasSet = new Set<string>();
        const validRowsTemp: { row: ExcelRow; index: number }[] = [];

        for (let idx = 0; idx < previewData.length; idx++) {
          const row = previewData[idx];
          const kelasNama = row.kelas?.toString().trim();
          if (kelasNama) {
            const { data: kelas } = await supabase
              .from("kelas")
              .select("id_kelas")
              .ilike("nama", kelasNama)
              .maybeSingle();
            if (!kelas) {
              missingKelasSet.add(kelasNama);
            }
          }
        }

        if (missingKelasSet.size > 0) {
          const missingKelasArray = Array.from(missingKelasSet);
          setImportSiswaMissingKelas(missingKelasArray);
          setSelectedJurusanForNewKelas(isAdminJurusan && user?.id_jurusan ? user.id_jurusan.toString() : "");
          setMissingKelasDialogOpen(true);
          setIsLoading(false);
          return;
        }

        for (let idx = 0; idx < previewData.length; idx++) {
          const row = previewData[idx];
          try {
            const nama = row.nama?.toString().trim();
            const nisRaw = row.nis?.toString().trim();
            const username = row.username?.toString().trim();
            const gender = row.gender?.toString().toUpperCase();
            const kelasNama = row.kelas?.toString().trim();
            const password = row.password?.toString() || "password123";

            if (!nama || !nisRaw || !username || !gender || !kelasNama) {
              skipCount++;
              continue;
            }

            const { data: existingUsername } = await supabase
              .from("akun")
              .select("username")
              .eq("username", username)
              .maybeSingle();
            if (existingUsername) {
              skipCount++;
              continue;
            }

            const nisNumber = Number(nisRaw);
            if (isNaN(nisNumber)) {
              skipCount++;
              continue;
            }

            const { data: existingNis } = await supabase
              .from("siswa")
              .select("nis")
              .eq("nis", nisNumber)
              .maybeSingle();
            if (existingNis) {
              skipCount++;
              continue;
            }

            const { data: kelas } = await supabase
              .from("kelas")
              .select("id_kelas, id_jurusan")
              .ilike("nama", kelasNama)
              .maybeSingle();

            if (!kelas) {
              skipCount++;
              continue;
            }

            if (isAdminJurusan && user?.id_jurusan && kelas.id_jurusan !== user.id_jurusan) {
              skipCount++;
              continue;
            }

            const nextId = await getNextId("siswa");
            const hashedPassword = await bcrypt.hash(password, 10);

            const { error: siswaError } = await supabase.from("siswa").insert({
              id_siswa: nextId,
              nama,
              nis: nisNumber,
              gender,
              aktif: true,
              dibuat_pada: new Date().toISOString(),
              id_kelas: kelas.id_kelas,
            });
            if (siswaError) throw siswaError;

            const { error: akunError } = await supabase.from("akun").insert({
              nama,
              username,
              peran: "siswa",
              aktif: true,
              dibuat_pada: new Date().toISOString(),
              id_guru: null,
              id_siswa: nextId,
              kata_sandi: hashedPassword,
            });
            if (akunError) throw akunError;

            successCount++;
          } catch (err) {
            console.error("Gagal import siswa:", row, err);
            skipCount++;
            errors.push(`Gagal import baris: ${JSON.stringify(row)} - ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }
      } else if (userType === "admin_jurusan") {
        const jurusanNames = [...new Set(previewData.map(row => row.nama_jurusan?.toString().trim()).filter(Boolean))];
        if (jurusanNames.length) {
          const { data: existingJurusan } = await supabase
            .from("jurusan")
            .select("nama_jurusan")
            .in("nama_jurusan", jurusanNames);
          const existingNames = existingJurusan?.map(j => j.nama_jurusan) || [];
          const missingJurusan = jurusanNames.filter(n => !existingNames.includes(n));
          if (missingJurusan.length > 0) {
            setImportJurusanMissing(missingJurusan);
            setMissingJurusanDialogOpen(true);
            setIsLoading(false);
            return;
          }
        }

        for (const row of previewData) {
          try {
            const nama = row.nama?.toString().trim();
            const username = row.username?.toString().trim();
            const namaJurusan = row.nama_jurusan?.toString().trim();
            const password = row.password?.toString() || "password123";

            if (!nama || !username || !namaJurusan) {
              skipCount++;
              continue;
            }

            const { data: existingUsername } = await supabase
              .from("akun")
              .select("username")
              .eq("username", username)
              .maybeSingle();
            if (existingUsername) {
              skipCount++;
              continue;
            }

            const { data: jurusan } = await supabase
              .from("jurusan")
              .select("id_jurusan")
              .eq("nama_jurusan", namaJurusan)
              .single();
            if (!jurusan) {
              skipCount++;
              continue;
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await supabase.from("akun").insert({
              nama,
              username,
              peran: "admin_jurusan",
              aktif: true,
              dibuat_pada: new Date().toISOString(),
              id_guru: null,
              id_siswa: null,
              id_jurusan: jurusan.id_jurusan,
              kata_sandi: hashedPassword,
            });
            successCount++;
          } catch (err) {
            console.error("Gagal import admin_jurusan:", row, err);
            skipCount++;
            errors.push(`Gagal import baris: ${JSON.stringify(row)} - ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }
      } else if (userType === "bk") {
        for (const row of previewData) {
          try {
            const nama = row.nama?.toString().trim();
            const username = row.username?.toString().trim();
            const password = row.password?.toString() || "password123";

            if (!nama || !username) {
              skipCount++;
              continue;
            }

            const { data: existingUsername } = await supabase
              .from("akun")
              .select("username")
              .eq("username", username)
              .maybeSingle();
            if (existingUsername) {
              skipCount++;
              continue;
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await supabase.from("akun").insert({
              nama,
              username,
              peran: "bk",
              aktif: true,
              dibuat_pada: new Date().toISOString(),
              id_guru: null,
              id_siswa: null,
              id_jurusan: null,
              kata_sandi: hashedPassword,
            });
            successCount++;
          } catch (err) {
            console.error("Gagal import bk:", row, err);
            skipCount++;
            errors.push(`Gagal import baris: ${JSON.stringify(row)} - ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }
      }

      if (errors.length > 0 && process.env.NODE_ENV === "development") {
        console.error("Import errors:", errors);
      }

      toast({
        title: "Impor Selesai",
        description: `${successCount} data berhasil diimpor, ${skipCount} data gagal/duplikat.`,
      });
      setImportDialogOpen(false);
      setPreviewData([]);
      setImportRawData([]);
      setImportStep("upload");
      refreshAll();
    } catch (error: any) {
      toast({ title: "Impor Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const addMissingKelasAndContinue = async () => {
    if (importSiswaMissingKelas.length === 0) return;
    setIsAddingMissingKelas(true);
    let addedCount = 0;
    try {
      let jurusanId: number | null = null;
      if (isAdminJurusan && user?.id_jurusan) {
        jurusanId = user.id_jurusan;
      } else if (isAdminSuper && selectedJurusanForNewKelas && selectedJurusanForNewKelas !== "none") {
        jurusanId = parseInt(selectedJurusanForNewKelas);
      }

      for (const namaKelas of importSiswaMissingKelas) {
        const { data: existing } = await supabase
          .from("kelas")
          .select("id_kelas")
          .ilike("nama", namaKelas)
          .maybeSingle();
        if (!existing) {
          await supabase.from("kelas").insert({
            nama: namaKelas,
            aktif: true,
            dibuat_pada: new Date().toISOString(),
            id_jurusan: jurusanId,
            id_guru: null,
          });
          addedCount++;
        }
      }
      toast({ title: "Berhasil", description: `${addedCount} kelas berhasil ditambahkan.` });
      setMissingKelasDialogOpen(false);
      setImportSiswaMissingKelas([]);
      await handleImport();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsAddingMissingKelas(false);
    }
  };

  const continueImportAfterMissingJurusan = async () => {
    if (importJurusanMissing.length === 0) return;
    setIsAddingMissingJurusan(true);
    let addedCount = 0;
    try {
      for (const namaJurusan of importJurusanMissing) {
        const { data: existing } = await supabase
          .from("jurusan")
          .select("id_jurusan")
          .eq("nama_jurusan", namaJurusan)
          .maybeSingle();
        if (!existing) {
          await supabase.from("jurusan").insert({
            nama_jurusan: namaJurusan, aktif: true, dibuat_pada: new Date().toISOString(),
          });
          addedCount++;
        }
      }
      toast({ title: "Berhasil", description: `${addedCount} jurusan berhasil ditambahkan.` });
      setMissingJurusanDialogOpen(false);
      setImportJurusanMissing([]);
      await handleImport();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message, variant: "destructive" });
    } finally {
      setIsAddingMissingJurusan(false);
    }
  };

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-[#F0F7FC]">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2C5EAD] via-[#1591DC] to-[#4BB8FA] shadow-xl mx-4 mt-4">
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <div className="relative container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 p-2 sm:p-3 rounded-xl backdrop-blur-sm">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  {greeting === "Selamat Pagi" ? <Sun className="h-3 w-3 sm:h-4 sm:w-4" /> : greeting === "Selamat Malam" ? <Moon className="h-3 w-3 sm:h-4 sm:w-4" /> : <Cloud className="h-3 w-3 sm:h-4 sm:w-4" />}
                  <p className="text-xs sm:text-sm">{greeting}</p>
                </div>
                <h1 className="text-base sm:text-2xl lg:text-3xl font-bold text-white leading-tight">
                  Manajemen Data Pengguna &amp; Kelas
                </h1>
                <p className="text-blue-100 text-xs sm:text-sm">
                  {isAdminSuper
                    ? "Kelola semua pengguna dan kelas"
                    : isAdminJurusan
                    ? "Kelola guru, siswa, dan kelas dalam jurusan Anda"
                    : "Manajemen data"}
                </p>
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
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Guru</p><p className="text-lg sm:text-2xl font-bold text-slate-800">{totalGuru}</p></div>
                <div className="p-2 rounded-full bg-[#C4E2F5]"><User className="h-5 w-5 text-[#2C5EAD]" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Siswa</p><p className="text-lg sm:text-2xl font-bold text-slate-800">{totalSiswa}</p></div>
                <div className="p-2 rounded-full bg-emerald-100"><GraduationCap className="h-5 w-5 text-emerald-600" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">Admin Jurusan</p><p className="text-lg sm:text-2xl font-bold text-slate-800">{totalAdminJurusan}</p></div>
                <div className="p-2 rounded-full bg-purple-100"><Building2 className="h-5 w-5 text-purple-600" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-slate-100 bg-white shadow-lg hover:shadow-xl transition-all">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] sm:text-xs text-slate-500 font-medium">BK</p><p className="text-lg sm:text-2xl font-bold text-slate-800">{totalBK}</p></div>
                <div className="p-2 rounded-full bg-amber-100"><Shield className="h-5 w-5 text-amber-600" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-[#1591DC] text-white p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-xl"><Shield className="h-5 w-5 sm:h-6 sm:w-6" /></div>
              <div><CardTitle className="text-base sm:text-xl">Manajemen Pengguna &amp; Kelas</CardTitle><CardDescription className="text-blue-100 text-xs sm:text-sm">Kelola semua jenis pengguna dan kelas sesuai hak akses</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "list" | "kelas")} className="space-y-4 sm:space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-[#2C5EAD] p-1 rounded-xl">
                  <TabsTrigger value="list" className="rounded-lg text-white/80 data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] text-xs sm:text-sm px-3 sm:px-4"><Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> Daftar Pengguna</TabsTrigger>
                  <TabsTrigger value="kelas" className="rounded-lg text-white/80 data-[state=active]:bg-white data-[state=active]:text-[#2C5EAD] text-xs sm:text-sm px-3 sm:px-4"><School className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" /> Kelola Kelas</TabsTrigger>
                </TabsList>
              </div>

              {/* TAB DAFTAR PENGGUNA */}
              <TabsContent value="list" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-start">
                    <Select value={userType} onValueChange={(v) => { setUserType(v as any); resetPagination(); }} disabled={isAdminJurusan && (userType === "admin_jurusan" || userType === "bk")}>
                      <SelectTrigger className="w-[180px] rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD]/20 focus:ring-[#2C5EAD]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guru">Guru</SelectItem><SelectItem value="siswa">Siswa</SelectItem>
                        {isAdminSuper && <SelectItem value="admin_jurusan">Admin Jurusan</SelectItem>}
                        {isAdminSuper && <SelectItem value="bk">BK</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
                    <Button onClick={openAddDialog} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-[#2C5EAD] to-[#1591DC] w-full"><Plus className="mr-1 h-3 w-3" /> Tambah</Button>
                    <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white w-full"><Upload className="mr-1 h-3 w-3" /> Impor</Button>
                    <Button variant="outline" onClick={refreshAll} disabled={isFetching} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white w-full"><RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? "animate-spin" : ""}`} /> Segarkan</Button>
                  </div>
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#2C5EAD] to-[#1591DC] rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-200"></div>
                    <div className="relative bg-white rounded-xl shadow-md hover:shadow-lg transition-all">
                      <div className="flex items-center p-1">
                        <div className="pl-3 pr-1"><Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-[#2C5EAD] transition-colors" /></div>
                        <Input placeholder="Cari berdasarkan nama, username, NIK, NIS, atau kelas..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none rounded-xl h-9 sm:h-10 text-xs sm:text-sm w-full bg-transparent" />
                        {searchQuery && <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="mr-2 p-1 rounded-full hover:bg-slate-100"><X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 hover:text-slate-600" /></button>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                    <Button variant={selectMode ? "default" : "outline"} onClick={toggleSelectMode} className={`rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-auto ${selectMode ? "bg-[#2C5EAD] hover:bg-[#2C5EAD]/80" : "border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"}`}>{selectMode ? "Batalkan Mode Pilih" : "Mode Pilih"}</Button>
                    {selectMode && <div className="flex gap-2 w-full sm:w-auto justify-center"><Button onClick={() => handleBulkAction("activate")} disabled={selectedIds.length === 0} className="bg-green-600 hover:bg-green-700 rounded-xl text-xs">Aktifkan ({selectedIds.filter(id => !userList.find(u => u.id_akun === id)?.aktif).length})</Button><Button variant="destructive" onClick={() => handleBulkAction("deactivate")} disabled={selectedIds.length === 0} className="rounded-xl text-xs">Nonaktifkan ({selectedIds.filter(id => userList.find(u => u.id_akun === id)?.aktif).length})</Button></div>}
                  </div>
                </div>
                {isFetching ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#2C5EAD]" /></div> : (
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow className="bg-slate-50">
                          {selectMode && <TableHead className="w-10"><Checkbox checked={selectedIds.length === paginatedUserList.length && paginatedUserList.length > 0} onCheckedChange={handleSelectAll} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD]" /></TableHead>}
                          <TableHead>Nama</TableHead><TableHead>Nama Pengguna</TableHead>
                          {userType === "guru" && <TableHead>NIK</TableHead>}{userType === "guru" && <TableHead>Jurusan</TableHead>}
                          {userType === "siswa" && <TableHead>NIS</TableHead>}{userType === "siswa" && <TableHead>Kelas</TableHead>}
                          {userType === "admin_jurusan" && <TableHead>Jurusan</TableHead>}
                          <TableHead>Status</TableHead><TableHead className="text-center">Aksi</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {paginatedUserList.map(item => {
                            const isGuru = item.peran === "guru", isSiswa = item.peran === "siswa", isAdminJur = item.peran === "admin_jurusan";
                            return (<TableRow key={item.id_akun} className="hover:bg-slate-50">
                              {selectMode && <TableCell><Checkbox checked={selectedIds.includes(item.id_akun)} onCheckedChange={() => handleSelectItem(item.id_akun)} className="data-[state=checked]:bg-[#2C5EAD] data-[state=checked]:border-[#2C5EAD]" /></TableCell>}
                              <TableCell className="whitespace-nowrap">{item.nama}</TableCell><TableCell className="break-all min-w-[180px]">{item.username}</TableCell>
                              {isGuru && <TableCell>{(item as GuruData).nik}</TableCell>}
                              {isGuru && <TableCell>{(item as GuruData).id_jurusan ? jurusanList.find(j => j.id_jurusan === (item as GuruData).id_jurusan)?.nama_jurusan || "-" : "-"}</TableCell>}
                              {isSiswa && <TableCell>{(item as SiswaData).nis}</TableCell>}
                              {isSiswa && <TableCell>{(item as SiswaData).nama_kelas || "-"}</TableCell>}
                              {isAdminJur && <TableCell>{(item as AdminJurusanData).jurusan_nama || "-"}</TableCell>}
                              <TableCell><Badge className={item.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{item.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell>
                              <TableCell className="text-center"><div className="flex gap-1 justify-center"><Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}><Edit className="h-4 w-4 text-[#2C5EAD]" /></Button>{item.aktif ? <Button variant="ghost" size="sm" onClick={() => confirmDeactivate(item)}><PowerOff className="h-4 w-4 text-red-500" /></Button> : <Button variant="ghost" size="sm" onClick={() => confirmActivate(item)}><Power className="h-4 w-4 text-green-500" /></Button>}</div></TableCell>
                            </TableRow>);
                          })}
                          {paginatedUserList.length === 0 && <TableRow><TableCell colSpan={selectMode ? 10 : 9} className="text-center py-8 text-slate-500"><Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />Tidak ada data</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                {totalFiltered > 0 && (
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2"><span className="text-xs text-slate-600">Tampilkan</span><Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}><SelectTrigger className="w-[70px] h-8 text-xs bg-white border-slate-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select><span className="text-xs text-slate-600">per halaman</span></div>
                    <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1} className="h-8 w-8 p-0 rounded-lg border-slate-200 hover:bg-slate-100"><ChevronsLeft className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage === 1} className="h-8 w-8 p-0 rounded-lg border-slate-200 hover:bg-slate-100"><ChevronLeft className="h-3.5 w-3.5" /></Button><div className="flex items-center gap-1 px-2"><span className="text-sm font-medium text-slate-700">{currentPage}</span><span className="text-xs text-slate-400">/</span><span className="text-sm text-slate-500">{totalPages || 1}</span></div><Button variant="outline" size="sm" onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0} className="h-8 w-8 p-0 rounded-lg border-slate-200 hover:bg-slate-100"><ChevronRight className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage === totalPages || totalPages === 0} className="h-8 w-8 p-0 rounded-lg border-slate-200 hover:bg-slate-100"><ChevronsRight className="h-3.5 w-3.5" /></Button></div>
                    <div className="text-xs text-slate-500">Menampilkan <span className="font-medium text-slate-700">{totalFiltered === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-medium text-slate-700">{Math.min(currentPage * itemsPerPage, totalFiltered)}</span> dari <span className="font-medium text-slate-700">{totalFiltered}</span> data</div>
                  </div>
                )}
              </TabsContent>

              {/* TAB KELAS - DENGAN KOLOM JURUSAN */}
              <TabsContent value="kelas" className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start"><Button onClick={handleAddKelas} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm bg-gradient-to-r from-[#2C5EAD] to-[#1591DC]"><Plus className="mr-1 h-3 w-3" /> Tambah Kelas</Button><Button variant="outline" onClick={() => setImportKelasDialogOpen(true)} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"><Upload className="mr-1 h-3 w-3" /> Impor Excel</Button></div>
                  <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><Input placeholder="Cari kelas..." value={searchKelasQuery} onChange={(e) => setSearchKelasQuery(e.target.value)} className="pl-9 pr-8 rounded-xl h-8 sm:h-9 text-xs sm:text-sm w-full" />{searchKelasQuery && <button onClick={() => setSearchKelasQuery("")} className="absolute right-3 top-1/2"><X className="h-3.5 w-3.5" /></button>}</div>
                  <Button variant="outline" onClick={refreshAll} disabled={isFetchingKelas} className="rounded-xl h-8 sm:h-9 text-xs sm:text-sm border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"><RefreshCw className={`mr-1 h-3 w-3 ${isFetchingKelas ? "animate-spin" : ""}`} /> Segarkan</Button>
                </div>
                {isFetchingKelas ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#2C5EAD]" /></div> : (
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead>Nama Kelas</TableHead>
                            <TableHead>Wali Kelas</TableHead>
                            <TableHead>Jurusan</TableHead>  {/* KOLOM BARU */}
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kelasList.filter(k => !searchKelasQuery || k.nama.toLowerCase().includes(searchKelasQuery.toLowerCase())).map(kelas => (
                            <TableRow key={kelas.id_kelas}>
                              <TableCell className="font-medium">{kelas.nama}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="bg-purple-100 p-1.5 rounded-lg"><User className="h-3 w-3 text-purple-600" /></div>
                                  {kelas.guru_nama || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {jurusanList.find(j => j.id_jurusan === kelas.id_jurusan)?.nama_jurusan || "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={kelas.aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                                  {kelas.aktif ? "Aktif" : "Nonaktif"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditKelas(kelas)}><Edit className="h-4 w-4 text-[#2C5EAD]" /></Button>
                                  {kelas.aktif ? 
                                    <Button variant="ghost" size="sm" onClick={() => confirmToggleActiveKelas(kelas, false)}><PowerOff className="h-4 w-4 text-red-500" /></Button> : 
                                    <Button variant="ghost" size="sm" onClick={() => confirmToggleActiveKelas(kelas, true)}><Power className="h-4 w-4 text-green-500" /></Button>
                                  }
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {kelasList.filter(k => !searchKelasQuery || k.nama.toLowerCase().includes(searchKelasQuery.toLowerCase())).length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada data kelas</TableCell></TableRow>}
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
        <Card className="rounded-xl border-0 shadow-lg bg-gradient-to-br from-[#C4E2F5]/50 to-[#4BB8FA]/20 max-w-3xl mx-auto">
          <CardContent className="p-4 sm:p-5"><div className="flex gap-3"><div className="bg-[#2C5EAD]/10 p-2 rounded-xl"><Sparkles className="h-5 w-5 text-[#2C5EAD]" /></div><div><h3 className="font-semibold text-sm">Tips Mengelola Data</h3><p className="text-xs text-slate-600">Gunakan impor Excel untuk data massal. {isAdminJurusan ? "Anda hanya dapat mengelola guru, siswa, dan kelas dalam jurusan Anda." : "Admin super dapat mengelola semua jenis pengguna."}</p></div></div></CardContent>
        </Card>
        <div className="text-center pt-4"><Separator className="mb-4" /><p className="text-xs text-slate-400">© {new Date().getFullYear()} Manajemen Pengguna &amp; Kelas - SmartAS</p></div>
      </div>

      {/* DIALOG TAMBAH USER (tidak berubah) */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader><DialogTitle><Plus className="h-5 w-5 inline mr-2 text-emerald-600" /> Tambah {addForm.peran === "guru" ? "Guru" : addForm.peran === "siswa" ? "Siswa" : addForm.peran === "admin_jurusan" ? "Admin Jurusan" : "BK"}</DialogTitle><DialogDescription>Isi data pengguna baru. Kata sandi default "password123".</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nama Lengkap</Label><Input value={addForm.nama} onChange={e => setAddForm({ ...addForm, nama: e.target.value })} className="rounded-xl" /></div>
            <div><Label>Nama Pengguna</Label><Input value={addForm.username} onChange={e => setAddForm({ ...addForm, username: e.target.value })} className="rounded-xl" /></div>
            {addForm.peran !== "bk" && addForm.peran !== "admin_jurusan" && <div><Label>Jenis Kelamin</Label><Select value={addForm.gender} onValueChange={v => setAddForm({ ...addForm, gender: v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih jenis kelamin" /></SelectTrigger><SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></div>}
            {addForm.peran === "guru" && <div><Label>NIK</Label><Input value={addForm.nik} onChange={e => setAddForm({ ...addForm, nik: e.target.value })} className="rounded-xl" /></div>}
            {addForm.peran === "guru" && isAdminSuper && <div><Label>Jurusan</Label><Select value={addForm.id_jurusan} onValueChange={v => setAddForm({ ...addForm, id_jurusan: v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih jurusan (opsional)" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada</SelectItem>{jurusanList.map(j => <SelectItem key={j.id_jurusan} value={j.id_jurusan.toString()}>{j.nama_jurusan}</SelectItem>)}</SelectContent></Select></div>}
            {addForm.peran === "siswa" && <div><Label>NIS</Label><Input value={addForm.nis} onChange={e => setAddForm({ ...addForm, nis: e.target.value })} className="rounded-xl" /></div>}
            {addForm.peran === "siswa" && <div><Label>Kelas</Label><Select value={addForm.kelas_id} onValueChange={v => setAddForm({ ...addForm, kelas_id: v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih kelas (opsional)" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada kelas</SelectItem>{kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}</SelectContent></Select></div>}
            {addForm.peran === "admin_jurusan" && <div><Label>Jurusan</Label><Select value={addForm.id_jurusan || "none"} onValueChange={v => setAddForm({ ...addForm, id_jurusan: v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih jurusan" /></SelectTrigger><SelectContent><SelectItem value="none" disabled>Pilih jurusan</SelectItem>{jurusanList.map(j => <SelectItem key={j.id_jurusan} value={j.id_jurusan.toString()}>{j.nama_jurusan}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label>Kata Sandi (opsional)</Label><Input type="password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} className="rounded-xl" placeholder="Kosongkan untuk default: password123" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddDialogOpen(false)} className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button><Button onClick={handleAddUser} disabled={isLoading} className="rounded-xl bg-gradient-to-r from-[#2C5EAD] to-[#1591DC]">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDIT USER (tidak berubah) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm p-4 max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle><Edit className="h-5 w-5 inline mr-2 text-blue-600" /> Edit Pengguna</DialogTitle><DialogDescription>Ubah informasi pengguna. Kosongkan kata sandi jika tidak ingin mengubah.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nama</Label><Input value={editForm.nama} onChange={e => setEditForm({ ...editForm, nama: e.target.value })} className="rounded-lg text-sm h-9" /></div>
            <div><Label className="text-xs">Nama Pengguna</Label><Input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} className="rounded-lg text-sm h-9" /></div>
            {editForm.peran !== "bk" && editForm.peran !== "admin_jurusan" && <div><Label className="text-xs">Jenis Kelamin</Label><Select value={editForm.gender} onValueChange={v => setEditForm({ ...editForm, gender: v })}><SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="L">Laki-laki</SelectItem><SelectItem value="P">Perempuan</SelectItem></SelectContent></Select></div>}
            {editForm.peran === "guru" && <div><Label className="text-xs">NIK</Label><Input value={editForm.nik} onChange={e => setEditForm({ ...editForm, nik: e.target.value })} className="rounded-lg text-sm h-9" /></div>}
            {editForm.peran === "guru" && isAdminSuper && <div><Label className="text-xs">Jurusan</Label><Select value={editForm.id_jurusan} onValueChange={v => setEditForm({ ...editForm, id_jurusan: v })}><SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Pilih jurusan" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada</SelectItem>{jurusanList.map(j => <SelectItem key={j.id_jurusan} value={j.id_jurusan.toString()}>{j.nama_jurusan}</SelectItem>)}</SelectContent></Select></div>}
            {editForm.peran === "siswa" && (<><div><Label className="text-xs">NIS</Label><Input value={editForm.nis} onChange={e => setEditForm({ ...editForm, nis: e.target.value })} className="rounded-lg text-sm h-9" /></div><div><Label className="text-xs">Kelas</Label><Select value={editForm.kelas_id} onValueChange={v => setEditForm({ ...editForm, kelas_id: v })}><SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Pilih kelas" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ada kelas</SelectItem>{kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}</SelectContent></Select></div></>)}
            {editForm.peran === "admin_jurusan" && <div><Label className="text-xs">Jurusan</Label><Select value={editForm.id_jurusan || "none"} onValueChange={v => setEditForm({ ...editForm, id_jurusan: v })}><SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue placeholder="Pilih jurusan" /></SelectTrigger><SelectContent><SelectItem value="none" disabled>Pilih jurusan</SelectItem>{jurusanList.map(j => <SelectItem key={j.id_jurusan} value={j.id_jurusan.toString()}>{j.nama_jurusan}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label className="text-xs">Role</Label><Select value={editForm.peran} onValueChange={v => setEditForm({ ...editForm, peran: v as any })} disabled={!isAdminSuper || editingUser?.peran === "siswa"}><SelectTrigger className="rounded-lg h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guru">Guru</SelectItem><SelectItem value="siswa">Siswa</SelectItem>{isAdminSuper && <SelectItem value="admin_jurusan">Admin Jurusan</SelectItem>}{isAdminSuper && <SelectItem value="bk">BK</SelectItem>}</SelectContent></Select></div>
            <div><Label className="text-xs">Kata Sandi Baru (Opsional)</Label><Input type="password" placeholder="Kosongkan jika tidak ingin mengubah" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} className="rounded-lg text-sm h-9" /></div>
            <div className="flex items-center space-x-2"><Checkbox id="edit_aktif" checked={editForm.aktif} onCheckedChange={(checked) => setEditForm({ ...editForm, aktif: checked === true })} /><Label htmlFor="edit_aktif" className="text-xs">Aktif (centang agar pengguna dapat login)</Label></div>
          </div>
          <DialogFooter className="mt-3 gap-2"><Button variant="outline" onClick={() => setEditDialogOpen(false)} className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white rounded-lg text-xs h-8">Batal</Button><Button onClick={handleUpdateUser} disabled={isLoading} className="rounded-lg text-xs h-8 bg-gradient-to-r from-[#2C5EAD] to-[#1591DC]">{isLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DEACTIVATE / ACTIVATE (tidak berubah) */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>{isActivatingMode ? "Aktifkan Pengguna" : "Nonaktifkan Pengguna"}</DialogTitle><DialogDescription>{isActivatingMode ? `Aktifkan kembali ${deactivatingUser?.nama}?` : `Yakin ingin menonaktifkan ${deactivatingUser?.nama}?`}</DialogDescription></DialogHeader>
          {!isActivatingMode && deactivateConstraints.length > 0 && <div className="bg-amber-50 border p-3 rounded-lg"><p className="font-medium text-amber-800">Data terkait:</p><ul className="list-disc list-inside text-xs">{deactivateConstraints.map((c, i) => <li key={i}>{c}</li>)}</ul><p className="text-xs mt-1">Pengguna akan dinonaktifkan, namun data terkait tetap tersimpan.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setDeactivateDialogOpen(false)} className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button><Button variant={isActivatingMode ? "default" : "destructive"} onClick={executeToggleActive} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isActivatingMode ? "Aktifkan" : "Nonaktifkan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG BULK ACTION (tidak berubah) */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle>{bulkActionType === "activate" ? "Aktifkan Massal" : "Nonaktifkan Massal"}</DialogTitle><DialogDescription>Anda akan {bulkActionType === "activate" ? "mengaktifkan" : "menonaktifkan"} {bulkActionData?.users.length} pengguna.</DialogDescription></DialogHeader>
          {bulkActionData && bulkActionData.cannotProcess.length > 0 && <div className="bg-amber-50 border p-3 rounded-lg"><p className="font-medium text-amber-800">⚠️ Beberapa pengguna memiliki data terkait:</p><ul className="list-disc list-inside text-xs">{bulkActionData.cannotProcess.map(c => <li key={c.id_akun}>{c.nama}: {c.reasons.join(", ")}</li>)}</ul><p className="text-xs mt-1">Tetap dapat dinonaktifkan, data terkait tetap tersimpan.</p></div>}
          <DialogFooter><Button variant="outline" onClick={() => setBulkActionDialogOpen(false)} className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button><Button variant={bulkActionType === "activate" ? "default" : "destructive"} onClick={executeBulkAction} disabled={isProcessingSelected}>{isProcessingSelected && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ya, {bulkActionType === "activate" ? "Aktifkan" : "Nonaktifkan"} {bulkActionData?.canProcessIds.length} Pengguna</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG KELAS (DENGAN JURUSAN) */}
      <Dialog open={kelasDialogOpen} onOpenChange={setKelasDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>{editingKelas ? "Ubah Kelas" : "Tambah Kelas Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-700 font-medium text-xs sm:text-sm">Nama Kelas</Label>
              <Input
                value={kelasForm.nama}
                onChange={(e) => setKelasForm({ ...kelasForm, nama: e.target.value })}
                className="rounded-lg border-slate-200 h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-slate-700 font-medium text-xs sm:text-sm">Wali Kelas</Label>
              <Popover open={openWaliKelas} onOpenChange={setOpenWaliKelas}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between rounded-lg border-slate-200 h-9 text-sm font-normal mt-1"
                  >
                    {kelasForm.id_guru && kelasForm.id_guru !== "none"
                      ? guruOptions.find((g) => g.id_guru.toString() === kelasForm.id_guru)?.nama ||
                        "Pilih Wali Kelas"
                      : "Tidak ada wali kelas"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start" sideOffset={5}>
                  <div className="p-2 border-b bg-slate-50">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Cari guru (nama atau NIK)..."
                        value={searchWaliKelas}
                        onChange={(e) => setSearchWaliKelas(e.target.value)}
                        className="pl-7 h-8 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        setKelasForm({ ...kelasForm, id_guru: "" });
                        setOpenWaliKelas(false);
                        setSearchWaliKelas("");
                      }}
                    >
                      Tidak ada wali kelas
                    </button>
                    {guruOptions
                      .filter(
                        (g) =>
                          g.nama.toLowerCase().includes(searchWaliKelas.toLowerCase()) ||
                          g.nik.toLowerCase().includes(searchWaliKelas.toLowerCase())
                      )
                      .map((guru) => (
                        <button
                          key={guru.id_guru}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                            kelasForm.id_guru === guru.id_guru.toString()
                              ? "bg-[#C4E2F5] text-[#2C5EAD] font-medium"
                              : ""
                          }`}
                          onClick={() => {
                            setKelasForm({ ...kelasForm, id_guru: guru.id_guru.toString() });
                            setOpenWaliKelas(false);
                            setSearchWaliKelas("");
                          }}
                        >
                          {guru.nama} {guru.nik ? `(${guru.nik})` : ""}
                        </button>
                      ))}
                    {guruOptions.filter(
                      (g) =>
                        g.nama.toLowerCase().includes(searchWaliKelas.toLowerCase()) ||
                        g.nik.toLowerCase().includes(searchWaliKelas.toLowerCase())
                    ).length === 0 && searchWaliKelas && (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">
                        Tidak ada guru yang cocok
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {/* DROPDOWN JURUSAN - HANYA UNTUK ADMIN SUPER */}
            {isAdminSuper && (
              <div>
                <Label className="text-slate-700 font-medium text-xs sm:text-sm">Jurusan</Label>
                <Select
                  value={kelasForm.id_jurusan || "none"}
                  onValueChange={(value) => setKelasForm({ ...kelasForm, id_jurusan: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="rounded-lg border-slate-200 h-9 text-sm mt-1">
                    <SelectValue placeholder="Pilih jurusan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Jurusan</SelectItem>
                    {jurusanList.map((jurusan) => (
                      <SelectItem key={jurusan.id_jurusan} value={jurusan.id_jurusan.toString()}>
                        {jurusan.nama_jurusan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isAdminJurusan && user?.id_jurusan && (
              <div>
                <Label className="text-slate-700 font-medium text-xs sm:text-sm">Jurusan</Label>
                <Input
                  value={jurusanList.find(j => j.id_jurusan === user.id_jurusan)?.nama_jurusan || "-"}
                  disabled
                  className="bg-slate-50 rounded-lg h-9 text-sm mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKelasDialogOpen(false)}
              className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white"
            >
              Batal
            </Button>
            <Button
              onClick={handleSaveKelas}
              disabled={isSavingKelas}
              className="rounded-xl bg-gradient-to-r from-[#2C5EAD] to-[#1591DC]"
            >
              {isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toggleKelasDialogOpen} onOpenChange={setToggleKelasDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg"><DialogHeader><DialogTitle>{isActivatingKelasMode ? "Aktifkan Kelas" : "Nonaktifkan Kelas"}</DialogTitle><DialogDescription>{isActivatingKelasMode ? `Aktifkan kembali kelas ${togglingKelas?.nama}?` : `Yakin ingin menonaktifkan kelas ${togglingKelas?.nama}?`}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setToggleKelasDialogOpen(false)} className="border-[#2C5EAD] text-[#2C5EAD] hover:bg-[#2C5EAD] hover:text-white">Batal</Button><Button onClick={executeToggleActiveKelas} disabled={isSavingKelas}>{isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isActivatingKelasMode ? "Aktifkan" : "Nonaktifkan"}</Button></DialogFooter></DialogContent>
      </Dialog>

      {/* IMPORT KELAS DIALOGS (tidak berubah) */}
      <Dialog open={importKelasDialogOpen} onOpenChange={setImportKelasDialogOpen}>
        <DialogContent className="rounded-xl max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>Impor Kelas dari Excel</DialogTitle><DialogDescription>Unggah file Excel untuk menambah kelas secara massal</DialogDescription></DialogHeader>
          {importKelasStep === "upload" && (<div className="space-y-4"><div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50"><div className="flex flex-col items-center gap-2"><Upload className="h-8 w-8 text-slate-400" /><label htmlFor="kelas-file-input" className="cursor-pointer"><span className="text-sm font-medium text-blue-600 hover:text-blue-700">Klik untuk unggah</span><input id="kelas-file-input" type="file" accept=".xlsx,.xls" onChange={handleKelasFileUpload} className="hidden" disabled={isImportingKelas} /></label><p className="text-xs text-slate-500">atau tarik & lepas file Excel di sini</p></div></div>{importKelasUploadError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{importKelasUploadError}</AlertDescription></Alert>}<Button variant="outline" onClick={downloadKelasTemplate} className="w-full"><Download className="h-4 w-4 mr-2" /> Unduh Template Excel Kelas</Button><div className="bg-blue-50 p-3 rounded-lg text-sm"><p className="font-semibold">Format File:</p><p>Kolom yang diperlukan: <strong>nama</strong> (wajib), <strong>nik_wali</strong> (opsional), <strong>aktif</strong> (opsional, 1 untuk aktif)</p><p className="text-xs text-red-600">* NIK wali harus sesuai dengan data guru di database</p></div></div>)}
          {importKelasStep === "preview" && importKelasPreviewRows.length > 0 && (<div className="space-y-4"><div className="flex justify-between"><p className="text-sm font-medium">Pratinjau Data ({importKelasPreviewRows.length} baris)</p><Badge>{importKelasPreviewRows.filter(r => r.isValid).length} dari {importKelasPreviewRows.length} valid</Badge></div><div className="border rounded-lg overflow-x-auto max-h-96"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nama Kelas</TableHead><TableHead>NIK Wali</TableHead><TableHead>Aktif</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{importKelasPreviewRows.map((row, idx) => (<TableRow key={idx} className={!row.isValid ? "bg-red-50" : ""}><TableCell>{row.rowIndex}</TableCell><TableCell>{row.nama}</TableCell><TableCell>{row.nik_wali || "-"}{!row.guruValid && row.nik_wali && <span className="text-red-500">(tidak ditemukan)</span>}</TableCell><TableCell>{row.aktif ? "Aktif" : "Nonaktif"}</TableCell><TableCell>{row.isValid ? "Valid" : <div className="text-red-600 text-xs">{row.validationErrors.join(", ")}</div>}</TableCell></TableRow>))}</TableBody></Table></div><div className="flex justify-end gap-3"><Button variant="outline" onClick={() => { setImportKelasDialogOpen(false); setImportKelasRawData([]); setImportKelasPreviewRows([]); setImportKelasStep("upload"); }}>Batal</Button><Button onClick={confirmImportKelas} disabled={isImportingKelas || importKelasPreviewRows.filter(r => r.isValid).length === 0} className="bg-gradient-to-r from-[#2C5EAD] to-[#1591DC]">{isImportingKelas && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Impor Data</Button></div></div>)}
        </DialogContent>
      </Dialog>

      <Dialog open={missingGuruDialogOpen} onOpenChange={setMissingGuruDialogOpen}>
        <DialogContent className="rounded-xl max-w-md"><DialogHeader><DialogTitle>Wali Kelas Tidak Ditemukan</DialogTitle><DialogDescription>Beberapa NIK wali kelas tidak ditemukan.</DialogDescription></DialogHeader><div className="bg-yellow-50 p-3 rounded-lg"><p className="font-medium">NIK tidak ditemukan:</p><ul className="list-disc list-inside mt-1">{Array.from(importKelasMissingGurus).map(nik => <li key={nik} className="font-mono">{nik}</li>)}</ul><p className="text-sm mt-2">Baris dengan NIK tidak ditemukan akan dilewati. Lanjutkan?</p></div><DialogFooter><Button variant="outline" onClick={() => { setMissingGuruDialogOpen(false); setImportKelasDialogOpen(false); setImportKelasRawData([]); }}>Batalkan Impor</Button><Button onClick={handleSkipMissingGurus} className="bg-green-600">Lanjutkan (Lewati Baris Bermasalah)</Button></DialogFooter></DialogContent>
      </Dialog>

      {/* IMPORT USER DIALOG (tidak berubah) */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="rounded-xl max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader><DialogTitle>Impor {userType === "guru" ? "Guru" : userType === "siswa" ? "Siswa" : userType === "admin_jurusan" ? "Admin Jurusan" : "BK"} dari Excel</DialogTitle><DialogDescription>Unggah file Excel untuk menambah data secara massal</DialogDescription></DialogHeader>
          {importStep === "upload" && (<div className="space-y-4"><div className="border-2 border-dashed rounded-lg p-6 text-center bg-slate-50"><div className="flex flex-col items-center gap-2"><Upload className="h-8 w-8 text-slate-400" /><label htmlFor="user-file-input" className="cursor-pointer"><span className="text-sm font-medium text-blue-600 hover:text-blue-700">Klik untuk unggah</span><input id="user-file-input" type="file" accept=".xlsx,.xls" onChange={handleUserFileUpload} className="hidden" disabled={isLoading} /></label><p className="text-xs text-slate-500">atau tarik & lepas file Excel di sini</p></div></div>{uploadError && <Alert className="bg-red-50 border-red-200"><AlertCircle className="h-4 w-4 text-red-600" /><AlertDescription className="text-red-700">{uploadError}</AlertDescription></Alert>}<Button variant="outline" onClick={() => downloadTemplate(userType)} className="w-full rounded-lg"><Download className="h-4 w-4 mr-2" /> Unduh Template Excel</Button><div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700"><p className="font-semibold">Format File:</p>{userType === "guru" && <p>Kolom yang diperlukan: <strong>nama, nik, username, gender</strong> (opsional: nama_jurusan, password)</p>}{userType === "siswa" && <p>Kolom yang diperlukan: <strong>nama, nis, username, gender, kelas</strong> (opsional: password)</p>}{userType === "admin_jurusan" && <p>Kolom yang diperlukan: <strong>nama, username, nama_jurusan</strong> (opsional: password)</p>}{userType === "bk" && <p>Kolom yang diperlukan: <strong>nama, username</strong> (opsional: password)</p>}<p className="text-xs mt-1">Kata sandi default "password123".</p></div></div>)}
          {importStep === "preview" && previewData.length > 0 && (<div className="space-y-4"><div className="flex justify-between items-center"><p className="text-sm font-medium">Pratinjau Data ({previewData.length} baris)</p></div><div className="border rounded-lg overflow-x-auto max-h-96"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead>Nama</TableHead>{userType === "guru" && <TableHead>NIK</TableHead>}{userType === "siswa" && <TableHead>NIS</TableHead>}<TableHead>Nama Pengguna</TableHead>{userType !== "bk" && userType !== "admin_jurusan" && <TableHead>Jenis Kelamin</TableHead>}{userType === "siswa" && <TableHead>Kelas</TableHead>}{userType === "admin_jurusan" && <TableHead>Nama Jurusan</TableHead>}</TableRow></TableHeader><TableBody>{previewData.slice(0, 20).map((item, idx) => (<TableRow key={idx}><TableCell>{item.nama as string}</TableCell>{userType === "guru" && <TableCell>{item.nik as string}</TableCell>}{userType === "siswa" && <TableCell>{item.nis as string}</TableCell>}<TableCell>{item.username as string}</TableCell>{userType !== "bk" && userType !== "admin_jurusan" && <TableCell><Badge className={(item.gender as string) === "L" ? "bg-blue-100" : "bg-pink-100"}>{item.gender === "L" ? "Laki-laki" : "Perempuan"}</Badge></TableCell>}{userType === "siswa" && <TableCell>{item.kelas as string}</TableCell>}{userType === "admin_jurusan" && <TableCell>{item.nama_jurusan as string}</TableCell>}</TableRow>))}{previewData.length > 20 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500">... dan {previewData.length - 20} baris lainnya</TableCell></TableRow>}</TableBody></Table></div><div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => { setImportDialogOpen(false); setPreviewData([]); setImportRawData([]); setImportStep("upload"); }} className="rounded-lg">Batal</Button><Button onClick={handleImport} disabled={isLoading} className="rounded-lg bg-gradient-to-r from-[#2C5EAD] to-[#1591DC]">{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Impor Data</Button></div></div>)}
        </DialogContent>
      </Dialog>

      {/* DIALOG KONFIRMASI JURUSAN BARU */}
      <Dialog open={missingJurusanDialogOpen} onOpenChange={setMissingJurusanDialogOpen}>
        <DialogContent className="rounded-xl max-w-md"><DialogHeader><DialogTitle>Jurusan Tidak Ditemukan</DialogTitle><DialogDescription>Beberapa nama jurusan dalam file Excel tidak ditemukan di database.</DialogDescription></DialogHeader><div className="space-y-4"><div className="bg-yellow-50 p-3 rounded-lg"><p className="text-sm font-medium text-yellow-800">Jurusan yang belum terdaftar:</p><ul className="list-disc list-inside mt-2 space-y-1">{importJurusanMissing.map((jurusan, idx) => <li key={idx} className="text-sm text-yellow-700">{jurusan}</li>)}</ul></div><p className="text-sm text-slate-600">Apakah Anda ingin menambahkan jurusan di atas ke database dan melanjutkan import?</p></div><DialogFooter className="gap-2"><Button variant="outline" onClick={() => { setMissingJurusanDialogOpen(false); setImportJurusanMissing([]); setImportDialogOpen(false); }} className="rounded-lg">Batalkan Impor</Button><Button onClick={continueImportAfterMissingJurusan} disabled={isAddingMissingJurusan} className="rounded-lg bg-green-600 hover:bg-green-700">{isAddingMissingJurusan ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menambahkan...</> : "Tambahkan Jurusan & Lanjutkan"}</Button></DialogFooter></DialogContent>
      </Dialog>

      {/* DIALOG KONFIRMASI KELAS BARU UNTUK IMPORT SISWA */}
      <Dialog open={missingKelasDialogOpen} onOpenChange={setMissingKelasDialogOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader><DialogTitle>Kelas Tidak Ditemukan</DialogTitle><DialogDescription>Beberapa nama kelas dalam file Excel tidak ditemukan di database.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-yellow-800">Kelas yang belum terdaftar:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {importSiswaMissingKelas.map((kelas, idx) => <li key={idx} className="text-sm text-yellow-700">{kelas}</li>)}
              </ul>
            </div>
            {isAdminSuper && (
              <div>
                <Label className="text-sm">Pilih Jurusan untuk Kelas Baru</Label>
                <Select value={selectedJurusanForNewKelas} onValueChange={setSelectedJurusanForNewKelas}>
                  <SelectTrigger className="rounded-lg mt-1">
                    <SelectValue placeholder="Pilih jurusan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Jurusan</SelectItem>
                    {jurusanList.map(j => <SelectItem key={j.id_jurusan} value={j.id_jurusan.toString()}>{j.nama_jurusan}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-sm text-slate-600">Apakah Anda ingin menambahkan kelas di atas ke database dan melanjutkan import?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setMissingKelasDialogOpen(false); setImportSiswaMissingKelas([]); setImportDialogOpen(false); }} className="rounded-lg">Batalkan Impor</Button>
            <Button onClick={addMissingKelasAndContinue} disabled={isAddingMissingKelas} className="rounded-lg bg-green-600 hover:bg-green-700">
              {isAddingMissingKelas ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menambahkan...</> : "Tambahkan Kelas & Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}