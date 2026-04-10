import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  RefreshCw,
  Calendar,
  BookOpen,
  QrCode,
  Download,
} from "lucide-react";
import QRCode from "qrcode";


// Tipe data
interface Siswa {
  id_siswa: number;
  nama: string;
  nis: string;
  id_kelas: number;
  kelas_nama: string;
  id_pkl: number | null;
}

interface PresensiHarian {
  id_pres_harian: number;
  id_siswa: number;
  status_presensi: string;
  waktu_presensi: string;
  siswa?: Siswa;
}

interface Jadwal {
  id_jadwal: number;
  hari: string;
  jam: string;
  mata_pelajaran: string;
  guru: string;
  id_kelas: number;
  kelas_nama: string;
}

interface PresensiMapel {
  id_pre_siswa: number;
  id_siswa: number;
  id_jadwal: number;
  status: string;
  waktu_presensi: string;
  siswa?: Siswa;
}

// Konstanta status
const STATUS_HARIAN_SEKOLAH = ["Hadir", "Terlambat", "Izin", "Sakit", "Alfa"];
const STATUS_HARIAN_PKL = ["Hadir", "Izin", "Sakit", "Alfa"];
const STATUS_MAPEL = ["Hadir", "Izin", "Sakit", "Alfa"];

// Helper: konversi string jam "HH:MM - HH:MM" ke menit
const parseTimeRange = (jamStr: string) => {
  const [start, end] = jamStr.split(" - ");
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  return { startMin: toMinutes(start), endMin: toMinutes(end) };
};

