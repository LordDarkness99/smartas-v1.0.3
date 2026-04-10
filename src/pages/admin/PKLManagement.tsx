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
} from "lucide-react";

// Tipe data
interface PKL {
  id_pkl: number;
  tempat_pkl: string;
  koordinat_pkl: string;
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

export default function PKLManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"lokasi" | "siswa">("lokasi");

  // State untuk lokasi PKL
  const [pklList, setPklList] = useState<PKL[]>([]);
  const [isFetchingPKL, setIsFetchingPKL] = useState(false);
  const [pklDialogOpen, setPklDialogOpen] = useState(false);
  const [editingPKL, setEditingPKL] = useState<PKL | null>(null);
  const [pklForm, setPklForm] = useState({ tempat_pkl: "", koordinat_pkl: "" });
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

  // ========== FETCH LOKASI PKL ==========
  const fetchPKL = async () => {
    setIsFetchingPKL(true);
    try {
      const { data, error } = await supabase
        .from("pkl")
        .select("*")
        .order("id_pkl");
      if (error) throw error;
      setPklList(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingPKL(false);
    }
  };

  // ========== CRUD LOKASI PKL ==========
  const openAddPKL = () => {
    setEditingPKL(null);
    setPklForm({ tempat_pkl: "", koordinat_pkl: "" });
    setPklDialogOpen(true);
  };

  const openEditPKL = (pkl: PKL) => {
    setEditingPKL(pkl);
    setPklForm({
      tempat_pkl: pkl.tempat_pkl,
      koordinat_pkl: pkl.koordinat_pkl || "",
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
    fetchPKL();
    fetchKelas();
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
      headers = ["tempat_pkl", "koordinat_pkl"];
      data = [
        ["PT. Maju Jaya", "-6.200000,106.816666"],
        ["CV. Karya Mandiri", "-6.208333,106.845555"],
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
        // Validasi kolom
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
        // Import lokasi PKL
        const dataToInsert = importPreview.map((row: any) => ({
          tempat_pkl: row.tempat_pkl,
          koordinat_pkl: row.koordinat_pkl || null,
        }));
        const { error } = await supabase.from("pkl").insert(dataToInsert);
        if (error) throw error;
        toast({ title: "Berhasil", description: `${dataToInsert.length} lokasi PKL diimport` });
        fetchPKL();
      } else {
        // Import assignment siswa PKL
        // Pertama, kumpulkan semua nama tempat_pkl unik, cari id_pkl
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
        // Ambil semua nis dari import
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
        // Update siswa
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

  // ========== RENDER ==========
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Manajemen PKL (Praktik Kerja Lapangan)
          </CardTitle>
          <CardDescription>Kelola lokasi PKL dan atur siswa yang sedang melaksanakan PKL</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "lokasi" | "siswa")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="lokasi">Lokasi PKL</TabsTrigger>
              <TabsTrigger value="siswa">Atur Siswa PKL</TabsTrigger>
            </TabsList>

            {/* TAB LOKASI PKL */}
            <TabsContent value="lokasi" className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-2">
                  <Button onClick={openAddPKL}>
                    <Plus className="mr-2 h-4 w-4" /> Tambah Lokasi
                  </Button>
                  <Button variant="outline" onClick={() => { setImportType("lokasi"); setImportDialogOpen(true); }}>
                    <Upload className="mr-2 h-4 w-4" /> Import Excel
                  </Button>
                </div>
                <Button variant="outline" onClick={fetchPKL} disabled={isFetchingPKL}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingPKL ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ID</TableHead>
                      <TableHead>Tempat PKL</TableHead>
                      <TableHead>Koordinat</TableHead>
                      <TableHead className="w-24">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pklList.map((pkl) => (
                      <TableRow key={pkl.id_pkl}>
                        <TableCell>{pkl.id_pkl}</TableCell>
                        <TableCell className="font-medium">{pkl.tempat_pkl}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{pkl.koordinat_pkl || "-"}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditPKL(pkl)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => confirmDeletePKL(pkl)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pklList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center">Belum ada lokasi PKL</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB ATUR SISWA PKL */}
            <TabsContent value="siswa" className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-2">
                  <div className="w-64">
                    <Select value={selectedKelas === "" ? "all" : selectedKelas} onValueChange={(v) => setSelectedKelas(v === "all" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Filter Kelas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        {kelasList.map((kelas) => (
                          <SelectItem key={kelas.id_kelas} value={kelas.id_kelas.toString()}>{kelas.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={() => { setImportType("assignment"); setImportDialogOpen(true); }}>
                    <Upload className="mr-2 h-4 w-4" /> Import Assignment
                  </Button>
                </div>
                <Button variant="outline" onClick={fetchSiswa} disabled={isFetchingSiswa}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingSiswa ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lokasi PKL</TableHead>
                      <TableHead className="w-64">Atur Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFetchingSiswa ? (
                      <TableRow><TableCell colSpan={6} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : siswaList.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center">Tidak ada data siswa</TableCell></TableRow>
                    ) : (
                      siswaList.map((siswa) => (
                        <TableRow key={siswa.id_siswa}>
                          <TableCell>{siswa.nis}</TableCell>
                          <TableCell className="font-medium">{siswa.nama}</TableCell>
                          <TableCell>{siswa.kelas_nama}</TableCell>
                          <TableCell>
                            {siswa.id_pkl ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">PKL</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Sekolah</span>
                            )}
                          </TableCell>
                          <TableCell>{siswa.tempat_pkl || "-"}</TableCell>
                          <TableCell>
                            <Select
                              value={siswa.id_pkl ? siswa.id_pkl.toString() : "none"}
                              onValueChange={(value) => {
                                const pklId = value === "none" ? null : parseInt(value);
                                updateSiswaPKL(siswa.id_siswa, pklId);
                              }}
                              disabled={updatingSiswa === siswa.id_siswa}
                            >
                              <SelectTrigger className="w-[220px]">
                                <SelectValue placeholder="Pilih status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">🏫 Sekolah (tidak PKL)</SelectItem>
                                {pklList.map((pkl) => (
                                  <SelectItem key={pkl.id_pkl} value={pkl.id_pkl.toString()}>
                                    🏭 PKL - {pkl.tempat_pkl}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {updatingSiswa === siswa.id_siswa && <Loader2 className="h-4 w-4 animate-spin inline ml-2" />}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  <strong>Informasi Penting:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Siswa dengan status <strong>Sekolah</strong> akan melakukan presensi harian dan presensi mapel di lokasi sekolah.</li>
                    <li>Siswa dengan status <strong>PKL</strong> hanya dapat melakukan presensi harian di lokasi PKL yang ditentukan.</li>
                    <li>Gunakan fitur <strong>Import Assignment</strong> untuk mengatur banyak siswa sekaligus via Excel.</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog Import Excel */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {importType === "lokasi" ? "Import Lokasi PKL" : "Import Assignment Siswa PKL"}
            </DialogTitle>
            <DialogDescription>
              Upload file Excel (.xlsx, .xls, .csv) dengan format yang sesuai.
              {importType === "lokasi" 
                ? " Kolom: tempat_pkl (wajib), koordinat_pkl (opsional)." 
                : " Kolom: nis (wajib), tempat_pkl (wajib, nama tempat PKL harus sudah ada di database)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => downloadTemplate(importType)}>
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isImporting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button disabled={isImporting}>
                  <Upload className="mr-2 h-4 w-4" />
                  {isImporting ? "Memproses..." : "Pilih File"}
                </Button>
              </div>
            </div>
            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}
            {importPreview.length > 0 && (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>{importPreview.length} data siap diimport</AlertDescription>
                </Alert>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(importPreview[0] || {}).map((key) => (
                          <TableHead key={key}>{key}</TableHead>
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
                          <TableCell colSpan={Object.keys(importPreview[0]).length} className="text-center">
                            ... dan {importPreview.length - 5} data lainnya
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import Data
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Lokasi PKL (Add/Edit) */}
      <Dialog open={pklDialogOpen} onOpenChange={setPklDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPKL ? "Edit Lokasi PKL" : "Tambah Lokasi PKL"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tempat_pkl">Tempat / Nama Perusahaan</Label>
              <Input id="tempat_pkl" value={pklForm.tempat_pkl} onChange={(e) => setPklForm({ ...pklForm, tempat_pkl: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="koordinat">Koordinat (Opsional)</Label>
              <Input id="koordinat" value={pklForm.koordinat_pkl} onChange={(e) => setPklForm({ ...pklForm, koordinat_pkl: e.target.value })} placeholder="-6.200000,106.816666" />
              <p className="text-xs text-muted-foreground mt-1">Format: latitude,longitude</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPklDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSavePKL} disabled={isSavingPKL}>
              {isSavingPKL && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Lokasi PKL */}
      <Dialog open={deletePKLDialogOpen} onOpenChange={setDeletePKLDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Lokasi PKL</DialogTitle></DialogHeader>
          <DialogDescription>
            Yakin ingin menghapus lokasi PKL <strong>{deletingPKL?.tempat_pkl}</strong>?
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePKLDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeletePKL} disabled={isSavingPKL}>
              {isSavingPKL && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}