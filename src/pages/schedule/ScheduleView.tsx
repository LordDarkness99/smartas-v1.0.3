import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calendar, BookOpen, User } from "lucide-react";

interface JadwalItem {
  id_jadwal: number;
  hari: string;
  jam: string;
  mata_pelajaran: string;
  guru: string;
  id_kelas: number;
  kelas_nama: string;
}

interface Kelas {
  id_kelas: number;
  nama: string;
}

export default function ScheduleView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jadwal, setJadwal] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kelasSiswa, setKelasSiswa] = useState<Kelas | null>(null);
  const [activeDay, setActiveDay] = useState<string>("Senin");

  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  // Ambil data jadwal berdasarkan role
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!user) return;
      setLoading(true);
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

        if (user.peran === "siswa") {
          // Ambil kelas siswa
          const { data: siswa, error: siswaError } = await supabase
            .from("siswa")
            .select("id_kelas, kelas:kelas(id_kelas, nama)")
            .eq("id_siswa", user.id_siswa)
            .single();
          if (siswaError) throw siswaError;
          if (siswa.id_kelas) {
            setKelasSiswa({ id_kelas: siswa.id_kelas, nama: siswa.kelas?.nama || "-" });
            query = query.eq("id_kelas", siswa.id_kelas);
          } else {
            setJadwal([]);
            setLoading(false);
            return;
          }
        } else if (user.peran === "guru" && user.id_guru) {
          query = query.eq("id_guru", user.id_guru);
        }

        const { data, error } = await query.order("jam");
        if (error) throw error;

        const formatted: JadwalItem[] = data.map((item: any) => ({
          id_jadwal: item.id_jadwal,
          hari: item.hari,
          jam: item.jam,
          mata_pelajaran: item.mapel?.nama || "-",
          guru: item.guru?.nama || "-",
          id_kelas: item.id_kelas,
          kelas_nama: item.kelas?.nama || "-",
        }));
        setJadwal(formatted);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [user]);

  // Filter jadwal berdasarkan hari
  const jadwalByDay = (hari: string) => {
    return jadwal.filter(j => j.hari === hari).sort((a, b) => {
      const aStart = a.jam.split(" - ")[0];
      const bStart = b.jam.split(" - ")[0];
      return aStart.localeCompare(bStart);
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Jadwal Mata Pelajaran
          </CardTitle>
          {user?.peran === "siswa" && kelasSiswa && (
            <p className="text-muted-foreground">Kelas: {kelasSiswa.nama}</p>
          )}
          {user?.peran === "guru" && (
            <p className="text-muted-foreground">Jadwal mengajar Anda</p>
          )}
        </CardHeader>
        <CardContent>
          <Tabs value={activeDay} onValueChange={setActiveDay}>
            <TabsList className="grid w-full grid-cols-6 mb-6">
              {days.map(day => (
                <TabsTrigger key={day} value={day}>{day}</TabsTrigger>
              ))}
            </TabsList>
            {days.map(day => {
              const dayJadwal = jadwalByDay(day);
              return (
                <TabsContent key={day} value={day}>
                  {dayJadwal.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Tidak ada jadwal untuk hari {day}
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Jam</TableHead>
                            <TableHead>Mata Pelajaran</TableHead>
                            <TableHead>Guru</TableHead>
                            {user?.peran === "guru" && <TableHead>Kelas</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dayJadwal.map((item) => (
                            <TableRow key={item.id_jadwal}>
                              <TableCell>{item.jam}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                                  {item.mata_pelajaran}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  {item.guru}
                                </div>
                              </TableCell>
                              {user?.peran === "guru" && (
                                <TableCell>{item.kelas_nama}</TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}