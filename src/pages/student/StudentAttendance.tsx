import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MapPin, QrCode, Calendar, Clock, CheckCircle, XCircle } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface SiswaData {
  id_siswa: number;
  nama: string;
  nis: string;
  id_pkl: number | null;
  id_kelas: number;
  tempat_pkl?: string;
  koordinat_pkl?: string;
}

interface JadwalHariIni {
  id_jadwal: number;
  mata_pelajaran: string;
  jam: string;
  guru: string;
  sudah_presensi: boolean;
}

export default function StudentAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"harian" | "mapel">("harian");
  
  const [siswa, setSiswa] = useState<SiswaData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Presensi harian
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{ verified: boolean; message: string } | null>(null);
  const [todayPresensi, setTodayPresensi] = useState<{ masuk?: any; pulang?: any }>({});
  
  // Presensi mapel
  const [jadwalHariIni, setJadwalHariIni] = useState<JadwalHariIni[]>([]);
  const [scanningJadwalId, setScanningJadwalId] = useState<number | null>(null);
  const [isLoadingJadwal, setIsLoadingJadwal] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerContainerId = "qr-reader";

  // Koordinat sekolah
  const SCHOOL_COORD = { lat: -7.316156236652295, lng: 112.72532308933857 };

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

  // Ambil jadwal hari ini dan cek status presensi
  useEffect(() => {
    if (!siswa) return;
    const fetchJadwalHariIni = async () => {
      setIsLoadingJadwal(true);
      try {
        const today = new Date();
        const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const hariIni = daysMap[today.getDay()];
        
        // Ambil jadwal untuk kelas siswa
        const { data: jadwalData, error: jadwalError } = await supabase
          .from("jadwal")
          .select(`
            id_jadwal,
            jam,
            mapel:mata_pelajaran (nama),
            guru:guru (nama)
          `)
          .eq("id_kelas", siswa.id_kelas)
          .eq("hari", hariIni)
          .eq("aktif", true);
        if (jadwalError) throw jadwalError;
        
        // Ambil presensi mapel yang sudah dilakukan hari ini
        const start = `${today.toISOString().split("T")[0]}T00:00:00`;
        const end = `${today.toISOString().split("T")[0]}T23:59:59`;
        const { data: presensiData, error: presensiError } = await supabase
          .from("presensi_siswa_mapel")
          .select("id_jadwal")
          .eq("id_siswa", siswa.id_siswa)
          .gte("waktu_presensi", start)
          .lte("waktu_presensi", end);
        if (presensiError) throw presensiError;
        
        const sudahPresensiIds = new Set(presensiData?.map(p => p.id_jadwal) || []);
        
        const formatted: JadwalHariIni[] = (jadwalData || []).map((item: any) => ({
          id_jadwal: item.id_jadwal,
          mata_pelajaran: item.mapel?.nama || "-",
          jam: item.jam,
          guru: item.guru?.nama || "-",
          sudah_presensi: sudahPresensiIds.has(item.id_jadwal),
        }));
        setJadwalHariIni(formatted);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setIsLoadingJadwal(false);
      }
    };
    fetchJadwalHariIni();
  }, [siswa]);

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
            targetCoord = { lat: pklLat, lng: pklLng };
            targetName = siswa.tempat_pkl || "Tempat PKL";
          }
          
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
      
      // Refresh
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

  const startScanner = (jadwalId: number) => {
    setScanningJadwalId(jadwalId);
    // Bersihkan scanner sebelumnya jika ada
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    // Tunggu sebentar agar DOM siap
    setTimeout(() => {
      const element = document.getElementById(scannerContainerId);
      if (element) {
        element.innerHTML = ""; // kosongkan
        scannerRef.current = new Html5QrcodeScanner(
          scannerContainerId,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scannerRef.current.render(onScanSuccess, onScanError);
      } else {
        toast({ title: "Error", description: "Elemen scanner tidak ditemukan", variant: "destructive" });
      }
    }, 100);
  };

  const onScanSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanningJadwalId(null);
    await processQRCode(decodedText);
  };

  const onScanError = (error: any) => {
    console.error(error);
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
      // Cek hari
      const today = new Date();
      const daysMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const hariIni = daysMap[today.getDay()];
      if (jadwal.hari !== hariIni) {
        toast({ title: "Bukan hari ini", description: `Jadwal ini untuk hari ${jadwal.hari}`, variant: "destructive" });
        return;
      }
      // Cek waktu (toleransi 15 menit sebelum hingga 45 menit setelah)
      const [startHour, startMin] = jadwal.jam.split(" - ")[0].split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const currentMinutes = today.getHours() * 60 + today.getMinutes();
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
      // Simpan presensi mapel
      const { error: insertError } = await supabase.from("presensi_siswa_mapel").insert({
        id_siswa: siswa!.id_siswa,
        id_jadwal: id_jadwal,
        status: "Hadir",
        waktu_presensi: new Date().toISOString(),
      });
      if (insertError) {
        if (insertError.code === "23505") {
          toast({ title: "Sudah presensi", description: "Anda sudah melakukan presensi untuk jadwal ini", variant: "destructive" });
        } else {
          throw insertError;
        }
      } else {
        toast({ title: "Berhasil", description: `Presensi ${jadwal.mapel?.nama} tercatat` });
        // Refresh daftar jadwal
        const todayStr = today.toISOString().split("T")[0];
        const start = `${todayStr}T00:00:00`;
        const end = `${todayStr}T23:59:59`;
        const { data: presensiData } = await supabase
          .from("presensi_siswa_mapel")
          .select("id_jadwal")
          .eq("id_siswa", siswa!.id_siswa)
          .gte("waktu_presensi", start)
          .lte("waktu_presensi", end);
        const sudahPresensiIds = new Set(presensiData?.map(p => p.id_jadwal) || []);
        setJadwalHariIni(prev => prev.map(j => ({
          ...j,
          sudah_presensi: sudahPresensiIds.has(j.id_jadwal)
        })));
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanningJadwalId(null);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Presensi Siswa</CardTitle>
          <CardDescription>Lakukan presensi harian dan presensi mata pelajaran</CardDescription>
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
                  <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Presensi Masuk</CardTitle></CardHeader>
                  <CardContent>
                    {todayPresensi.masuk ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <span>Sudah presensi pada {new Date(todayPresensi.masuk.waktu_presensi).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">Status: {todayPresensi.masuk.status_presensi}</div>
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
                  <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Presensi Pulang</CardTitle></CardHeader>
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

            {/* Presensi Mapel */}
            <TabsContent value="mapel" className="space-y-6">
              {isLoadingJadwal ? (
                <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : jadwalHariIni.length === 0 ? (
                <Alert><AlertDescription>Tidak ada jadwal mata pelajaran untuk hari ini.</AlertDescription></Alert>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Jadwal Mata Pelajaran Hari Ini:</h3>
                  <div className="grid gap-4">
                    {jadwalHariIni.map((jadwal) => (
                      <Card key={jadwal.id_jadwal}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{jadwal.mata_pelajaran}</h4>
                              <p className="text-sm text-muted-foreground">Jam: {jadwal.jam}</p>
                              <p className="text-sm text-muted-foreground">Guru: {jadwal.guru}</p>
                            </div>
                            {jadwal.sudah_presensi ? (
                              <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="h-5 w-5" />
                                <span>Sudah presensi</span>
                              </div>
                            ) : scanningJadwalId === jadwal.id_jadwal ? (
                              <div>
                                <div id={scannerContainerId} className="w-80"></div>
                                <Button onClick={stopScanner} variant="outline" size="sm" className="mt-2">Batal Scan</Button>
                              </div>
                            ) : (
                              <Button onClick={() => startScanner(jadwal.id_jadwal)} variant="default" size="sm">
                                <QrCode className="mr-2 h-4 w-4" /> Scan QR
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}