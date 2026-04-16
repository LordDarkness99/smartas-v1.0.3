import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  BookOpen,
  User,
  School,
  Sun,
  Moon,
  Cloud,
  Sparkles,
  Activity,
  CheckCircle,
  XCircle,
  Search,
  Users,
  GraduationCap,
  MapPin,
  Home,
  Briefcase,
  Star,
  Heart,
  Download,
  Upload,
  Filter,
  Eye,
  EyeOff,
  Printer,
  Copy,
  Save,
  FileText,
  Archive,
  Settings,
  Bell,
  Phone,
  Mail,
  Globe,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Github,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Shield,
  Smartphone,
  Trophy,
  TrendingUp,
  Info,
  Fingerprint,
  QrCode,
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
  nip?: string;
  email?: string;
  phone?: string;
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

interface StatistikJadwal {
  totalJadwal: number;
  totalKelas: number;
  totalMapel: number;
  totalGuru: number;
  hariTersibuk: string;
  jamTersibuk: string;
  guruTersibuk: string;
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
  return t1.start < t2.end && t2.start < t1.end;
}

// Komponen LayoutGrid dan List
const LayoutGrid = ({ className, ...props }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

const ListIcon = ({ className, ...props }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export default function ScheduleManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"jadwal" | "mapel">("jadwal");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [searchTerm, setSearchTerm] = useState("");

  // State untuk jadwal
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);
  const [selectedKelas, setSelectedKelas] = useState<string>("");
  const [selectedHari, setSelectedHari] = useState<string>("Senin");
  const [isFetchingJadwal, setIsFetchingJadwal] = useState(false);
  const [statistik, setStatistik] = useState<StatistikJadwal>({
    totalJadwal: 0,
    totalKelas: 0,
    totalMapel: 0,
    totalGuru: 0,
    hariTersibuk: "-",
    jamTersibuk: "-",
    guruTersibuk: "-",
  });

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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
  const [mapelSearchTerm, setMapelSearchTerm] = useState("");

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 4) setGreeting("Selamat Malam");
    else if (hour < 11) setGreeting("Selamat Pagi");
    else if (hour < 15) setGreeting("Selamat Siang");
    else if (hour < 19) setGreeting("Selamat Sore");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== FORMAT DATE ====================
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }, []);

  // ==================== GET GREETING ICON ====================
  const getGreetingIcon = () => {
    if (greeting === "Selamat Pagi") return <Sun className="h-4 w-4" />;
    if (greeting === "Selamat Siang") return <Cloud className="h-4 w-4" />;
    if (greeting === "Selamat Sore") return <Cloud className="h-4 w-4" />;
    return <Moon className="h-4 w-4" />;
  };

  // ==================== GET STATUS COLOR ====================
  const getStatusColor = (aktif: boolean) => {
    return aktif ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
  };

  // ==================== GET HARI COLOR ====================
  const getHariColor = (hari: string) => {
    const colors: Record<string, string> = {
      "Senin": "bg-blue-100 text-blue-700",
      "Selasa": "bg-teal-100 text-teal-700",
      "Rabu": "bg-emerald-100 text-emerald-700",
      "Kamis": "bg-amber-100 text-amber-700",
      "Jumat": "bg-purple-100 text-purple-700",
      "Sabtu": "bg-rose-100 text-rose-700",
    };
    return colors[hari] || "bg-slate-100 text-slate-700";
  };

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
      .select("id_guru, nama, nip")
      .eq("aktif", true)
      .order("nama");
    if (error) console.error(error);
    else setGuruList(data || []);
  };

  const fetchMapel = async () => {
    setIsFetchingMapel(true);
    const { data, error } = await supabase
      .from("mata_pelajaran")
      .select("*")
      .order("nama");
    if (error) console.error(error);
    else setMapelData(data || []);
    setIsFetchingMapel(false);
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
      
      // Update statistik
      const totalKelas = new Set(data?.map(j => j.id_kelas)).size;
      const totalMapel = new Set(data?.map(j => j.id_mapel)).size;
      const totalGuru = new Set(data?.map(j => j.id_guru)).size;
      
      const hariCount: Record<string, number> = {};
      const jamCount: Record<string, number> = {};
      const guruCount: Record<string, number> = {};
      
      data?.forEach(j => {
        hariCount[j.hari] = (hariCount[j.hari] || 0) + 1;
        const jamMulai = j.jam.split(" - ")[0];
        jamCount[jamMulai] = (jamCount[jamMulai] || 0) + 1;
        guruCount[(j.guru as any)?.nama || "-"] = (guruCount[(j.guru as any)?.nama || "-"] || 0) + 1;
      });
      
      const hariTersibuk = Object.entries(hariCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      const jamTersibuk = Object.entries(jamCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      const guruTersibuk = Object.entries(guruCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      
      setStatistik({
        totalJadwal: data?.length || 0,
        totalKelas,
        totalMapel,
        totalGuru,
        hariTersibuk,
        jamTersibuk,
        guruTersibuk,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingJadwal(false);
    }
  };

  // ========== INITIAL FETCH ==========
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchKelas(), fetchGuru(), fetchMapel()]);
      setLoading(false);
    };
    init();
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
    
    for (const jadwal of data || []) {
      if (isTimeOverlap(jadwal.jam, jam)) {
        return true;
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
    setFormErrors({});
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
    setFormErrors({});
    setJadwalForm({
      id_kelas: jadwal.id_kelas.toString(),
      id_mapel: jadwal.id_mapel.toString(),
      id_guru: jadwal.id_guru.toString(),
      hari: jadwal.hari,
      jam: jadwal.jam,
    });
    setJadwalDialogOpen(true);
  };

  const validateJadwalForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!jadwalForm.id_kelas) errors.id_kelas = "Kelas harus dipilih";
    if (!jadwalForm.id_mapel) errors.id_mapel = "Mata pelajaran harus dipilih";
    if (!jadwalForm.id_guru) errors.id_guru = "Guru harus dipilih";
    if (!jadwalForm.jam) errors.jam = "Jam harus diisi";
    
    const jamPattern = /^\d{2}:\d{2} - \d{2}:\d{2}$/;
    if (jadwalForm.jam && !jamPattern.test(jadwalForm.jam)) {
      errors.jam = "Format jam harus 'HH:MM - HH:MM'";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveJadwal = async () => {
    if (!validateJadwalForm()) return;

    const kelasId = parseInt(jadwalForm.id_kelas);
    const mapelId = parseInt(jadwalForm.id_mapel);
    const guruId = parseInt(jadwalForm.id_guru);
    const hari = jadwalForm.hari;
    const jam = jadwalForm.jam;
    const excludeId = editingJadwal?.id_jadwal;

    setIsSavingJadwal(true);
    try {
      const isOverlapMapel = await checkOverlapJadwal(kelasId, mapelId, hari, jam, excludeId);
      if (isOverlapMapel) {
        toast({
          title: "Error",
          description: `Jadwal untuk kelas dan mata pelajaran ini sudah ada pada jam yang tumpang tindih di hari ${hari}.`,
          variant: "destructive",
        });
        return;
      }

      const isGuruOverlap = await checkGuruOverlap(guruId, hari, jam, excludeId);
      if (isGuruOverlap) {
        toast({
          title: "Error",
          description: `Guru sudah memiliki jadwal lain di hari ${hari} pada jam yang tumpang tindih.`,
          variant: "destructive",
        });
        return;
      }

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

  // ========== CRUD MATA PELAJARAN ==========
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

  // ========== HANDLE REFRESH ==========
  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchJadwal(), fetchMapel()]).finally(() => setRefreshing(false));
  };

  // ========== FILTER MAPEL ==========
  const filteredMapel = useMemo(() => {
    if (!mapelSearchTerm) return mapelData;
    return mapelData.filter(m => 
      m.nama.toLowerCase().includes(mapelSearchTerm.toLowerCase()) ||
      m.id_mapel.toString().includes(mapelSearchTerm)
    );
  }, [mapelData, mapelSearchTerm]);

  // ========== LOADING STATE ==========
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-50 animate-pulse" />
            <Loader2 className="h-16 w-16 animate-spin text-blue-600 relative mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-slate-600 font-medium">Memuat Manajemen Jadwal</p>
            <div className="flex gap-1 justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-3xl shadow-xl mx-4 mt-4">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <Calendar className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {getGreetingIcon()}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Manajemen Jadwal & Mata Pelajaran</h1>
                <p className="text-blue-100 text-sm">
                  Atur jadwal pelajaran per kelas dan kelola daftar mata pelajaran
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm text-center">
                <p className="text-xs text-blue-100">{formatDate(currentTime)}</p>
                <p className="text-xl font-semibold">{currentTime.toLocaleTimeString("id-ID")}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-white/10 hover:bg-white/20 text-white rounded-xl"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Kelas</p>
                  <p className="text-2xl font-bold text-blue-900">{kelasList.length}</p>
                </div>
                <School className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Total Mapel</p>
                  <p className="text-2xl font-bold text-emerald-900">{mapelData.length}</p>
                </div>
                <BookOpen className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Total Guru</p>
                  <p className="text-2xl font-bold text-purple-900">{guruList.length}</p>
                </div>
                <User className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Total Jadwal</p>
                  <p className="text-2xl font-bold text-amber-900">{statistik.totalJadwal}</p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* STATISTIK DETAIL CARD */}
        {activeTab === "jadwal" && selectedKelas && jadwalList.length > 0 && (
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-300">Total Jadwal</p>
                  <p className="text-2xl font-bold">{statistik.totalJadwal}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-300">Hari Tersibuk</p>
                  <p className="text-lg font-semibold">{statistik.hariTersibuk}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-300">Jam Tersibuk</p>
                  <p className="text-lg font-semibold">{statistik.jamTersibuk}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-300">Guru Tersibuk</p>
                  <p className="text-lg font-semibold truncate">{statistik.guruTersibuk}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* MAIN TABS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-xl">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Manajemen Jadwal & Mata Pelajaran</CardTitle>
                  <CardDescription className="text-slate-300 text-sm">
                    Atur jadwal pelajaran per kelas dan kelola daftar mata pelajaran
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {activeTab === "jadwal" && (
                  <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`rounded-lg text-white ${viewMode === "table" ? "bg-white/20" : ""}`}
                      onClick={() => setViewMode("table")}
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      Tabel
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`rounded-lg text-white ${viewMode === "card" ? "bg-white/20" : ""}`}
                      onClick={() => setViewMode("card")}
                    >
                      <ListIcon className="h-4 w-4 mr-1" />
                      Kartu
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
              <div className="flex justify-center">
                <TabsList className="bg-slate-100 p-1 rounded-xl w-auto inline-flex">
                  <TabsTrigger value="jadwal" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    Jadwal Pelajaran
                  </TabsTrigger>
                  <TabsTrigger value="mapel" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-2 px-4 py-1.5 text-sm">
                    <BookOpen className="h-3.5 w-3.5" />
                    Mata Pelajaran
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* TAB JADWAL */}
              <TabsContent value="jadwal" className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-end justify-center">
                  <div className="w-64">
                    <Label className="text-slate-700 font-medium">Kelas</Label>
                    <Select value={selectedKelas} onValueChange={setSelectedKelas}>
                      <SelectTrigger className="rounded-xl border-slate-200 h-9 text-sm">
                        <SelectValue placeholder="Pilih Kelas" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {kelasList.map((kelas) => (
                          <SelectItem key={kelas.id_kelas} value={kelas.id_kelas.toString()}>
                            {kelas.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label className="text-slate-700 font-medium">Hari</Label>
                    <Select value={selectedHari} onValueChange={setSelectedHari}>
                      <SelectTrigger className="rounded-xl border-slate-200 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {HARI.map((hari) => (
                          <SelectItem key={hari} value={hari}>{hari}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={fetchJadwal} disabled={!selectedKelas || isFetchingJadwal} className="rounded-xl h-9 text-sm">
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingJadwal ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button onClick={openAddJadwal} disabled={!selectedKelas} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Jadwal
                  </Button>
                </div>

                {!selectedKelas && (
                  <Alert className="rounded-xl bg-amber-50 border-amber-200 max-w-md mx-auto">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700">
                      Silakan pilih kelas ter dahulu
                    </AlertDescription>
                  </Alert>
                )}

                {selectedKelas && (
                  viewMode === "table" ? (
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="font-semibold">Jam</TableHead>
                              <TableHead className="font-semibold">Mata Pelajaran</TableHead>
                              <TableHead className="font-semibold">Guru</TableHead>
                              <TableHead className="font-semibold text-center">Hari</TableHead>
                              <TableHead className="font-semibold text-center w-24">Aksi</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {isFetchingJadwal ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                                </TableCell>
                              </TableRow>
                            ) : jadwalList.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                  <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                  Tidak ada jadwal untuk hari {selectedHari}
                                </TableCell>
                              </TableRow>
                            ) : (
                              jadwalList.map((jadwal) => (
                                <TableRow key={jadwal.id_jadwal} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="font-mono text-sm font-medium">{jadwal.jam}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="bg-blue-100 p-1.5 rounded-lg">
                                        <BookOpen className="h-4 w-4 text-blue-600" />
                                      </div>
                                      <span className="font-medium">{(jadwal.mapel as any)?.nama || "-"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="bg-purple-100 p-1.5 rounded-lg">
                                        <User className="h-4 w-4 text-purple-600" />
                                      </div>
                                      <span>{(jadwal.guru as any)?.nama || "-"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={`${getHariColor(jadwal.hari)} border-0 rounded-full px-3 py-1`}>
                                      {jadwal.hari}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex gap-1 justify-center">
                                      <Button variant="ghost" size="sm" onClick={() => openEditJadwal(jadwal)} className="h-8 w-8 p-0 rounded-lg">
                                        <Edit className="h-4 w-4 text-blue-500" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => confirmDeleteJadwal(jadwal)} className="h-8 w-8 p-0 rounded-lg">
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
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {jadwalList.map((jadwal) => (
                        <Card key={jadwal.id_jadwal} className="rounded-xl border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group">
                          <div className={`absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rounded-full ${getHariColor(jadwal.hari)} opacity-20 group-hover:scale-150 transition-transform duration-500`} />
                          <CardContent className="p-4 relative z-10">
                            <div className="flex items-start justify-between mb-3">
                              <Badge className={`${getHariColor(jadwal.hari)} border-0 rounded-full`}>
                                {jadwal.hari}
                              </Badge>
                              <span className="font-mono text-sm font-bold text-slate-700">{jadwal.jam}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-100 p-2 rounded-xl">
                                  <BookOpen className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="font-semibold text-slate-800">{(jadwal.mapel as any)?.nama || "-"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="bg-purple-100 p-2 rounded-xl">
                                  <User className="h-4 w-4 text-purple-600" />
                                </div>
                                <span className="text-sm text-slate-600">{(jadwal.guru as any)?.nama || "-"}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3 pt-3 border-t">
                              <Button variant="ghost" size="sm" onClick={() => openEditJadwal(jadwal)} className="flex-1 rounded-lg">
                                <Edit className="h-4 w-4 mr-1" /> Edit
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => confirmDeleteJadwal(jadwal)} className="flex-1 rounded-lg text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4 mr-1" /> Hapus
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )
                )}
              </TabsContent>

              {/* TAB MATA PELAJARAN */}
              <TabsContent value="mapel" className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <Button onClick={openAddMapel} className="rounded-xl h-9 text-sm bg-gradient-to-r from-blue-600 to-indigo-600">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Mata Pelajaran
                  </Button>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input 
                        placeholder="Cari mapel..." 
                        value={mapelSearchTerm}
                        onChange={(e) => setMapelSearchTerm(e.target.value)}
                        className="pl-9 rounded-xl w-64 h-9 text-sm"
                      />
                    </div>
                    <Button variant="outline" onClick={fetchMapel} disabled={isFetchingMapel} className="rounded-xl h-9 text-sm">
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetchingMapel ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold w-20">ID</TableHead>
                          <TableHead className="font-semibold">Nama Mata Pelajaran</TableHead>
                          <TableHead className="font-semibold text-center w-24">Status</TableHead>
                          <TableHead className="font-semibold text-center w-24">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isFetchingMapel ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500" />
                            </TableCell>
                          </TableRow>
                        ) : filteredMapel.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                              <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                              {mapelSearchTerm ? "Tidak ada mata pelajaran yang cocok" : "Belum ada mata pelajaran"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredMapel.map((mapel) => (
                            <TableRow key={mapel.id_mapel} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-mono text-sm">{mapel.id_mapel}</TableCell>
                              <TableCell className="font-medium">{mapel.nama}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${getStatusColor(mapel.aktif)} border-0 rounded-full px-3 py-1`}>
                                  {mapel.aktif ? "Aktif" : "Nonaktif"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button variant="ghost" size="sm" onClick={() => openEditMapel(mapel)} className="h-8 w-8 p-0 rounded-lg">
                                    <Edit className="h-4 w-4 text-blue-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => confirmDeleteMapel(mapel)} className="h-8 w-8 p-0 rounded-lg">
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
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50 max-w-3xl mx-auto">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 p-3 rounded-xl flex-shrink-0">
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Tips Mengelola Jadwal</h3>
                <p className="text-sm text-slate-600">
                  Pastikan tidak ada tumpang tindih jadwal untuk guru yang sama. Sistem akan otomatis memvalidasi 
                  overlap jadwal saat menambahkan atau mengedit jadwal. Gunakan filter kelas dan hari untuk melihat 
                  jadwal spesifik.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Manajemen Jadwal - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Sistem Informasi Akademik
          </p>
        </div>
      </div>

      {/* Dialog Jadwal */}
      <Dialog open={jadwalDialogOpen} onOpenChange={setJadwalDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              {editingJadwal ? "Edit Jadwal" : "Tambah Jadwal"}
            </DialogTitle>
            <DialogDescription>
              {editingJadwal ? "Ubah informasi jadwal yang sudah ada" : "Isi form berikut untuk menambahkan jadwal baru"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-700">Kelas</Label>
              <Select value={jadwalForm.id_kelas} onValueChange={(v) => setJadwalForm({ ...jadwalForm, id_kelas: v })}>
                <SelectTrigger className={`rounded-xl mt-1 ${formErrors.id_kelas ? "border-red-500" : ""}`}>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {kelasList.map((k) => (
                    <SelectItem key={k.id_kelas} value={k.id_kelas.toString()}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.id_kelas && <p className="text-xs text-red-500 mt-1">{formErrors.id_kelas}</p>}
            </div>
            <div>
              <Label className="text-slate-700">Mata Pelajaran</Label>
              <Select value={jadwalForm.id_mapel} onValueChange={(v) => setJadwalForm({ ...jadwalForm, id_mapel: v })}>
                <SelectTrigger className={`rounded-xl mt-1 ${formErrors.id_mapel ? "border-red-500" : ""}`}>
                  <SelectValue placeholder="Pilih Mapel" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {mapelData.map((m) => (
                    <SelectItem key={m.id_mapel} value={m.id_mapel.toString()}>{m.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.id_mapel && <p className="text-xs text-red-500 mt-1">{formErrors.id_mapel}</p>}
            </div>
            <div>
              <Label className="text-slate-700">Guru</Label>
              <Select value={jadwalForm.id_guru} onValueChange={(v) => setJadwalForm({ ...jadwalForm, id_guru: v })}>
                <SelectTrigger className={`rounded-xl mt-1 ${formErrors.id_guru ? "border-red-500" : ""}`}>
                  <SelectValue placeholder="Pilih Guru" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {guruList.map((g) => (
                    <SelectItem key={g.id_guru} value={g.id_guru.toString()}>{g.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.id_guru && <p className="text-xs text-red-500 mt-1">{formErrors.id_guru}</p>}
            </div>
            <div>
              <Label className="text-slate-700">Hari</Label>
              <Select value={jadwalForm.hari} onValueChange={(v) => setJadwalForm({ ...jadwalForm, hari: v })}>
                <SelectTrigger className="rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {HARI.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700">Jam (contoh: 07:30 - 09:00)</Label>
              <Input 
                value={jadwalForm.jam} 
                onChange={(e) => setJadwalForm({ ...jadwalForm, jam: e.target.value })} 
                placeholder="07:30 - 09:00"
                className={`rounded-xl mt-1 ${formErrors.jam ? "border-red-500" : ""}`}
              />
              {formErrors.jam && <p className="text-xs text-red-500 mt-1">{formErrors.jam}</p>}
              <p className="text-xs text-slate-400 mt-1">Format: HH:MM - HH:MM (contoh: 07:30 - 09:00)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJadwalDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleSaveJadwal} disabled={isSavingJadwal} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
              {isSavingJadwal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Jadwal */}
      <Dialog open={deleteJadwalDialogOpen} onOpenChange={setDeleteJadwalDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Hapus Jadwal
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Yakin ingin menghapus jadwal <strong>{deletingJadwal?.mapel?.nama || "ini"}</strong>?
            <p className="text-sm text-red-500 mt-2">⚠️ Tindakan ini tidak dapat dibatalkan.</p>
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteJadwalDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button variant="destructive" onClick={handleDeleteJadwal} disabled={isSavingJadwal} className="rounded-xl">
              {isSavingJadwal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mata Pelajaran */}
      <Dialog open={mapelDialogOpen} onOpenChange={setMapelDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              {editingMapel ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-slate-700">Nama Mata Pelajaran</Label>
            <Input 
              value={mapelForm.nama} 
              onChange={(e) => setMapelForm({ nama: e.target.value })} 
              placeholder="Contoh: Matematika, Fisika, Bahasa Indonesia"
              className="rounded-xl mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapelDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={handleSaveMapel} disabled={isSavingMapel} className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600">
              {isSavingMapel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Delete Mapel */}
      <Dialog open={deleteMapelDialogOpen} onOpenChange={setDeleteMapelDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Hapus Mata Pelajaran
            </DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Yakin ingin menghapus mata pelajaran <strong>{deletingMapel?.nama}</strong>?
            <p className="text-sm text-red-500 mt-2">⚠️ Jika ada jadwal yang menggunakannya, penghapusan akan ditolak.</p>
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMapelDialogOpen(false)} className="rounded-xl">Batal</Button>
            <Button variant="destructive" onClick={handleDeleteMapel} disabled={isSavingMapel} className="rounded-xl">
              {isSavingMapel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}