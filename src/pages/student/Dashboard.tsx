import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface SiswaData {
  id_siswa: number;
  nama: string;
  nis: string;
  kelas_nama: string;
  id_pkl: number | null;
  tempat_pkl?: string;
}

interface MataPelajaran {
  id_mapel: number;
  nama: string;
}

interface PresensiHarian {
  tanggal: string;
  status: string;
  waktu: string;
}

interface PresensiMapel {
  mapel: string;
  status: string;
  tanggal: string;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [siswa, setSiswa] = useState<SiswaData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [statsHarian, setStatsHarian] = useState({ hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 });
  const [recentHarian, setRecentHarian] = useState<PresensiHarian[]>([]);
  
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [selectedMapel, setSelectedMapel] = useState<string>("all");
  const [statsMapel, setStatsMapel] = useState({ hadir: 0, izin: 0, sakit: 0, alfa: 0 });
  const [recentMapel, setRecentMapel] = useState<PresensiMapel[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id_siswa) return;
      try {
        const { data: siswaData, error: siswaError } = await supabase
          .from("siswa")
          .select("id_siswa, nama, nis, id_kelas, id_pkl, kelas:kelas(nama), pkl:pkl(tempat_pkl)")
          .eq("id_siswa", user.id_siswa)
          .single();
        if (siswaError) throw siswaError;
        setSiswa({
          id_siswa: siswaData.id_siswa,
          nama: siswaData.nama,
          nis: siswaData.nis?.toString() || "",
          kelas_nama: siswaData.kelas?.nama || "-",
          id_pkl: siswaData.id_pkl,
          tempat_pkl: siswaData.pkl?.tempat_pkl,
        });

        if (siswaData.id_kelas) {
          const { data: jadwalData, error: jadwalError } = await supabase
            .from("jadwal")
            .select("mapel:mata_pelajaran(id_mapel, nama)")
            .eq("id_kelas", siswaData.id_kelas)
            .eq("aktif", true);
          if (!jadwalError && jadwalData) {
            const uniqueMapel = new Map();
            jadwalData.forEach((item: any) => {
              if (item.mapel && !uniqueMapel.has(item.mapel.id_mapel)) {
                uniqueMapel.set(item.mapel.id_mapel, { id_mapel: item.mapel.id_mapel, nama: item.mapel.nama });
              }
            });
            setMapelList(Array.from(uniqueMapel.values()));
          }
        }

        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const start = startDate.toISOString().split("T")[0];
        
        const { data: harianData, error: harianError } = await supabase
          .from("presensi_harian")
          .select("status_presensi, waktu_presensi")
          .eq("id_siswa", user.id_siswa)
          .gte("waktu_presensi", `${start}T00:00:00`)
          .lte("waktu_presensi", `${endDate}T23:59:59`);
        if (!harianError && harianData) {
          const stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
          const recent = harianData.slice(-5).reverse().map(p => ({
            tanggal: new Date(p.waktu_presensi).toLocaleDateString("id-ID"),
            status: p.status_presensi,
            waktu: new Date(p.waktu_presensi).toLocaleTimeString("id-ID"),
          }));
          harianData.forEach(p => {
            if (p.status_presensi === "Hadir") stats.hadir++;
            else if (p.status_presensi === "Terlambat") stats.terlambat++;
            else if (p.status_presensi === "Izin") stats.izin++;
            else if (p.status_presensi === "Sakit") stats.sakit++;
            else if (p.status_presensi === "Alfa") stats.alfa++;
          });
          setStatsHarian(stats);
          setRecentHarian(recent);
        }
      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const fetchPresensiMapel = async () => {
      if (!user?.id_siswa) return;
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const start = startDate.toISOString().split("T")[0];
      
      let query = supabase
        .from("presensi_siswa_mapel")
        .select("status, waktu_presensi, jadwal:jadwal(mapel:mata_pelajaran(id_mapel, nama))")
        .eq("id_siswa", user.id_siswa)
        .gte("waktu_presensi", `${start}T00:00:00`)
        .lte("waktu_presensi", `${endDate}T23:59:59`);
      
      if (selectedMapel !== "all") {
        const mapelId = parseInt(selectedMapel);
        query = query.eq("jadwal.mapel.id_mapel", mapelId);
      }
      
      const { data: mapelData, error: mapelError } = await query;
      if (!mapelError && mapelData) {
        const stats = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
        const recent = mapelData.slice(-5).reverse().map(p => ({
          mapel: p.jadwal?.mapel?.nama || "-",
          status: p.status,
          tanggal: new Date(p.waktu_presensi).toLocaleDateString("id-ID"),
        }));
        mapelData.forEach(p => {
          if (p.status === "Hadir") stats.hadir++;
          else if (p.status === "Izin") stats.izin++;
          else if (p.status === "Sakit") stats.sakit++;
          else if (p.status === "Alfa") stats.alfa++;
        });
        setStatsMapel(stats);
        setRecentMapel(recent);
      } else {
        setStatsMapel({ hadir: 0, izin: 0, sakit: 0, alfa: 0 });
        setRecentMapel([]);
      }
    };
    if (!loading) {
      fetchPresensiMapel();
    }
  }, [selectedMapel, user, loading]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Siswa</h1>
        <p className="text-muted-foreground">Selamat datang, {siswa?.nama}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div><span className="font-semibold">NIS:</span> {siswa?.nis}</div>
          <div><span className="font-semibold">Kelas:</span> {siswa?.kelas_nama}</div>
          <div><span className="font-semibold">Status:</span> {siswa?.id_pkl ? "PKL" : "Sekolah"}</div>
          {siswa?.id_pkl && <div><span className="font-semibold">Tempat PKL:</span> {siswa?.tempat_pkl}</div>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Presensi Harian (30 hari)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="bg-green-100 p-2 rounded"><div className="text-2xl font-bold text-green-700">{statsHarian.hadir}</div><div className="text-xs">Hadir</div></div>
              <div className="bg-yellow-100 p-2 rounded"><div className="text-2xl font-bold text-yellow-700">{statsHarian.terlambat}</div><div className="text-xs">Terlambat</div></div>
              <div className="bg-blue-100 p-2 rounded"><div className="text-2xl font-bold text-blue-700">{statsHarian.izin}</div><div className="text-xs">Izin</div></div>
              <div className="bg-purple-100 p-2 rounded"><div className="text-2xl font-bold text-purple-700">{statsHarian.sakit}</div><div className="text-xs">Sakit</div></div>
              <div className="bg-red-100 p-2 rounded"><div className="text-2xl font-bold text-red-700">{statsHarian.alfa}</div><div className="text-xs">Alfa</div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Presensi Mata Pelajaran (30 hari)</CardTitle>
            <Select value={selectedMapel} onValueChange={setSelectedMapel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Semua Mapel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Mata Pelajaran</SelectItem>
                {mapelList.map((mapel) => (
                  <SelectItem key={mapel.id_mapel} value={mapel.id_mapel.toString()}>
                    {mapel.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-green-100 p-2 rounded"><div className="text-2xl font-bold text-green-700">{statsMapel.hadir}</div><div className="text-xs">Hadir</div></div>
              <div className="bg-blue-100 p-2 rounded"><div className="text-2xl font-bold text-blue-700">{statsMapel.izin}</div><div className="text-xs">Izin</div></div>
              <div className="bg-purple-100 p-2 rounded"><div className="text-2xl font-bold text-purple-700">{statsMapel.sakit}</div><div className="text-xs">Sakit</div></div>
              <div className="bg-red-100 p-2 rounded"><div className="text-2xl font-bold text-red-700">{statsMapel.alfa}</div><div className="text-xs">Alfa</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="harian">
        <TabsList>
          <TabsTrigger value="harian">Presensi Harian Terbaru</TabsTrigger>
          <TabsTrigger value="mapel">Presensi Mapel Terbaru</TabsTrigger>
        </TabsList>
        <TabsContent value="harian">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentHarian.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{p.tanggal}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          p.status === "Hadir" ? "bg-green-100 text-green-800" :
                          p.status === "Terlambat" ? "bg-yellow-100 text-yellow-800" :
                          p.status === "Izin" ? "bg-blue-100 text-blue-800" :
                          p.status === "Sakit" ? "bg-purple-100 text-purple-800" :
                          "bg-red-100 text-red-800"
                        }`}>{p.status}</span>
                      </TableCell>
                      <TableCell>{p.waktu}</TableCell>
                    </TableRow>
                  ))}
                  {recentHarian.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">Belum ada data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="mapel">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Mata Pelajaran</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMapel.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{p.tanggal}</TableCell>
                      <TableCell>{p.mapel}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          p.status === "Hadir" ? "bg-green-100 text-green-800" :
                          p.status === "Izin" ? "bg-blue-100 text-blue-800" :
                          p.status === "Sakit" ? "bg-purple-100 text-purple-800" :
                          "bg-red-100 text-red-800"
                        }`}>{p.status}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentMapel.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">Belum ada data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}