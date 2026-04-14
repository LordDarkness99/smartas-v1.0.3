import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, BookOpen, UserCheck, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts";

interface PresensiHarian {
  tanggal: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    siswa: 0,
    guru: 0,
    kelas: 0,
    mapel: 0,
  });
  const [loading, setLoading] = useState(true);
  const [presensiData, setPresensiData] = useState<PresensiHarian[]>([]);
  const [summaryPresensi, setSummaryPresensi] = useState({
    hadir: 0,
    terlambat: 0,
    izin: 0,
    sakit: 0,
    alfa: 0,
  });
  const [periode, setPeriode] = useState<"minggu" | "bulan">("minggu");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [siswaRes, guruRes, kelasRes, mapelRes] = await Promise.all([
          supabase.from("siswa").select("*", { count: "exact", head: true }).eq("aktif", true),
          supabase.from("guru").select("*", { count: "exact", head: true }).eq("aktif", true),
          supabase.from("kelas").select("*", { count: "exact", head: true }).eq("aktif", true),
          supabase.from("mata_pelajaran").select("*", { count: "exact", head: true }).eq("aktif", true),
        ]);

        setStats({
          siswa: siswaRes.count || 0,
          guru: guruRes.count || 0,
          kelas: kelasRes.count || 0,
          mapel: mapelRes.count || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    fetchPresensiData();
  }, [periode]);

  const fetchPresensiData = async () => {
    try {
      // Tentukan rentang tanggal berdasarkan periode
      const now = new Date();
      let startDate: Date;
      if (periode === "minggu") {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // 7 hari terakhir
      } else {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1); // 30 hari terakhir
      }
      const start = startDate.toISOString().split("T")[0];
      const end = now.toISOString().split("T")[0];

      // Ambil data presensi harian
      const { data, error } = await supabase
        .from("presensi_harian")
        .select("waktu_presensi, status_presensi")
        .gte("waktu_presensi", `${start}T00:00:00`)
        .lte("waktu_presensi", `${end}T23:59:59`);

      if (error) throw error;

      // Kelompokkan per tanggal
      const grouped: Record<string, { hadir: number; terlambat: number; izin: number; sakit: number; alfa: number }> = {};
      let totalHadir = 0, totalTerlambat = 0, totalIzin = 0, totalSakit = 0, totalAlfa = 0;

      for (const pres of data || []) {
        const tanggal = new Date(pres.waktu_presensi).toISOString().split("T")[0];
        if (!grouped[tanggal]) {
          grouped[tanggal] = { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };
        }
        switch (pres.status_presensi) {
          case "Hadir": grouped[tanggal].hadir++; totalHadir++; break;
          case "Terlambat": grouped[tanggal].terlambat++; totalTerlambat++; break;
          case "Izin": grouped[tanggal].izin++; totalIzin++; break;
          case "Sakit": grouped[tanggal].sakit++; totalSakit++; break;
          case "Alfa": grouped[tanggal].alfa++; totalAlfa++; break;
        }
      }

      // Ubah ke array untuk chart
      const chartData = Object.entries(grouped).map(([tanggal, counts]) => ({
        tanggal,
        ...counts,
      })).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

      setPresensiData(chartData);
      setSummaryPresensi({
        hadir: totalHadir,
        terlambat: totalTerlambat,
        izin: totalIzin,
        sakit: totalSakit,
        alfa: totalAlfa,
      });
    } catch (error) {
      console.error("Error fetching presensi data:", error);
    }
  };

  const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"];

  const pieData = [
    { name: "Hadir", value: summaryPresensi.hadir },
    { name: "Terlambat", value: summaryPresensi.terlambat },
    { name: "Izin", value: summaryPresensi.izin },
    { name: "Sakit", value: summaryPresensi.sakit },
    { name: "Alfa", value: summaryPresensi.alfa },
  ].filter(item => item.value > 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Admin</h1>
        <p className="text-muted-foreground">Selamat datang, {user?.nama}</p>
      </div>

      {/* Statistik card */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.siswa}</div>
            <p className="text-xs text-muted-foreground">Siswa aktif</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Guru</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.guru}</div>
            <p className="text-xs text-muted-foreground">Guru aktif</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kelas</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.kelas}</div>
            <p className="text-xs text-muted-foreground">Kelas aktif</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mata Pelajaran</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mapel}</div>
            <p className="text-xs text-muted-foreground">Total mapel</p>
          </CardContent>
        </Card>
      </div>

      {/* Grafik Presensi */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rekap Presensi</CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => setPeriode("minggu")}
                  className={`px-3 py-1 text-sm rounded-md ${periode === "minggu" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  1 Minggu
                </button>
                <button
                  onClick={() => setPeriode("bulan")}
                  className={`px-3 py-1 text-sm rounded-md ${periode === "bulan" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  1 Bulan
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={presensiData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tanggal" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="hadir" stroke="#10b981" name="Hadir" />
                  <Line type="monotone" dataKey="terlambat" stroke="#f59e0b" name="Terlambat" />
                  <Line type="monotone" dataKey="izin" stroke="#3b82f6" name="Izin" />
                  <Line type="monotone" dataKey="sakit" stroke="#8b5cf6" name="Sakit" />
                  <Line type="monotone" dataKey="alfa" stroke="#ef4444" name="Alfa" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribusi Status Presensi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Belum ada data presensi
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabel ringkasan presensi (opsional) */}
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan Presensi ({periode === "minggu" ? "7 Hari Terakhir" : "30 Hari Terakhir"})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summaryPresensi.hadir}</div>
              <div className="text-sm text-muted-foreground">Hadir</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{summaryPresensi.terlambat}</div>
              <div className="text-sm text-muted-foreground">Terlambat</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summaryPresensi.izin}</div>
              <div className="text-sm text-muted-foreground">Izin</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{summaryPresensi.sakit}</div>
              <div className="text-sm text-muted-foreground">Sakit</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summaryPresensi.alfa}</div>
              <div className="text-sm text-muted-foreground">Alfa</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}