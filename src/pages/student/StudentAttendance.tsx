import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MapPin, QrCode, Calendar, Clock, CheckCircle, XCircle, X } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

// Interface untuk data siswa
interface SiswaData {
  id_siswa: number;
  nama: string;
  nis: string;
  id_pkl: number | null;
  id_kelas: number;
  tempat_pkl?: string;
  koordinat_pkl?: string;
}

// Interface untuk presensi harian
interface PresensiHarian {
  id_pres_harian: number;
  status_presensi: string;
  waktu_presensi: string;
}

// Interface untuk jadwal hari ini
interface JadwalHariIni {
  id_jadwal: number;
  mata_pelajaran: string;
  jam: string;
  guru: string;
  sudahPresensi: boolean;
}

// Koordinat sekolah
const SCHOOL_COORD = { lat: -7.316156236652295, lng: 112.72532308933857 };

export default function StudentAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");
  
  // State data siswa
  const [siswa, setSiswa] = useState<SiswaData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State presensi harian
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{ verified: boolean; message: string } | null>(null);
  const [todayPresensi, setTodayPresensi] = useState<{ masuk?: PresensiHarian; pulang?: PresensiHarian }>({});
  
  // State jadwal hari ini
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalHariIni[]>([]);
  const [loadingJadwal, setLoadingJadwal] = useState(false);
  
  // State untuk scan QR
  const [scanningJadwalId, setScanningJadwalId] = useState<number | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerContainerId = "qr-reader";

  // Ambil data siswa
  useEffect(() => {
    const fetchSiswaData = async () => {
      if (!user?.id_siswa) return;
      try {
        const { data, error } = await supabase
          .from("siswa")
          .select(`
            id_siswa,
            nama,
            nis,
            id_pkl,
            id_kelas,
            pkl:pkl (tempat_pkl, koordinat_pkl)
          `)
          .eq("id_siswa", user.id_siswa)
          .single();
        if (error) throw error;
        setSiswa({
          id_siswa: data.id_siswa,
          nama: data.nama,
          nis: data.nis?.toString() || "",
          id_pkl: data.id_pkl,
          id_kelas: data.id_kelas,
          tempat_pkl: data.pkl?.tempat_pkl,
          koordinat_pkl: data.pkl?.koordinat_pkl,
        });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchSiswaData();
  }, [user]);

  // Ambil presensi harian hari ini
  useEffect(() => {
    if (!siswa) return;
    const fetchTodayPresensi = async () => {
      const today = new Date().toISOString().split("T")[0];
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data, error } = await supabase
        .from("presensi_harian")
        .select("*")
        .eq("id_siswa", siswa.id_siswa)
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      if (error) {
        console.error(error);
        return;
      }
      const masuk = data?.find(p => p.status_presensi === "Hadir" || p.status_presensi === "Terlambat");
      const pulang = data?.find(p => p.status_presensi === "Pulang");
      setTodayPresensi({ masuk, pulang });
    };
    fetchTodayPresensi();
  }, [siswa]);

  // Ambil jadwal hari ini
  useEffect(() => {
    if (!siswa) return;
    const fetchJadwalHariIni = async () => {
      setLoadingJadwal(true);
      try {
        const daysMap: Record<string, string> = {
          "Monday": "Senin", "Tuesday": "Selasa", "Wednesday": "Rabu",
          "Thursday": "Kamis", "Friday": "Jumat", "Saturday": "Sabtu", "Sunday": "Minggu"
        };
        const today = new Date();
        const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
        const hariIndonesia = daysMap[dayName];
        
        // Ambil jadwal untuk kelas siswa pada hari ini
        const { data: jadwalData, error: jadwalError } = await supabase
          .from("jadwal")
          .select(`
            id_jadwal,
            jam,
            mapel:mata_pelajaran (nama),
            guru:guru (nama)
          `)
          .eq("id_kelas", siswa.id_kelas)
          .eq("hari", hariIndonesia)
          .eq("aktif", true);
        if (jadwalError) throw jadwalError;
        
        // Ambil presensi mapel yang sudah dilakukan siswa hari ini
        const todayStart = `${today.toISOString().split("T")[0]}T00:00:00`;
        const todayEnd = `${today.toISOString().split("T")[0]}T23:59:59`;
        const { data: presensiMapel, error: presensiError } = await supabase
          .from("presensi_siswa_mapel")
          .select("id_jadwal")
          .eq("id_siswa", siswa.id_siswa)
          .gte("waktu_presensi", todayStart)
          .lte("waktu_presensi", todayEnd);
        if (presensiError) throw presensiError;
        
        const sudahPresensiIds = new Set(presensiMapel?.map(p => p.id_jadwal) || []);
        
        const formatted: JadwalHariIni[] = (jadwalData || []).map((item: any) => ({
          id_jadwal: item.id_jadwal,
          mata_pelajaran: item.mapel?.nama || "-",
          jam: item.jam,
          guru: item.guru?.nama || "-",
          sudahPresensi: sudahPresensiIds.has(item.id_jadwal),
        }));
        setJadwalHariIni(formatted);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoadingJadwal(false);
      }
    };
    fetchJadwalHariIni();
  }, [siswa]);

  // Validasi lokasi
  const validateLocation = async (): Promise<{ valid: boolean; message: string }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ valid: false, message: "Browser tidak mendukung geolocation" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          let targetCoord = SCHOOL_COORD;
          let targetName = "Sekolah";
          
          if (siswa?.id_pkl && siswa.koordinat_pkl) {
            const [pklLat, pklLng] = siswa.koordinat_pkl.split(",").map(Number);
            if (!isNaN(pklLat) && !isNaN(pklLng)) {
              targetCoord = { lat: pklLat, lng: pklLng };
              targetName = siswa.tempat_pkl || "Tempat PKL";
            }
          }
          
          // Hitung jarak (Haversine)
          const R = 6371;
          const dLat = (targetCoord.lat - latitude) * Math.PI / 180;
          const dLng = (targetCoord.lng - longitude) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(latitude * Math.PI/180) * Math.cos(targetCoord.lat * Math.PI/180) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          const radius = 0.1; // 100 meter
          
          if (distance <= radius) {
            resolve({ valid: true, message: `Berada di ${targetName} (jarak ${distance.toFixed(2)} km)` });
          } else {
            resolve({ valid: false, message: `Anda tidak berada di ${targetName}. Jarak ${distance.toFixed(2)} km` });
          }
        },
        (error) => {
          resolve({ valid: false, message: `Gagal mendapatkan lokasi: ${error.message}` });
        }
      );
    });
  };

  // Presensi masuk
  const handleMasuk = async () => {
    setIsSubmitting(true);
    setLocationStatus(null);
    try {
      const { valid, message } = await validateLocation();
      if (!valid) {
        setLocationStatus({ verified: false, message });
        toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
        return;
      }
      setLocationStatus({ verified: true, message });
      
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const batasTerlambat = 7 * 60 + 30;
      const currentMinutes = currentHour * 60 + currentMinute;
      const status = currentMinutes <= batasTerlambat ? "Hadir" : "Terlambat";
      
      const { error } = await supabase.from("presensi_harian").insert({
        id_siswa: siswa!.id_siswa,
        status_presensi: status,
        waktu_presensi: now.toISOString(),
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: `Presensi ${status} tercatat` });
      
      const today = new Date().toISOString().split("T")[0];
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data } = await supabase
        .from("presensi_harian")
        .select("*")
        .eq("id_siswa", siswa!.id_siswa)
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      const masuk = data?.find(p => p.status_presensi === "Hadir" || p.status_presensi === "Terlambat");
      const pulang = data?.find(p => p.status_presensi === "Pulang");
      setTodayPresensi({ masuk, pulang });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Presensi pulang
  const handlePulang = async () => {
    if (!todayPresensi.masuk) {
      toast({ title: "Belum masuk", description: "Silakan presensi masuk terlebih dahulu", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setLocationStatus(null);
    try {
      const { valid, message } = await validateLocation();
      if (!valid) {
        setLocationStatus({ verified: false, message });
        toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
        return;
      }
      setLocationStatus({ verified: true, message });
      
      const { error } = await supabase.from("presensi_harian").insert({
        id_siswa: siswa!.id_siswa,
        status_presensi: "Pulang",
        waktu_presensi: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: "Berhasil", description: "Presensi pulang tercatat" });
      
      const today = new Date().toISOString().split("T")[0];
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data } = await supabase
        .from("presensi_harian")
        .select("*")
        .eq("id_siswa", siswa!.id_siswa)
        .gte("waktu_presensi", start)
        .lte("waktu_presensi", end);
      const masuk = data?.find(p => p.status_presensi === "Hadir" || p.status_presensi === "Terlambat");
      const pulang = data?.find(p => p.status_presensi === "Pulang");
      setTodayPresensi({ masuk, pulang });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mulai scan QR untuk jadwal tertentu
  const startScanner = (jadwalId: number) => {
    setScanningJadwalId(jadwalId);
    if (scannerRef.current) {
      scannerRef.current.clear();
    }
    scannerRef.current = new Html5QrcodeScanner(
      scannerContainerId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );
    scannerRef.current.render(onScanSuccess, onScanError);
  };

  const onScanSuccess = (decodedText: string, decodedResult: any) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanningJadwalId(null);
    processQRCode(decodedText);
  };

  const onScanError = (error: any) => {
    console.error(error);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanningJadwalId(null);
  };

  const processQRCode = async (qrData: string) => {
    try {
      const payload = JSON.parse(qrData);
      const { id_jadwal, timestamp } = payload;
      if (!id_jadwal) {
        toast({ title: "QR tidak valid", description: "QR Code tidak dikenali", variant: "destructive" });
        return;
      }
      // Cek kadaluarsa (1 jam)
      if (timestamp && Date.now() - timestamp > 60 * 60 * 1000) {
        toast({ title: "QR kadaluarsa", description: "QR Code sudah kadaluarsa", variant: "destructive" });
        return;
      }
      // Ambil data jadwal
      const { data: jadwal, error: jadwalError } = await supabase
        .from("jadwal")
        .select(`
          id_jadwal,
          hari,
          jam,
          id_kelas,
          mapel:mata_pelajaran (nama),
          guru:guru (nama)
        `)
        .eq("id_jadwal", id_jadwal)
        .single();
      if (jadwalError || !jadwal) {
        toast({ title: "Jadwal tidak ditemukan", variant: "destructive" });
        return;
      }
      // Cek kelas
      if (jadwal.id_kelas !== siswa?.id_kelas) {
        toast({ title: "Tidak berhak", description: "Anda tidak terdaftar di kelas ini", variant: "destructive" });
        return;
      }
      // Validasi waktu
      const now = new Date();
      const [startHour, startMin] = jadwal.jam.split(" - ")[0].split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes < startMinutes - 15 || currentMinutes > startMinutes + 45) {
        toast({ title: "Di luar waktu", description: "Presensi hanya dapat dilakukan 15 menit sebelum hingga 45 menit setelah jadwal dimulai", variant: "destructive" });
        return;
      }
      // Validasi lokasi
      const { valid, message } = await validateLocation();
      if (!valid) {
        toast({ title: "Lokasi tidak valid", description: message, variant: "destructive" });
        return;
      }
      // Simpan presensi
      const { error: insertError } = await supabase.from("presensi_siswa_mapel").insert({
        id_siswa: siswa!.id_siswa,
        id_jadwal: id_jadwal,
        status: "Hadir",
        waktu_presensi: now.toISOString(),
      });
      if (insertError) {
        if (insertError.code === "23505") {
          toast({ title: "Sudah presensi", description: "Anda sudah melakukan presensi untuk jadwal ini", variant: "destructive" });
        } else {
          throw insertError;
        }
      } else {
        toast({ title: "Berhasil", description: `Presensi ${jadwal.mapel?.nama} tercatat` });
        // Refresh jadwal untuk update status sudahPresensi
        const today = new Date();
        const daysMap: Record<string, string> = {
          "Monday": "Senin", "Tuesday": "Selasa", "Wednesday": "Rabu",
          "Thursday": "Kamis", "Friday": "Jumat", "Saturday": "Sabtu", "Sunday": "Minggu"
        };
        const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
        const hariIndonesia = daysMap[dayName];
        const { data: jadwalData, error: jadwalError2 } = await supabase
          .from("jadwal")
          .select(`
            id_jadwal,
            jam,
            mapel:mata_pelajaran (nama),
            guru:guru (nama)
          `)
          .eq("id_kelas", siswa!.id_kelas)
          .eq("hari", hariIndonesia)
          .eq("aktif", true);
        if (!jadwalError2 && jadwalData) {
          const todayStart = `${today.toISOString().split("T")[0]}T00:00:00`;
          const todayEnd = `${today.toISOString().split("T")[0]}T23:59:59`;
          const { data: presensiMapel } = await supabase
            .from("presensi_siswa_mapel")
            .select("id_jadwal")
            .eq("id_siswa", siswa!.id_siswa)
            .gte("waktu_presensi", todayStart)
            .lte("waktu_presensi", todayEnd);
          const sudahPresensiIds = new Set(presensiMapel?.map(p => p.id_jadwal) || []);
          const formatted: JadwalHariIni[] = jadwalData.map((item: any) => ({
            id_jadwal: item.id_jadwal,
            mata_pelajaran: item.mapel?.nama || "-",
            jam: item.jam,
            guru: item.guru?.nama || "-",
            sudahPresensi: sudahPresensiIds.has(item.id_jadwal),
          }));
          setJadwalHariIni(formatted);
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Presensi Siswa</CardTitle>
          <CardDescription>Lakukan presensi harian (masuk/pulang) dan presensi mata pelajaran</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="harian">Presensi Harian</TabsTrigger>
              <TabsTrigger value="mapel">Presensi Mata Pelajaran</TabsTrigger>
            </TabsList>

            {/* Presensi Harian */}
            <TabsContent value="harian" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Presensi Masuk
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {todayPresensi.masuk ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <span>Sudah presensi pada {new Date(todayPresensi.masuk.waktu_presensi).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Status: {todayPresensi.masuk.status_presensi}
                        </div>
                      </div>
                    ) : (
                      <Button onClick={handleMasuk} disabled={isSubmitting} className="w-full">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                        Presensi Masuk
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Presensi Pulang
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {todayPresensi.pulang ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span>Sudah pulang pada {new Date(todayPresensi.pulang.waktu_presensi).toLocaleTimeString()}</span>
                      </div>
                    ) : (
                      <Button onClick={handlePulang} disabled={isSubmitting || !todayPresensi.masuk} variant="outline" className="w-full">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                        Presensi Pulang
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {locationStatus && (
                <Alert variant={locationStatus.verified ? "default" : "destructive"}>
                  {locationStatus.verified ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <AlertDescription>{locationStatus.message}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Presensi Mata Pelajaran */}
            <TabsContent value="mapel" className="space-y-6">
              {loadingJadwal ? (
                <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : jadwalHariIni.length === 0 ? (
                <Alert><AlertDescription>Tidak ada jadwal mata pelajaran untuk hari ini.</AlertDescription></Alert>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold">Jadwal Mata Pelajaran Hari Ini:</h3>
                  {jadwalHariIni.map((jadwal) => (
                    <Card key={jadwal.id_jadwal} className={jadwal.sudahPresensi ? "border-green-500 bg-green-50" : ""}>
                      <CardContent className="flex justify-between items-center p-4">
                        <div>
                          <p className="font-medium">{jadwal.mata_pelajaran}</p>
                          <p className="text-sm text-muted-foreground">Jam: {jadwal.jam}</p>
                          <p className="text-sm text-muted-foreground">Guru: {jadwal.guru}</p>
                        </div>
                        {jadwal.sudahPresensi ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                            <span className="text-sm">Sudah presensi</span>
                          </div>
                        ) : (
                          <Button onClick={() => startScanner(jadwal.id_jadwal)} variant="outline">
                            <QrCode className="mr-2 h-4 w-4" />
                            Scan QR
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Scanner QR */}
              {scanningJadwalId !== null && (
                <Card className="mt-4">
                  <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle className="text-base">Scan QR Code</CardTitle>
                    <Button variant="ghost" size="sm" onClick={stopScanner}>
                      <X className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div id={scannerContainerId} className="w-full max-w-md mx-auto"></div>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      Arahkan kamera ke QR Code presensi
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}