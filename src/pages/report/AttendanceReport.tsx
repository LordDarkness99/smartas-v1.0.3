// src/pages/report/AttendanceReport.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CalendarRange, Printer } from "lucide-react";

interface Siswa {
  id_siswa: number;
  nama: string;
  nis: string;
  kelas_nama: string;
}

interface RekapHarian {
  id_siswa: number;
  nama: string;
  nis: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
}

interface RekapMapel {
  id_siswa: number;
  nama: string;
  nis: string;
  mapel_nama: string;
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
}

// Konfigurasi sekolah
const SCHOOL_NAME = "SMK Negeri 1 Contoh";
const SCHOOL_ADDRESS = "Jl. Pendidikan No. 123, Kota Contoh, Provinsi Contoh";
const SCHOOL_PHONE = "(021) 1234567";

export default function AttendanceReport() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");
  
  const [kelasList, setKelasList] = useState<{ id_kelas: number; nama: string }[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  
  const [jadwalList, setJadwalList] = useState<{ id_jadwal: number; nama: string; kelas_nama: string }[]>([]);
  const [selectedJadwal, setSelectedJadwal] = useState<string>("");
  
  const [rekapHarian, setRekapHarian] = useState<RekapHarian[]>([]);
  const [rekapMapel, setRekapMapel] = useState<RekapMapel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchKelas = async () => {
    const { data, error } = await supabase
      .from("kelas")
      .select("id_kelas, nama")
      .eq("aktif", true)
      .order("nama");
    if (error) console.error(error);
    else setKelasList(data || []);
  };

  const fetchJadwal = async () => {
    const { data, error } = await supabase
      .from("jadwal")
      .select(`
        id_jadwal,
        mapel:mata_pelajaran (nama),
        kelas:kelas (nama)
      `)
      .eq("aktif", true);
    if (error) console.error(error);
    else {
      const formatted = data.map((item: any) => ({
        id_jadwal: item.id_jadwal,
        nama: item.mapel?.nama || "-",
        kelas_nama: item.kelas?.nama || "-",
      }));
      setJadwalList(formatted);
    }
  };

  useEffect(() => {
    fetchKelas();
    fetchJadwal();
  }, []);

  const generateLaporanHarian = async () => {
    if (!selectedKelas) {
      toast({ title: "Error", description: "Pilih kelas terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      const start = `${startDate}T00:00:00`;
      const end = `${endDate}T23:59:59`;
      const { data: presensiData, error: presensiError } = await supabase
        .from("presensi_harian")
        .select("id_siswa, status_presensi")
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      if (presensiError) throw presensiError;

      const rekap: RekapHarian[] = siswaData.map((siswa: any) => {
        const siswaPresensi = presensiData?.filter(p => p.id_siswa === siswa.id_siswa) || [];
        return {
          id_siswa: siswa.id_siswa,
          nama: siswa.nama,
          nis: siswa.nis?.toString() || "",
          hadir: siswaPresensi.filter(p => p.status_presensi === "Hadir").length,
          terlambat: siswaPresensi.filter(p => p.status_presensi === "Terlambat").length,
          izin: siswaPresensi.filter(p => p.status_presensi === "Izin").length,
          sakit: siswaPresensi.filter(p => p.status_presensi === "Sakit").length,
          alfa: siswaPresensi.filter(p => p.status_presensi === "Alfa").length,
        };
      });
      setRekapHarian(rekap);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const generateLaporanMapel = async () => {
    if (!selectedKelas) {
      toast({ title: "Error", description: "Pilih kelas terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: siswaData, error: siswaError } = await supabase
        .from("siswa")
        .select("id_siswa, nama, nis, kelas:kelas(nama)")
        .eq("id_kelas", parseInt(selectedKelas))
        .eq("aktif", true);
      if (siswaError) throw siswaError;

      let query = supabase
        .from("presensi_siswa_mapel")
        .select(`
          id_siswa,
          status,
          jadwal:jadwal (
            id_jadwal,
            mapel:mata_pelajaran (nama)
          )
        `)
        .gte("waktu_presensi", `${startDate}T00:00:00`)
        .lte("waktu_presensi", `${endDate}T23:59:59`);

      if (selectedJadwal && selectedJadwal !== "all") {
        query = query.eq("jadwal.id_jadwal", parseInt(selectedJadwal));
      }

      const { data: presensiData, error: presensiError } = await query;
      if (presensiError) throw presensiError;

      const mapelMap = new Map<string, { hadir: number; izin: number; sakit: number; alfa: number }>();
      for (const pres of presensiData || []) {
        const mapelNama = pres.jadwal?.mapel?.nama || "Unknown";
        const key = `${pres.id_siswa}_${mapelNama}`;
        if (!mapelMap.has(key)) {
          mapelMap.set(key, { hadir: 0, izin: 0, sakit: 0, alfa: 0 });
        }
        const stat = mapelMap.get(key)!;
        switch (pres.status) {
          case "Hadir": stat.hadir++; break;
          case "Izin": stat.izin++; break;
          case "Sakit": stat.sakit++; break;
          case "Alfa": stat.alfa++; break;
        }
        mapelMap.set(key, stat);
      }

      const rekap: RekapMapel[] = [];
      for (const siswa of siswaData) {
        const studentKeys = Array.from(mapelMap.keys()).filter(k => k.startsWith(`${siswa.id_siswa}_`));
        if (studentKeys.length === 0) {
          rekap.push({
            id_siswa: siswa.id_siswa,
            nama: siswa.nama,
            nis: siswa.nis?.toString() || "",
            mapel_nama: "Tidak ada data",
            hadir: 0,
            izin: 0,
            sakit: 0,
            alfa: 0,
          });
        } else {
          for (const key of studentKeys) {
            const mapelNama = key.split("_")[1];
            const stats = mapelMap.get(key)!;
            rekap.push({
              id_siswa: siswa.id_siswa,
              nama: siswa.nama,
              nis: siswa.nis?.toString() || "",
              mapel_nama: mapelNama,
              hadir: stats.hadir,
              izin: stats.izin,
              sakit: stats.sakit,
              alfa: stats.alfa,
            });
          }
        }
      }
      setRekapMapel(rekap);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper untuk memformat tanggal Indonesia
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  // Mendapatkan nama kelas dari selectedKelas
  const getKelasName = () => {
    const kelas = kelasList.find(k => k.id_kelas.toString() === selectedKelas);
    return kelas?.nama || "";
  };

  return (
    <div className="container mx-auto py-8 px-4 print:py-0 print:px-0">
      {/* Header untuk layar (tidak muncul saat print) */}
      <div className="print:hidden mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Laporan Presensi</CardTitle>
            <CardDescription>Rekap presensi harian dan mata pelajaran dalam rentang waktu tertentu</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Filter (tidak muncul saat print) */}
      <div className="print:hidden mb-6">
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "harian" | "mapel")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="harian">Presensi Harian</TabsTrigger>
                <TabsTrigger value="mapel">Presensi Mata Pelajaran</TabsTrigger>
              </TabsList>

              <TabsContent value="harian" className="space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="w-48">
                    <Label>Kelas</Label>
                    <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                      <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                      <SelectContent>
                        {kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label>Tanggal Awal</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="w-40">
                    <Label>Tanggal Akhir</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                  <Button onClick={generateLaporanHarian} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarRange className="mr-2 h-4 w-4" />}
                    Tampilkan
                  </Button>
                  <Button variant="outline" onClick={handlePrint} disabled={rekapHarian.length === 0}>
                    <Printer className="mr-2 h-4 w-4" /> Cetak
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="mapel" className="space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="w-48">
                    <Label>Kelas</Label>
                    <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                      <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                      <SelectContent>
                        {kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-64">
                    <Label>Mata Pelajaran (Opsional)</Label>
                    <Select value={selectedJadwal} onValueChange={setSelectedJadwal}>
                      <SelectTrigger><SelectValue placeholder="Semua Mapel" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Mata Pelajaran</SelectItem>
                        {jadwalList.map(j => (
                          <SelectItem key={j.id_jadwal} value={j.id_jadwal.toString()}>
                            {j.nama} - {j.kelas_nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label>Tanggal Awal</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="w-40">
                    <Label>Tanggal Akhir</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                  <Button onClick={generateLaporanMapel} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarRange className="mr-2 h-4 w-4" />}
                    Tampilkan
                  </Button>
                  <Button variant="outline" onClick={handlePrint} disabled={rekapMapel.length === 0}>
                    <Printer className="mr-2 h-4 w-4" /> Cetak
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Area Laporan (muncul di layar dan print) */}
      {(rekapHarian.length > 0 || rekapMapel.length > 0) && (
        <div className="print:block">
          {/* Header Sekolah untuk cetak */}
          <div className="hidden print:block text-center mb-8">
            <h1 className="text-2xl font-bold">{SCHOOL_NAME}</h1>
            <p className="text-sm">{SCHOOL_ADDRESS}</p>
            <p className="text-sm">Telp. {SCHOOL_PHONE}</p>
            <hr className="my-2 border-black" />
            <hr className="my-1 border-black" />
          </div>

          {/* Judul Laporan */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold">
              {activeTab === "harian" ? "LAPORAN PRESENSI HARIAN" : "LAPORAN PRESENSI MATA PELAJARAN"}
            </h2>
            <p className="text-sm">
              Kelas: {getKelasName()} | Periode: {formatDate(startDate)} s.d. {formatDate(endDate)}
            </p>
            {activeTab === "mapel" && selectedJadwal && selectedJadwal !== "all" && (
              <p className="text-sm">
                Mata Pelajaran: {jadwalList.find(j => j.id_jadwal.toString() === selectedJadwal)?.nama || "-"}
              </p>
            )}
          </div>

          {/* Tabel Laporan */}
          {activeTab === "harian" && rekapHarian.length > 0 && (
            <div className="border rounded-lg overflow-auto print:border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Alfa</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekapHarian.map((siswa) => {
                    const total = siswa.hadir + siswa.terlambat + siswa.izin + siswa.sakit + siswa.alfa;
                    return (
                      <TableRow key={siswa.id_siswa}>
                        <TableCell>{siswa.nis}</TableCell>
                        <TableCell>{siswa.nama}</TableCell>
                        <TableCell className="text-center">{siswa.hadir}</TableCell>
                        <TableCell className="text-center">{siswa.terlambat}</TableCell>
                        <TableCell className="text-center">{siswa.izin}</TableCell>
                        <TableCell className="text-center">{siswa.sakit}</TableCell>
                        <TableCell className="text-center">{siswa.alfa}</TableCell>
                        <TableCell className="text-center font-bold">{total}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {activeTab === "mapel" && rekapMapel.length > 0 && (
            <div className="border rounded-lg overflow-auto print:border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>Mata Pelajaran</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Alfa</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekapMapel.map((item, idx) => {
                    const total = item.hadir + item.izin + item.sakit + item.alfa;
                    return (
                      <TableRow key={idx}>
                        <TableCell>{item.nis}</TableCell>
                        <TableCell>{item.nama}</TableCell>
                        <TableCell>{item.mapel_nama}</TableCell>
                        <TableCell className="text-center">{item.hadir}</TableCell>
                        <TableCell className="text-center">{item.izin}</TableCell>
                        <TableCell className="text-center">{item.sakit}</TableCell>
                        <TableCell className="text-center">{item.alfa}</TableCell>
                        <TableCell className="text-center font-bold">{total}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Footer untuk cetak */}
          <div className="hidden print:block mt-12 text-sm">
            <div className="flex justify-between">
              <div>Mengetahui,<br />Kepala Sekolah</div>
              <div>Petugas,<br />Admin/Guru</div>
            </div>
            <div className="text-center text-xs mt-8">
              Dicetak pada: {new Date().toLocaleString("id-ID")}
            </div>
          </div>
        </div>
      )}

      {/* CSS untuk print */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 4px;
          }
          th {
            background-color: #f2f2f2;
          }
        }
      `}</style>
    </div>
  );
}