import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  mapel?: { nama: string };
  guru?: { nama: string };
}

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Helper: konversi waktu "HH:MM" ke menit
const convertToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper: cek overlap dua range jam (format "HH:MM - HH:MM")
function isTimeOverlap(jam1: string, jam2: string): boolean {
  const parseRange = (jam: string) => {
    const [start, end] = jam.split(" - ");
    return { start: convertToMinutes(start), end: convertToMinutes(end) };
  };
  const t1 = parseRange(jam1);
  const t2 = parseRange(jam2);
  // Overlap jika start1 < end2 dan start2 < end1
  return t1.start < t2.end && t2.start < t1.end;
}

export default function ScheduleManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"jadwal" | "mapel">("jadwal");

  // State untuk jadwal
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedHari, setSelectedHari] = useState<string>("Senin");
  const [isFetchingJadwal, setIsFetchingJadwal] = useState(false);

  // State untuk dialog jadwal
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

  // State untuk delete jadwal
  const [deleteJadwalDialogOpen, setDeleteJadwalDialogOpen] = useState(false);
  const [deletingJadwal, setDeletingJadwal] = useState<Jadwal | null>(null);

  // State untuk mata pelajaran
  const [mapelData, setMapelData] = useState<MataPelajaran[]>([]);
  const [isFetchingMapel, setIsFetchingMapel] = useState(false);
  const [mapelDialogOpen, setMapelDialogOpen] = useState(false);
  const [editingMapel, setEditingMapel] = useState<MataPelajaran | null>(null);
  const [mapelForm, setMapelForm] = useState({ nama: "" });
  const [isSavingMapel, setIsSavingMapel] = useState(false);
  const [deleteMapelDialogOpen, setDeleteMapelDialogOpen] = useState(false);
  const [deletingMapel, setDeletingMapel] = useState<MataPelajaran | null>(null);

  // ========== FETCH DATA ==========
  const fetchKelas = async () => {
    const { data, error } = await supabase
      .from("kelas")
      .select("id_kelas, nama, aktif")
      .eq("aktif", true)
      .order("nama");
    if (error) console.error(error);
    else setKelasList(data || []);
  };

  const fetchGuru = async () => {
    const { data, error } = await supabase
      .from("guru")
      .select("id_guru, nama")
      .eq("aktif", true)
      .order("nama");
    if (error) console.error(error);
    else setGuruList(data || []);
  };

  const fetchMapel = async () => {
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .select("*")
      .order("nama");
    if (error) console.error(error);
    else setMapelData(data || []);
  };

  const fetchJadwal = async () => {
    if (!selectedKelas) return;
    setIsFetchingJadwal(true);
    try {
      let query = supabase
        .from("jadwal")
        .select(`
          id_jadwal,
          id_kelas,
          id_mapel,
          id_guru,
          hari,
          jam,
          aktif,
          kelas:kelas (nama),
          mapel:mata_pelajaran (nama),
          guru:guru (nama)
        `)
        .eq("aktif", true);

      if (selectedKelas) query = query.eq("id_kelas", parseInt(selectedKelas));
      if (selectedHari) query = query.eq("hari", selectedHari);

      const { data, error } = await query.order("jam");
      if (error) throw error;
      setJadwalList(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingJadwal(false);
    }
  };

  useEffect(() => {
    fetchKelas();
    fetchGuru();
    fetchMapel();
  }, []);

  useEffect(() => {
    if (activeTab === "jadwal" && selectedKelas) {
      fetchJadwal();
    }
  }, [selectedKelas, selectedHari, activeTab]);

  // ========== VALIDASI OVERLAP JADWAL ==========
  const checkOverlapJadwal = async (
    kelasId: number,
    mapelId: number,
    hari: string,
    jam: string,
    excludeId?: number
  ): Promise<boolean> => {
    // Cek jadwal dengan kelas dan mapel yang sama pada hari yang sama
    let query = supabase
      .from("jadwal")
      .select("id_jadwal, jam")
      .eq("id_kelas", kelasId)
      .eq("id_mapel", mapelId)
      .eq("hari", hari);
    
    if (excludeId) {
      query = query.neq("id_jadwal", excludeId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Cek overlap jam
    for (const jadwal of data || []) {
      if (isTimeOverlap(jadwal.jam, jam)) {
        return true; // overlap terdeteksi
      }
    }
    return false;
  };

  const checkGuruOverlap = async (
    guruId: number,
    hari: string,
    jam: string,
    excludeId?: number
  ): Promise<boolean> => {
    // Cek apakah guru sudah memiliki jadwal di hari dan jam yang sama (overlap)
    let query = supabase
      .from("jadwal")
      .select("id_jadwal, jam")
      .eq("id_guru", guruId)
      .eq("hari", hari);
    
    if (excludeId) {
      query = query.neq("id_jadwal", excludeId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    for (const jadwal of data || []) {
      if (isTimeOverlap(jadwal.jam, jam)) {
        return true;
      }
    }
    return false;
  };

  // ========== CRUD JADWAL ==========
  const openAddJadwal = () => {
    setEditingJadwal(null);
    setJadwalForm({
      id_kelas: selectedKelas || "",
      id_mapel: "",
      id_guru: "",
      hari: selectedHari,
      jam: "",
    });
    setJadwalDialogOpen(true);
  };

  const openEditJadwal = (jadwal: Jadwal) => {
    setEditingJadwal(jadwal);
    setJadwalForm({
      id_kelas: jadwal.id_kelas.toString(),
      id_mapel: jadwal.id_mapel.toString(),
      id_guru: jadwal.id_guru.toString(),
      hari: jadwal.hari,
      jam: jadwal.jam,
    });
    setJadwalDialogOpen(true);
  };

  const handleSaveJadwal = async () => {
    if (!jadwalForm.id_kelas || !jadwalForm.id_mapel || !jadwalForm.id_guru || !jadwalForm.jam) {
      toast({ title: "Error", description: "Semua field harus diisi", variant: "destructive" });
      return;
    }

    // Validasi format jam (HH:MM - HH:MM)
    const jamPattern = /^\d{2}:\d{2} - \d{2}:\d{2}$/;
    if (!jamPattern.test(jadwalForm.jam)) {
      toast({ title: "Error", description: "Format jam harus 'HH:MM - HH:MM'", variant: "destructive" });
      return;
    }

    const kelasId = parseInt(jadwalForm.id_kelas);
    const mapelId = parseInt(jadwalForm.id_mapel);
    const guruId = parseInt(jadwalForm.id_guru);
    const hari = jadwalForm.hari;
    const jam = jadwalForm.jam;
    const excludeId = editingJadwal?.id_jadwal;

    setIsSavingJadwal(true);
    try {
      // 1. Cek overlap untuk kelas & mapel yang sama
      const isOverlapMapel = await checkOverlapJadwal(kelasId, mapelId, hari, jam, excludeId);
      if (isOverlapMapel) {
        toast({
          title: "Error",
          description: `Jadwal untuk kelas dan mata pelajaran ini sudah ada pada jam yang tumpang tindih di hari ${hari}.`,
          variant: "destructive",
        });
        return;
      }

      // 2. (Opsional) Cek overlap untuk guru (tidak boleh mengajar dua kelas di jam yang sama)
      const isGuruOverlap = await checkGuruOverlap(guruId, hari, jam, excludeId);
      if (isGuruOverlap) {
        toast({
          title: "Error",
          description: `Guru sudah memiliki jadwal lain di hari ${hari} pada jam yang tumpang tindih.`,
          variant: "destructive",
        });
        return;
      }

      // 3. Simpan data
      const data = {
        id_kelas: kelasId,
        id_mapel: mapelId,
        id_guru: guruId,
        hari,
        jam,
        aktif: true,
        dibuat_pada: new Date().toISOString(),
      };

      if (editingJadwal) {
        const { error } = await supabase
          .from("jadwal")
          .update(data)
          .eq("id_jadwal", editingJadwal.id_jadwal);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Jadwal berhasil diupdate" });
      } else {
        const { error } = await supabase.from("jadwal").insert(data);
        if (error) throw error;
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

  const confirmDeleteJadwal = (jadwal: Jadwal) => {
    setDeletingJadwal(jadwal);
    setDeleteJadwalDialogOpen(true);
  };

  const handleDeleteJadwal = async () => {
    if (!deletingJadwal) return;
    setIsSavingJadwal(true);
    try {
      const { error } = await supabase
        .from("jadwal")
        .delete()
        .eq("id_jadwal", deletingJadwal.id_jadwal);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Jadwal dihapus" });
      setDeleteJadwalDialogOpen(false);
      fetchJadwal();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingJadwal(false);
    }
  };

  // ========== CRUD MATA PELAJARAN (tidak berubah) ==========
  const openAddMapel = () => {
    setEditingMapel(null);
    setMapelForm({ nama: "" });
    setMapelDialogOpen(true);
  };

  const openEditMapel = (mapel: MataPelajaran) => {
    setEditingMapel(mapel);
    setMapelForm({ nama: mapel.nama });
    setMapelDialogOpen(true);
  };

  const handleSaveMapel = async () => {
    if (!mapelForm.nama.trim()) {
      toast({ title: "Error", description: "Nama mata pelajaran tidak boleh kosong", variant: "destructive" });
      return;
    }
    setIsSavingMapel(true);
    try {
      if (editingMapel) {
        const { error } = await supabase
          .from("mata_pelajaran")
          .update({ nama: mapelForm.nama.trim() })
          .eq("id_mapel", editingMapel.id_mapel);
        if (error) throw error;
        toast({ title: "Berhasil", description: "Mata pelajaran diupdate" });
      } else {
        const { error } = await supabase
          .from("mata_pelajaran")
          .insert({ nama: mapelForm.nama.trim(), aktif: true, dibuat_pada: new Date().toISOString() });
        if (error) throw error;
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

  const confirmDeleteMapel = (mapel: MataPelajaran) => {
    setDeletingMapel(mapel);
    setDeleteMapelDialogOpen(true);
  };

  const handleDeleteMapel = async () => {
    if (!deletingMapel) return;
    setIsSavingMapel(true);
    try {
      // Cek apakah ada jadwal yang menggunakan mapel ini
      const { data: jadwalCount, error: countError } = await supabase
        .from("jadwal")
        .select("id_jadwal", { count: "exact", head: true })
        .eq("id_mapel", deletingMapel.id_mapel);
      if (countError) throw countError;
      if (jadwalCount && jadwalCount.length > 0) {
        toast({
          title: "Tidak bisa menghapus",
          description: `Masih ada ${jadwalCount.length} jadwal yang menggunakan mapel ini. Hapus jadwal terlebih dahulu.`,
          variant: "destructive",
        });
        setDeleteMapelDialogOpen(false);
        return;
      }
      const { error } = await supabase
        .from("mata_pelajaran")
        .delete()
        .eq("id_mapel", deletingMapel.id_mapel);
      if (error) throw error;
      toast({ title: "Berhasil", description: "Mata pelajaran dihapus" });
      setDeleteMapelDialogOpen(false);
      fetchMapel();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingMapel(false);
    }
  };

  // ========== RENDER ==========
  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Manajemen Jadwal & Mata Pelajaran</CardTitle>
          <CardDescription>
            Atur jadwal pelajaran per kelas dan kelola daftar mata pelajaran
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="jadwal">Jadwal Pelajaran</TabsTrigger>
              <TabsTrigger value="mapel">Mata Pelajaran</TabsTrigger>
            </TabsList>

            {/* TAB JADWAL */}
            <TabsContent value="jadwal" className="space-y-6">
              <div className="flex gap-4 flex-wrap items-end">
                <div className="w-64">
                  <Label>Kelas</Label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {kelasList.map((kelas) => (
                        <SelectItem key={kelas.id_kelas} value={kelas.id_kelas.toString()}>
                          {kelas.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label>Hari</Label>
                  <Select value={selectedHari} onValueChange={setSelectedHari}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HARI.map((hari) => (
                        <SelectItem key={hari} value={hari}>{hari}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchJadwal} variant="outline" disabled={isFetchingJadwal}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingJadwal ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button onClick={openAddJadwal} disabled={!selectedKelas}>
                  <Plus className="mr-2 h-4 w-4" /> Tambah Jadwal
                </Button>
              </div>

              {!selectedKelas && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Silakan pilih kelas terlebih dahulu</AlertDescription>
                </Alert>
              )}

              {selectedKelas && (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Jam</TableHead>
                        <TableHead>Mata Pelajaran</TableHead>
                        <TableHead>Guru</TableHead>
                        <TableHead>Hari</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isFetchingJadwal ? (
                        <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : jadwalList.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center">Tidak ada jadwal</TableCell></TableRow>
                      ) : (
                        jadwalList.map((jadwal) => (
                          <TableRow key={jadwal.id_jadwal}>
                            <TableCell>{jadwal.jam}</TableCell>
                            <TableCell>{(jadwal.mapel as any)?.nama || "-"}</TableCell>
                            <TableCell>{(jadwal.guru as any)?.nama || "-"}</TableCell>
                            <TableCell>{jadwal.hari}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openEditJadwal(jadwal)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => confirmDeleteJadwal(jadwal)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* TAB MATA PELAJARAN */}
            <TabsContent value="mapel" className="space-y-6">
              <div className="flex justify-between items-center">
                <Button onClick={openAddMapel}>
                  <Plus className="mr-2 h-4 w-4" /> Tambah Mata Pelajaran
                </Button>
                <Button variant="outline" onClick={fetchMapel} disabled={isFetchingMapel}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingMapel ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nama Mata Pelajaran</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapelData.map((mapel) => (
                      <TableRow key={mapel.id_mapel}>
                        <TableCell>{mapel.id_mapel}</TableCell>
                        <TableCell>{mapel.nama}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${mapel.aktif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {mapel.aktif ? "Aktif" : "Nonaktif"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditMapel(mapel)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => confirmDeleteMapel(mapel)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {mapelData.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center">Belum ada mata pelajaran</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog Jadwal */}
      <Dialog open={jadwalDialogOpen} onOpenChange={setJadwalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingJadwal ? "Edit Jadwal" : "Tambah Jadwal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kelas</Label>
              <Select value={jadwalForm.id_kelas} onValueChange={(v) => setJadwalForm({ ...jadwalForm, id_kelas: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                <SelectContent>
                  {kelasList.map((k) => (
                    <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mata Pelajaran</Label>
              <Select value={jadwalForm.id_mapel} onValueChange={(v) => setJadwalForm({ ...jadwalForm, id_mapel: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Mapel" /></SelectTrigger>
                <SelectContent>
                  {mapelData.map((m) => (
                    <SelectItem key={m.id_mapel} value={m.id_mapel.toString()}>{m.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Guru</Label>
              <Select value={jadwalForm.id_guru} onValueChange={(v) => setJadwalForm({ ...jadwalForm, id_guru: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Guru" /></SelectTrigger>
                <SelectContent>
                  {guruList.map((g) => (
                    <SelectItem key={g.id_guru} value={g.id_guru.toString()}>{g.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hari</Label>
              <Select value={jadwalForm.hari} onValueChange={(v) => setJadwalForm({ ...jadwalForm, hari: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HARI.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jam (contoh: 07:30 - 09:00)</Label>
              <Input value={jadwalForm.jam} onChange={(e) => setJadwalForm({ ...jadwalForm, jam: e.target.value })} placeholder="07:30 - 09:00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJadwalDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveJadwal} disabled={isSavingJadwal}>
              {isSavingJadwal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Jadwal */}
      <Dialog open={deleteJadwalDialogOpen} onOpenChange={setDeleteJadwalDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Jadwal</DialogTitle></DialogHeader>
          <DialogDescription>Yakin ingin menghapus jadwal ini?</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteJadwalDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteJadwal} disabled={isSavingJadwal}>
              {isSavingJadwal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mata Pelajaran */}
      <Dialog open={mapelDialogOpen} onOpenChange={setMapelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMapel ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}</DialogTitle></DialogHeader>
          <div><Label>Nama Mata Pelajaran</Label><Input value={mapelForm.nama} onChange={(e) => setMapelForm({ nama: e.target.value })} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapelDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveMapel} disabled={isSavingMapel}>
              {isSavingMapel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Mapel */}
      <Dialog open={deleteMapelDialogOpen} onOpenChange={setDeleteMapelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Mata Pelajaran</DialogTitle></DialogHeader>
          <DialogDescription>Yakin ingin menghapus mata pelajaran ini? Jika ada jadwal yang menggunakannya, penghapusan akan ditolak.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMapelDialogOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleDeleteMapel} disabled={isSavingMapel}>
              {isSavingMapel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}