export default function AttendanceManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");

  // State presensi harian
  const [kelasList, setKelasList] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedTanggal, setSelectedTanggal] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [presensiHarian, setPresensiHarian] = useState<PresensiHarian[]>([]);
  const [isFetchingHarian, setIsFetchingHarian] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<{ id: number; type: string } | null>(null);

  // State presensi mapel
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [selectedJadwal, setSelectedJadwal] = useState<string>("");
  const [presensiMapel, setPresensiMapel] = useState<PresensiMapel[]>([]);
  const [isFetchingMapel, setIsFetchingMapel] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [selectedJadwalForQR, setSelectedJadwalForQR] = useState<Jadwal | null>(null);

  // Fetch kelas
  const fetchKelas = async () => {
    const { data, error } = await supabase
      .from("kelas")
      .select("id_kelas, nama")
      .eq("aktif", true)
      .order("nama");
    if (error) console.error(error);
    else setKelasList(data || []);
  };

  // Fetch presensi harian
  const fetchPresensiHarian = async () => {
    if (!selectedKelas) return;
    setIsFetchingHarian(true);
    try {
      // Ambil semua siswa di kelas, termasuk id_pkl
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, id_pkl, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const siswaList: Siswa[] = siswaData.map((s: any) => ({
        id_siswa: s.id_siswa,
        nama: s.nama,
        nis: s.nis?.toString() || "",
        id_kelas: s.id_kelas,
        kelas_nama: s.kelas?.nama || "-",
        id_pkl: s.id_pkl,
      }));

      const startDate = `${selectedTanggal}T00:00:00`;
      const endDate = `${selectedTanggal}T23:59:59`;
      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_harian")
        .select("*")
        .gte("waktu_presensi", startDate)
        .lte("waktu_presensi", endDate);
      if (presensiError) throw presensiError;

      const combined = siswaList.map((siswa) => {
        const existing = presensiData?.find((p) => p.id_siswa === siswa.id_siswa);
        return {
          id_pres_harian: existing?.id_pres_harian || null,
          id_siswa: siswa.id_siswa,
          status_presensi: existing?.status_presensi || null,
          waktu_presensi: existing?.waktu_presensi || null,
          siswa: siswa,
        };
      });
      setPresensiHarian(combined);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingHarian(false);
    }
  };

  // Update status presensi harian (dipanggil saat radio button berubah)
  const updatePresensiHarian = async (siswaId: number, currentAttendance: any, newStatus: string) => {
    setUpdatingStatus({ id: siswaId, type: "harian" });
    try {
      if (currentAttendance.id_pres_harian) {
        const { error } = await supabase
          .from("presensi_harian")
          .update({ status_presensi: newStatus, waktu_presensi: new Date().toISOString() })
          .eq("id_pres_harian", currentAttendance.id_pres_harian);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("presensi_harian").insert({
          id_siswa: siswaId,
          status_presensi: newStatus,
          waktu_presensi: new Date().toISOString(),
        });
        if (error) throw error;
      }
      // Update local state
      setPresensiHarian(prev =>
        prev.map(item =>
          item.id_siswa === siswaId
            ? { ...item, status_presensi: newStatus, waktu_presensi: new Date().toISOString() }
            : item
        )
      );
      toast({ title: "Berhasil", description: "Status presensi diperbarui" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Fetch jadwal
  const fetchJadwal = async () => {
    if (!user) return;
    try {
      let query = supabase
        .from("jadwal")
        .select(`
          id_jadwal,
          hari,
          jam,
          id_kelas,
          kelas:kelas (nama),
          mapel:mata_pelajaran (nama),
          guru:guru (nama)
        `)
        .eq("aktif", true);
      if (user.peran === "guru" && user.id_guru) {
        query = query.eq("id_guru", user.id_guru);
      }
      const { data, error } = await query.order("hari").order("jam");
      if (error) throw error;
      const formatted: Jadwal[] = data.map((item: any) => ({
        id_jadwal: item.id_jadwal,
        hari: item.hari,
        jam: item.jam,
        mata_pelajaran: item.mapel?.nama || "-",
        guru: item.guru?.nama || "-",
        id_kelas: item.id_kelas,
        kelas_nama: item.kelas?.nama || "-",
      }));
      setJadwalList(formatted);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Fetch presensi mapel
  const fetchPresensiMapel = async () => {
    if (!selectedJadwal) return;
    setIsFetchingMapel(true);
    try {
      const jadwal = jadwalList.find((j) => j.id_jadwal.toString() === selectedJadwal);
      if (!jadwal) return;

      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, id_kelas, kelas:kelas(nama)")
        .eq("id_kelas", jadwal.id_kelas)
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const siswaList: Siswa[] = siswaData.map((s: any) => ({
        id_siswa: s.id_siswa,
        nama: s.nama,
        nis: s.nis?.toString() || "",
        id_kelas: s.id_kelas,
        kelas_nama: s.kelas?.nama || "-",
        id_pkl: null,
      }));

      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_siswa_mapel")
        .select("*")
        .eq("id_jadwal", parseInt(selectedJadwal));
      if (presensiError) throw presensiError;

      const combined = siswaList.map((siswa) => {
        const existing = presensiData?.find((p) => p.id_siswa === siswa.id_siswa);
        return {
          id_pre_siswa: existing?.id_pre_siswa || null,
          id_siswa: siswa.id_siswa,
          id_jadwal: parseInt(selectedJadwal),
          status: existing?.status || null,
          waktu_presensi: existing?.waktu_presensi || null,
          siswa: siswa,
        };
      });
      setPresensiMapel(combined);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingMapel(false);
    }
  };

  // Update presensi mapel (radio button)
  const updatePresensiMapel = async (siswaId: number, currentAttendance: any, newStatus: string) => {
    setUpdatingStatus({ id: siswaId, type: "mapel" });
    try {
      if (currentAttendance.id_pre_siswa) {
        const { error } = await supabase
          .from("presensi_siswa_mapel")
          .update({ status: newStatus, waktu_presensi: new Date().toISOString() })
          .eq("id_pre_siswa", currentAttendance.id_pre_siswa);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("presensi_siswa_mapel").insert({
          id_siswa: siswaId,
          id_jadwal: currentAttendance.id_jadwal,
          status: newStatus,
          waktu_presensi: new Date().toISOString(),
        });
        if (error) throw error;
      }
      setPresensiMapel(prev =>
        prev.map(item =>
          item.id_siswa === siswaId
            ? { ...item, status: newStatus, waktu_presensi: new Date().toISOString() }
            : item
        )
      );
      toast({ title: "Berhasil", description: "Status presensi diperbarui" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Generate QR dengan validasi waktu
  const generateQRCode = async (jadwal: Jadwal) => {
    const daysMap: Record<string, number> = {
      Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 0
    };
    const now = new Date();
    const currentDay = now.getDay();
    const expectedDay = daysMap[jadwal.hari];
    if (currentDay !== expectedDay) {
      toast({
        title: "Tidak dapat generate QR",
        description: `QR Code hanya dapat digenerate pada hari ${jadwal.hari} (hari ini ${now.toLocaleDateString('id-ID', { weekday: 'long' })})`,
        variant: "destructive",
      });
      return;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const { startMin, endMin } = parseTimeRange(jadwal.jam);
    const tolerance = 15;
    if (currentMinutes < startMin - tolerance) {
      toast({
        title: "Terlalu awal",
        description: `QR Code dapat digenerate mulai ${tolerance} menit sebelum jadwal dimulai (${jadwal.jam})`,
        variant: "destructive",
      });
      return;
    }
    if (currentMinutes > endMin + tolerance) {
      toast({
        title: "Waktu habis",
        description: `QR Code tidak dapat digenerate lagi karena sudah melewati ${tolerance} menit setelah jadwal berakhir (${jadwal.jam})`,
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingQR(true);
    setSelectedJadwalForQR(jadwal);
    try {
      const payload = { id_jadwal: jadwal.id_jadwal, timestamp: Date.now() };
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));
      setQrCodeDataUrl(qrDataUrl);
      setQrDialogOpen(true);
    } catch (error) {
      toast({ title: "Error", description: "Gagal generate QR Code", variant: "destructive" });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  useEffect(() => {
    fetchKelas();
    fetchJadwal();
  }, []);

  useEffect(() => {
    if (activeTab === "harian" && selectedKelas) fetchPresensiHarian();
  }, [selectedKelas, selectedTanggal, activeTab]);

  useEffect(() => {
    if (activeTab === "mapel" && selectedJadwal) fetchPresensiMapel();
  }, [selectedJadwal, activeTab]);

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Manajemen Presensi</CardTitle>
          <CardDescription>Kelola presensi harian dan presensi mata pelajaran siswa</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="harian">Presensi Harian</TabsTrigger>
              <TabsTrigger value="mapel">Presensi Mata Pelajaran</TabsTrigger>
            </TabsList>

            {/* Presensi Harian */}
            <TabsContent value="harian" className="space-y-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="w-64">
                  <Label>Kelas</Label>
                  <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                    <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                    <SelectContent>
                      {kelasList.map((k) => (
                        <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Label>Tanggal</Label>
                  <Input type="date" value={selectedTanggal} onChange={(e) => setSelectedTanggal(e.target.value)} />
                </div>
                <Button variant="outline" onClick={fetchPresensiHarian} disabled={!selectedKelas || isFetchingHarian}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingHarian ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>

              {!selectedKelas && (
                <Alert><Calendar className="h-4 w-4" /><AlertDescription>Silakan pilih kelas terlebih dahulu</AlertDescription></Alert>
              )}

              {selectedKelas && (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NIS</TableHead>
                        <TableHead>Nama Siswa</TableHead>
                        <TableHead>Status PKL</TableHead>
                        <TableHead colSpan={STATUS_HARIAN_SEKOLAH.length}>Status Presensi</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead colSpan={3}></TableHead>
                        {STATUS_HARIAN_SEKOLAH.map(s => <TableHead key={s} className="text-center">{s}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isFetchingHarian ? (
                        <TableRow><TableCell colSpan={3 + STATUS_HARIAN_SEKOLAH.length} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : presensiHarian.length === 0 ? (
                        <TableRow><TableCell colSpan={3 + STATUS_HARIAN_SEKOLAH.length} className="text-center">Tidak ada data siswa</TableCell></TableRow>
                      ) : (
                        presensiHarian.map((item) => {
                          const isPKL = item.siswa?.id_pkl !== null;
                          const availableStatus = isPKL ? STATUS_HARIAN_PKL : STATUS_HARIAN_SEKOLAH;
                          return (
                            <TableRow key={item.id_siswa}>
                              <TableCell>{item.siswa?.nis}</TableCell>
                              <TableCell>{item.siswa?.nama}</TableCell>
                              <TableCell>
                                {isPKL ? <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">PKL</span> :
                                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Sekolah</span>}
                              </TableCell>
                              {STATUS_HARIAN_SEKOLAH.map(status => {
                                const isAvailable = availableStatus.includes(status);
                                if (!isAvailable) {
                                  return <TableCell key={status} className="text-center bg-muted/20"></TableCell>;
                                }
                                return (
                                  <TableCell key={status} className="text-center">
                                    <RadioGroup
                                      value={item.status_presensi || ""}
                                      onValueChange={(val) => updatePresensiHarian(item.id_siswa, item, val)}
                                      disabled={updatingStatus?.id === item.id_siswa && updatingStatus?.type === "harian"}
                                      className="flex justify-center"
                                    >
                                      <RadioGroupItem value={status} id={`harian-${item.id_siswa}-${status}`} />
                                    </RadioGroup>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Presensi Mata Pelajaran */}
            <TabsContent value="mapel" className="space-y-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="w-96">
                  <Label>Pilih Jadwal</Label>
                  <Select value={selectedJadwal} onValueChange={setSelectedJadwal}>
                    <SelectTrigger><SelectValue placeholder="Pilih Jadwal" /></SelectTrigger>
                    <SelectContent>
                      {jadwalList.map((j) => (
                        <SelectItem key={j.id_jadwal} value={j.id_jadwal.toString()}>
                          {j.kelas_nama} - {j.mata_pelajaran} ({j.hari}, {j.jam})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={fetchPresensiMapel} disabled={!selectedJadwal || isFetchingMapel}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingMapel ? "animate-spin" : ""}`} /> Refresh
                </Button>
                {selectedJadwal && (
                  <Button variant="default" onClick={() => {
                    const jadwal = jadwalList.find(j => j.id_jadwal.toString() === selectedJadwal);
                    if (jadwal) generateQRCode(jadwal);
                  }} disabled={isGeneratingQR}>
                    <QrCode className="mr-2 h-4 w-4" /> {isGeneratingQR ? "Generating..." : "Generate QR Code"}
                  </Button>
                )}
              </div>

              {!selectedJadwal && (
                <Alert><BookOpen className="h-4 w-4" /><AlertDescription>Silakan pilih jadwal mata pelajaran terlebih dahulu</AlertDescription></Alert>
              )}

              {selectedJadwal && (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NIS</TableHead>
                        <TableHead>Nama Siswa</TableHead>
                        <TableHead colSpan={STATUS_MAPEL.length}>Status Presensi</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead colSpan={2}></TableHead>
                        {STATUS_MAPEL.map(s => <TableHead key={s} className="text-center">{s}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isFetchingMapel ? (
                        <TableRow><TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : presensiMapel.length === 0 ? (
                        <TableRow><TableCell colSpan={2 + STATUS_MAPEL.length} className="text-center">Tidak ada data siswa</TableCell></TableRow>
                      ) : (
                        presensiMapel.map((item) => (
                          <TableRow key={item.id_siswa}>
                            <TableCell>{item.siswa?.nis}</TableCell>
                            <TableCell>{item.siswa?.nama}</TableCell>
                            {STATUS_MAPEL.map(status => (
                              <TableCell key={status} className="text-center">
                                <RadioGroup
                                  value={item.status || ""}
                                  onValueChange={(val) => updatePresensiMapel(item.id_siswa, item, val)}
                                  disabled={updatingStatus?.id === item.id_siswa && updatingStatus?.type === "mapel"}
                                  className="flex justify-center"
                                >
                                  <RadioGroupItem value={status} id={`mapel-${item.id_siswa}-${status}`} />
                                </RadioGroup>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog QR Code */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>QR Code Presensi</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />}
            <p className="text-sm text-muted-foreground text-center">
              Jadwal: {selectedJadwalForQR?.kelas_nama} - {selectedJadwalForQR?.mata_pelajaran}<br />
              Hari: {selectedJadwalForQR?.hari}, Jam: {selectedJadwalForQR?.jam}
            </p>
            <Button variant="outline" onClick={() => {
              const link = document.createElement("a");
              link.download = `qr_${selectedJadwalForQR?.id_jadwal}.png`;
              link.href = qrCodeDataUrl;
              link.click();
            }}>
              <Download className="mr-2 h-4 w-4" /> Download QR Code
            </Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setQrDialogOpen(false)}>Tutup</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}