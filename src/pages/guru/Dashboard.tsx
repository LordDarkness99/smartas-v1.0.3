// src/pages/guru/Dashboard.tsx (kode lengkap yang sudah diperbaiki)
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, BookOpen, Calendar, Clock } from "lucide-react";

interface Kelas {
  id_kelas: number;
  nama: string;
}

interface SiswaPresensi {
  id_siswa: number;
  nama: string;
  nis: string;
  status_harian: string;
  waktu_harian: string;
  status_mapel_terakhir: string;
  mapel_terakhir: string;
}

interface StatistikHarian {
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
  total: number;
}

interface StatistikMapel {
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
  total: number;
}

export default function GuruDashboard() {
  const { user } = useAuth();
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [siswaList, setSiswaList] = useState<SiswaPresensi[]>([]);
  const [statsHarian, setStatsHarian] = useState<StatistikHarian>({ hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0, total: 0 });
  const [statsMapel, setStatsMapel] = useState<StatistikMapel>({ hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 });
  const [recentHarian, setRecentHarian] = useState<any[]>([]);
  const [jadwalHariIni, setJadwalHariIni] = useState<any[]>([]);

  // Ambil kelas yang diajar oleh guru ini
  useEffect(() => {
    const fetchKelas = async () => {
      if (!user?.id_guru) return;
      try {
        const { data, error } = await supabase
          .from("jadwal")
          .select("kelas:id_kelas(id_kelas, nama)")
          .eq("id_guru", user.id_guru)
          .eq("aktif", true);
        if (error) throw error;
        const uniqueKelas = new Map();
        data.forEach((item: any) => {
          if (item.kelas && !uniqueKelas.has(item.kelas.id_kelas)) {
            uniqueKelas.set(item.kelas.id_kelas, { id_kelas: item.kelas.id_kelas, nama: item.kelas.nama });
          }
        });
        const kelasArray = Array.from(uniqueKelas.values());
        setKelasList(kelasArray);
        if (kelasArray.length > 0) {
          setSelectedKelas(kelasArray[0].id_kelas.toString());
        }
      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchKelas();
  }, [user]);

  // Ambil data presensi dan jadwal berdasarkan kelas yang dipilih
  useEffect(() => {
    if (!selectedKelas) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const kelasId = parseInt(selectedKelas);
        
        // 1. Ambil semua siswa di kelas
        const { data: siswaData, error: siswaError } = await supabase
          .from("siswa")
          .select("id_siswa, nama, nis")
          .eq("id_kelas", kelasId)
          .eq("aktif", true);
        if (siswaError) throw siswaError;
        
        const siswaIds = siswaData.map(s => s.id_siswa);
        
        // 2. Presensi harian hari ini
        const today = new Date().toISOString().split("T")[0];
        const { data: harianToday, error: harianError } = await supabase
          .from("presensi_harian")
          .select("id_siswa, status_presensi, waktu_presensi")
          .in("id_siswa", siswaIds)
          .gte("waktu_presensi", `${today}T00:00:00`)
          .lte("waktu_presensi", `${today}T23:59:59`);
        
        const mapHarian = new Map();
        if (harianToday) {
          harianToday.forEach(p => mapHarian.set(p.id_siswa, { status: p.status_presensi, waktu: p.waktu_presensi }));
        }
        
        // 3. Presensi mapel terakhir untuk setiap siswa
        const { data: mapelData, error: mapelError } = await supabase
          .from("presensi_siswa_mapel")
          .select("id_siswa, status, waktu_presensi, jadwal:jadwal(mapel:mata_pelajaran(nama))")
          .in("id_siswa", siswaIds)
          .order("waktu_presensi", { ascending: false });
        
        const mapMapel = new Map();
        if (mapelData) {
          mapelData.forEach(p => {
            if (!mapMapel.has(p.id_siswa)) {
              mapMapel.set(p.id_siswa, {
                status: p.status,
                mapel: p.jadwal?.mapel?.nama || "-"
              });
            }
          });
        }
        
        // Gabungkan
        const combined = siswaData.map(s => ({
          id_siswa: s.id_siswa,
          nama: s.nama,
          nis: s.nis?.toString() || "",
          status_harian: mapHarian.get(s.id_siswa)?.status || "-",
          waktu_harian: mapHarian.get(s.id_siswa)?.waktu ? new Date(mapHarian.get(s.id_siswa).waktu).toLocaleTimeString("id-ID") : "-",
          status_mapel_terakhir: mapMapel.get(s.id_siswa)?.status || "-",
          mapel_terakhir: mapMapel.get(s.id_siswa)?.mapel || "-",
        }));
        setSiswaList(combined);
        
        // 4. Statistik 30 hari untuk presensi harian
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const start = startDate.toISOString().split("T")[0];
        
        const { data: harian30, error: harian30Error } = await supabase
          .from("presensi_harian")
          .select("status_presensi")
          .in("id_siswa", siswaIds)
          .gte("waktu_presensi", `${start}T00:00:00`)
          .lte("waktu_presensi", `${today}T23:59:59`);
        
        if (!harian30Error && harian30) {
          const stats = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0, total: 0 };
          harian30.forEach(p => {
            stats.total++;
            if (p.status_presensi === "Hadir") stats.hadir++;
            else if (p.status_presensi === "Terlambat") stats.terlambat++;
            else if (p.status_presensi === "Izin") stats.izin++;
            else if (p.status_presensi === "Sakit") stats.sakit++;
            else if (p.status_presensi === "Alfa") stats.alfa++;
          });
          setStatsHarian(stats);
        }
        
        // 5. Statistik presensi mapel 30 hari untuk jadwal yang diajar guru ini
        const { data: jadwalIds, error: jadwalError } = await supabase
          .from("jadwal")
          .select("id_jadwal")
          .eq("id_guru", user?.id_guru)
          .eq("aktif", true);
        if (!jadwalError && jadwalIds) {
          const ids = jadwalIds.map(j => j.id_jadwal);
          const { data: mapel30, error: mapel30Error } = await supabase
            .from("presensi_siswa_mapel")
            .select("status")
            .in("id_jadwal", ids)
            .in("id_siswa", siswaIds)
            .gte("waktu_presensi", `${start}T00:00:00`)
            .lte("waktu_presensi", `${today}T23:59:59`);
          if (!mapel30Error && mapel30) {
            const stats = { hadir: 0, izin: 0, sakit: 0, alfa: 0, total: 0 };
            mapel30.forEach(p => {
              stats.total++;
              if (p.status === "Hadir") stats.hadir++;
              else if (p.status === "Izin") stats.izin++;
              else if (p.status === "Sakit") stats.sakit++;
              else if (p.status === "Alfa") stats.alfa++;
            });
            setStatsMapel(stats);
          }
        }
        
        // 6. Presensi harian terbaru (5 data)
        const { data: recent, error: recentError } = await supabase
          .from("presensi_harian")
          .select("id_siswa, status_presensi, waktu_presensi, siswa:siswa(nama, nis)")
          .in("id_siswa", siswaIds)
          .order("waktu_presensi", { ascending: false })
          .limit(5);
        if (!recentError && recent) {
          setRecentHarian(recent.map(r => ({
            nama: r.siswa?.nama,
            nis: r.siswa?.nis,
            status: r.status_presensi,
            waktu: new Date(r.waktu_presensi).toLocaleString("id-ID"),
          })));
        }
        
        // 7. Jadwal hari ini untuk guru ini
        const daysMap: Record<string, string> = {
          "Sunday": "Minggu", "Monday": "Senin", "Tuesday": "Selasa", "Wednesday": "Rabu",
          "Thursday": "Kamis", "Friday": "Jumat", "Saturday": "Sabtu"
        };
        const todayName = daysMap[new Date().toLocaleDateString('en-US', { weekday: 'long' })];
        const { data: jadwalToday, error: jadwalTodayError } = await supabase
          .from("jadwal")
          .select("jam, mapel:mata_pelajaran(nama), kelas:kelas(nama)")
          .eq("id_guru", user?.id_guru)
          .eq("hari", todayName)
          .eq("aktif", true)
          .order("jam");
        if (!jadwalTodayError && jadwalToday) {
          setJadwalHariIni(jadwalToday.map(j => ({
            jam: j.jam,
            mapel: j.mapel?.nama || "-",
            kelas: j.kelas?.nama || "-",
          })));
        }
        
      } catch (error: any) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedKelas, user]);

  if (loading && kelasList.length === 0) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Guru</h1>
        <p className="text-muted-foreground">Selamat datang, {user?.nama}</p>
      </div>

      {kelasList.length === 0 ? (
        <Card><CardContent className="text-center py-8">Anda belum memiliki jadwal mengajar.</CardContent></Card>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Pilih Kelas:</label>
            <Select value={selectedKelas} onValueChange={setSelectedKelas}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
              <SelectContent>
                {kelasList.map(k => <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Statistik Presensi Harian (30 hari)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="bg-green-100 p-2 rounded"><div className="text-2xl font-bold text-green-700">{statsHarian.hadir}</div><div className="text-xs">Hadir</div></div>
                  <div className="bg-yellow-100 p-2 rounded"><div className="text-2xl font-bold text-yellow-700">{statsHarian.terlambat}</div><div className="text-xs">Terlambat</div></div>
                  <div className="bg-blue-100 p-2 rounded"><div className="text-2xl font-bold text-blue-700">{statsHarian.izin}</div><div className="text-xs">Izin</div></div>
                  <div className="bg-purple-100 p-2 rounded"><div className="text-2xl font-bold text-purple-700">{statsHarian.sakit}</div><div className="text-xs">Sakit</div></div>
                  <div className="bg-red-100 p-2 rounded"><div className="text-2xl font-bold text-red-700">{statsHarian.alfa}</div><div className="text-xs">Alfa</div></div>
                </div>
                <div className="mt-2 text-center text-sm">Total presensi: {statsHarian.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Statistik Presensi Mapel (30 hari)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-green-100 p-2 rounded"><div className="text-2xl font-bold text-green-700">{statsMapel.hadir}</div><div className="text-xs">Hadir</div></div>
                  <div className="bg-blue-100 p-2 rounded"><div className="text-2xl font-bold text-blue-700">{statsMapel.izin}</div><div className="text-xs">Izin</div></div>
                  <div className="bg-purple-100 p-2 rounded"><div className="text-2xl font-bold text-purple-700">{statsMapel.sakit}</div><div className="text-xs">Sakit</div></div>
                  <div className="bg-red-100 p-2 rounded"><div className="text-2xl font-bold text-red-700">{statsMapel.alfa}</div><div className="text-xs">Alfa</div></div>
                </div>
                <div className="mt-2 text-center text-sm">Total presensi: {statsMapel.total}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Jadwal Mengajar Hari Ini</CardTitle></CardHeader>
              <CardContent>
                {jadwalHariIni.length === 0 ? (
                  <p className="text-muted-foreground">Tidak ada jadwal hari ini</p>
                ) : (
                  <div className="space-y-2">
                    {jadwalHariIni.map((j, idx) => (
                      <div key={idx} className="flex justify-between items-center border-b pb-2">
                        <div><Clock className="h-4 w-4 inline mr-2" />{j.jam}</div>
                        <div><BookOpen className="h-4 w-4 inline mr-2" />{j.mapel}</div>
                        <div><Users className="h-4 w-4 inline mr-2" />{j.kelas}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Presensi Harian Terbaru</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>NIS</TableHead><TableHead>Nama</TableHead><TableHead>Status</TableHead><TableHead>Waktu</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {recentHarian.map((p, idx) => (
                      <TableRow key={idx}><TableCell>{p.nis}</TableCell><TableCell>{p.nama}</TableCell><TableCell>{p.status}</TableCell><TableCell>{p.waktu}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Presensi Siswa Hari Ini</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NIS</TableHead><TableHead>Nama</TableHead><TableHead>Presensi Harian</TableHead><TableHead>Waktu</TableHead><TableHead>Presensi Mapel Terakhir</TableHead><TableHead>Mapel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {siswaList.map(s => (
                    <TableRow key={s.id_siswa}>
                      <TableCell>{s.nis}</TableCell><TableCell>{s.nama}</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs ${s.status_harian === "Hadir" ? "bg-green-100 text-green-800" : s.status_harian === "Terlambat" ? "bg-yellow-100 text-yellow-800" : s.status_harian === "Izin" ? "bg-blue-100 text-blue-800" : s.status_harian === "Sakit" ? "bg-purple-100 text-purple-800" : s.status_harian === "Alfa" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-500"}`}>{s.status_harian}</span></TableCell>
                      <TableCell>{s.waktu_harian}</TableCell>
                      <TableCell><span className={`px-2 py-1 rounded-full text-xs ${s.status_mapel_terakhir === "Hadir" ? "bg-green-100 text-green-800" : s.status_mapel_terakhir === "Izin" ? "bg-blue-100 text-blue-800" : s.status_mapel_terakhir === "Sakit" ? "bg-purple-100 text-purple-800" : s.status_mapel_terakhir === "Alfa" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-500"}`}>{s.status_mapel_terakhir}</span></TableCell>
                      <TableCell>{s.mapel_terakhir}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}