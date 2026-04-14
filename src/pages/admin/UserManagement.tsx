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
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  Edit,
  Trash2,
  RefreshCw,
  Plus,
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

  // ==================== FETCH KELAS (dengan join ke guru) ====================
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

  // ==================== FETCH USERS ====================
  const fetchGuru = async () => {
    setIsFetching(true);
    try {
      const { data: guruData, error: guruError } = await supabase
        .from("guru")
        .select("id_guru, nama, nip, gender, aktif")
        .order("id_guru");
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
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, gender, aktif, id_kelas")
        .order("id_siswa");
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
      const { data: kelasData, error: kelasError } = await supabase
        .from("kelas")
        .select("id_kelas, nama")
        .in("id_kelas", kelasIds);
      if (kelasError) throw kelasError;
      
      const kelasMap = new Map();
      kelasData?.forEach(k => kelasMap.set(k.id_kelas, k.nama));
      
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
      if (userType === "guru") fetchGuru();
      else fetchSiswa();
    } else if (activeTab === "kelas") {
      fetchKelas();
    }
  }, [activeTab, userType]);

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
    
    // Hash password dengan bcrypt
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
      if (!id) throw new Error(`Kelas "${nama}" tidak ditemukan. Silakan tambah kelas terlebih dahulu.`);
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
    
    // Hash password dengan bcrypt
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
        // Hash password baru jika diisi
        akunUpdate.kata_sandi = await bcrypt.hash(editForm.password, 10);
      }
      
      const { error: akunError } = await supabase
        .from("akun")
        .update(akunUpdate)
        .eq(isGuru ? "id_guru" : "id_siswa", userId as any);
      if (akunError) throw akunError;
      
      toast({ title: "Berhasil", description: "Data user berhasil diupdate" });
      setEditDialogOpen(false);
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
      if (isGuru) fetchGuru(); else fetchSiswa();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== RENDER ====================
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Manajemen Data User & Kelas</CardTitle>
          <CardDescription>
            Import, edit, hapus data guru/siswa, serta kelola data kelas dengan wali kelas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="import">Import Data</TabsTrigger>
              <TabsTrigger value="list">Daftar User</TabsTrigger>
              <TabsTrigger value="kelas">Kelola Kelas</TabsTrigger>
            </TabsList>

            {/* TAB IMPORT */}
            <TabsContent value="import">
              <div className="space-y-6">
                <div className="flex gap-4 flex-wrap">
                  <Select value={userType} onValueChange={(v) => setUserType(v as "guru" | "siswa")}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Pilih tipe user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guru">Guru</SelectItem>
                      <SelectItem value="siswa">Siswa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => downloadTemplate(userType)}>
                    <Download className="mr-2 h-4 w-4" /> Download Template
                  </Button>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleFileUpload} 
                      disabled={isLoading} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <Button disabled={isLoading}>
                      <Upload className="mr-2 h-4 w-4" />
                      {isLoading ? "Memproses..." : "Upload File"}
                    </Button>
                  </div>
                </div>
                
                {uploadError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}
                
                {previewData.length > 0 && (
                  <>
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{previewData.length} data siap diimport</AlertDescription>
                    </Alert>
                    <div className="border rounded-lg overflow-auto max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead>{userType === "guru" ? "NIP" : "NIS"}</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Gender</TableHead>
                            {userType === "siswa" && <TableHead>Kelas</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.slice(0, 10).map((item: any, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{item.nama}</TableCell>
                              <TableCell>{userType === "guru" ? item.nip : item.nis}</TableCell>
                              <TableCell>{item.email}</TableCell>
                              <TableCell>{item.gender}</TableCell>
                              {userType === "siswa" && <TableCell>{item.kelas}</TableCell>}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button onClick={handleImport} disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Import Data
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>

            {/* TAB DAFTAR USER */}
            <TabsContent value="list">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Select value={userType} onValueChange={(v) => setUserType(v as "guru" | "siswa")}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guru">Guru</SelectItem>
                      <SelectItem value="siswa">Siswa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    onClick={() => userType === "guru" ? fetchGuru() : fetchSiswa()} 
                    disabled={isFetching}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> 
                    Refresh
                  </Button>
                </div>
                
                {isFetching ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>{userType === "guru" ? "NIP" : "NIS"}</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Gender</TableHead>
                          {userType === "siswa" && <TableHead>Kelas</TableHead>}
                          <TableHead>Status</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userType === "guru" ? (
                          guruList.map(guru => (
                            <TableRow key={guru.id_guru}>
                              <TableCell>{guru.id_guru}</TableCell>
                              <TableCell>{guru.nama}</TableCell>
                              <TableCell>{guru.nip}</TableCell>
                              <TableCell>{guru.email}</TableCell>
                              <TableCell>{guru.gender}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${guru.aktif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                  {guru.aktif ? "Aktif" : "Nonaktif"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(guru)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => confirmDelete(guru)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          siswaList.map(siswa => (
                            <TableRow key={siswa.id_siswa}>
                              <TableCell>{siswa.id_siswa}</TableCell>
                              <TableCell>{siswa.nama}</TableCell>
                              <TableCell>{siswa.nis}</TableCell>
                              <TableCell>{siswa.email}</TableCell>
                              <TableCell>{siswa.gender}</TableCell>
                              <TableCell>{siswa.nama_kelas || "-"}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${siswa.aktif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                  {siswa.aktif ? "Aktif" : "Nonaktif"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(siswa)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => confirmDelete(siswa)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                        {((userType === "guru" && !guruList.length) || (userType === "siswa" && !siswaList.length)) && (
                          <TableRow>
                            <TableCell colSpan={userType === "guru" ? 7 : 8} className="text-center">
                              Tidak ada data
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB KELOLA KELAS (DENGAN GURU WALI) */}
            <TabsContent value="kelas">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Button onClick={handleAddKelas}>
                    <Plus className="mr-2 h-4 w-4" /> Tambah Kelas
                  </Button>
                  <Button variant="outline" onClick={fetchKelas} disabled={isFetchingKelas}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingKelas ? "animate-spin" : ""}`} /> 
                    Refresh
                  </Button>
                </div>
                
                {isFetchingKelas ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Nama Kelas</TableHead>
                          <TableHead>Wali Kelas</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Dibuat Pada</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kelasList.map(kelas => (
                          <TableRow key={kelas.id_kelas}>
                            <TableCell>{kelas.id_kelas}</TableCell>
                            <TableCell>{kelas.nama}</TableCell>
                            <TableCell>{kelas.guru_nama || "-"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${kelas.aktif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                                {kelas.aktif ? "Aktif" : "Nonaktif"}
                              </span>
                            </TableCell>
                            <TableCell>{new Date(kelas.dibuat_pada).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleEditKelas(kelas)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => confirmDeleteKelas(kelas)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {!kelasList.length && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">
                              Belum ada data kelas
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog Edit User */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Ubah informasi user. Kosongkan password jika tidak ingin mengubah.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama</Label>
              <Input 
                value={editForm.nama} 
                onChange={e => setEditForm({...editForm, nama: e.target.value})} 
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input 
                type="email" 
                value={editForm.email} 
                onChange={e => setEditForm({...editForm, email: e.target.value})} 
              />
            </div>
            <div>
              <Label>Gender</Label>
              <Select 
                value={editForm.gender} 
                onValueChange={v => setEditForm({...editForm, gender: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userType === "siswa" && (
              <div>
                <Label>Kelas</Label>
                <Select 
                  value={editForm.kelas_id} 
                  onValueChange={v => setEditForm({...editForm, kelas_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
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
              <Label>Password Baru (Opsional)</Label>
              <Input 
                type="password" 
                placeholder="Kosongkan jika tidak ingin mengubah" 
                value={editForm.password} 
                onChange={e => setEditForm({...editForm, password: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateUser} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete User */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus User</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus <strong>{deletingUser?.nama}</strong>? Tindakan tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Kelas (Add/Edit) dengan pilihan guru wali */}
      <Dialog open={kelasDialogOpen} onOpenChange={setKelasDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKelas ? "Edit Kelas" : "Tambah Kelas Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Kelas</Label>
              <Input 
                value={kelasForm.nama} 
                onChange={e => setKelasForm({ ...kelasForm, nama: e.target.value })} 
                placeholder="Contoh: XII RPL 1" 
              />
            </div>
            <div>
              <Label>Wali Kelas</Label>
              <Select 
                value={kelasForm.id_guru} 
                onValueChange={v => setKelasForm({ ...kelasForm, id_guru: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih wali kelas (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada wali kelas</SelectItem>
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
            <Button variant="outline" onClick={() => setKelasDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveKelas} disabled={isSavingKelas}>
              {isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Kelas */}
      <Dialog open={deleteKelasDialogOpen} onOpenChange={setDeleteKelasDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Kelas</DialogTitle>
            <DialogDescription>
              Yakin ingin menghapus kelas <strong>{deletingKelas?.nama}</strong>? 
              Siswa yang memiliki kelas ini akan kehilangan referensi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteKelasDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteKelas} disabled={isSavingKelas}>
              {isSavingKelas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}