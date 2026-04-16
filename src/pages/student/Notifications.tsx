import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  BellOff,
  Loader2,
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  User,
  Settings,
  Gift,
  Star,
  Heart,
  Smile,
  ThumbsUp,
  Sparkles,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  Inbox,
  Archive,
  Filter,
  MoreVertical,
  Eye,
  EyeOff,
  Megaphone
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  entity?: string;
  entity_id?: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [greeting, setGreeting] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  // ==================== GREETING EFFECT ====================
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Selamat Pagi");
    else if (hour < 18) setGreeting("Selamat Siang");
    else setGreeting("Selamat Malam");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ==================== FETCH NOTIFICATIONS ====================
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ==================== MARK AS READ ====================
  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // ==================== MARK ALL AS READ ====================
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // ==================== DELETE NOTIFICATION ====================
  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // ==================== DELETE ALL READ ====================
  const deleteAllRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id)
        .eq('read', true);

      if (error) throw error;

      setNotifications(notifications.filter(n => !n.read));
    } catch (error) {
      console.error('Error deleting read notifications:', error);
    }
  };

  // ==================== HANDLE REFRESH ====================
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications().finally(() => setRefreshing(false));
  };

  // ==================== GET NOTIFICATION ICON & COLOR ====================
  const getNotificationStyle = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('presensi') || lowerTitle.includes('hadir')) {
      return { icon: <Calendar className="h-5 w-5" />, color: "emerald", bgLight: "bg-emerald-100", textDark: "text-emerald-700", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700" };
    }
    if (lowerTitle.includes('nilai') || lowerTitle.includes('tugas')) {
      return { icon: <Star className="h-5 w-5" />, color: "amber", bgLight: "bg-amber-100", textDark: "text-amber-700", badgeBg: "bg-amber-100", badgeText: "text-amber-700" };
    }
    if (lowerTitle.includes('pengumuman')) {
      return { icon: <Megaphone className="h-5 w-5" />, color: "blue", bgLight: "bg-blue-100", textDark: "text-blue-700", badgeBg: "bg-blue-100", badgeText: "text-blue-700" };
    }
    if (lowerTitle.includes('peringatan')) {
      return { icon: <AlertCircle className="h-5 w-5" />, color: "rose", bgLight: "bg-rose-100", textDark: "text-rose-700", badgeBg: "bg-rose-100", badgeText: "text-rose-700" };
    }
    return { icon: <Bell className="h-5 w-5" />, color: "purple", bgLight: "bg-purple-100", textDark: "text-purple-700", badgeBg: "bg-purple-100", badgeText: "text-purple-700" };
  };

  // ==================== FORMAT DATE ====================
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // ==================== FILTER NOTIFICATIONS ====================
  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500">Memuat Notifikasi...</p>
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
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm relative">
                <Bell className="h-8 w-8" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  {greeting === "Selamat Pagi" ? <Sun className="h-4 w-4" /> : 
                   greeting === "Selamat Malam" ? <Moon className="h-4 w-4" /> : 
                   <Cloud className="h-4 w-4" />}
                  <p className="text-sm text-blue-100">{greeting}</p>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">Notifikasi</h1>
                <p className="text-blue-100 text-sm">
                  {unreadCount > 0 
                    ? `Anda memiliki ${unreadCount} notifikasi belum dibaca`
                    : 'Semua notifikasi sudah dibaca'}
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
                  <p className="text-xs text-blue-600 font-medium">Total Notifikasi</p>
                  <p className="text-2xl font-bold text-blue-900">{notifications.length}</p>
                </div>
                <Inbox className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-emerald-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Belum Dibaca</p>
                  <p className="text-2xl font-bold text-emerald-900">{unreadCount}</p>
                </div>
                <Bell className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-600 font-medium">Sudah Dibaca</p>
                  <p className="text-2xl font-bold text-purple-900">{notifications.filter(n => n.read).length}</p>
                </div>
                <CheckCheck className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 font-medium">Hari Ini</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {notifications.filter(n => {
                      const today = new Date().toISOString().split("T")[0];
                      return n.created_at.split("T")[0] === today;
                    }).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAIN NOTIFICATIONS CARD */}
        <Card className="rounded-2xl border-0 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-xl">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Daftar Notifikasi</CardTitle>
                  <CardDescription className="text-slate-300 text-sm">
                    Semua pemberitahuan dan informasi penting untuk Anda
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Filter Buttons */}
                <div className="flex gap-1 bg-white/10 p-1 rounded-xl">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`rounded-lg text-white hover:bg-white/20 ${filter === "all" ? "bg-white/20" : ""}`}
                    onClick={() => setFilter("all")}
                  >
                    Semua
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`rounded-lg text-white hover:bg-white/20 ${filter === "unread" ? "bg-white/20" : ""}`}
                    onClick={() => setFilter("unread")}
                  >
                    Belum Dibaca
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`rounded-lg text-white hover:bg-white/20 ${filter === "read" ? "bg-white/20" : ""}`}
                    onClick={() => setFilter("read")}
                  >
                    Sudah Dibaca
                  </Button>
                </div>
                
                {/* Action Buttons */}
                {unreadCount > 0 && (
                  <Button 
                    onClick={markAllAsRead} 
                    variant="ghost" 
                    size="sm"
                    className="bg-white/10 hover:bg-white/20 text-white rounded-xl"
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Tandai Semua
                  </Button>
                )}
                {notifications.some(n => n.read) && (
                  <Button 
                    onClick={deleteAllRead} 
                    variant="ghost" 
                    size="sm"
                    className="bg-white/10 hover:bg-red-500/20 text-white hover:text-red-300 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Hapus yang Dibaca
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {filteredNotifications.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredNotifications.map((notification) => {
                  const style = getNotificationStyle(notification.title);
                  const isUnread = !notification.read;
                  
                  return (
                    <div 
                      key={notification.id} 
                      className={`group transition-all duration-300 hover:bg-slate-50 cursor-pointer ${
                        isUnread ? 'bg-gradient-to-r from-blue-50/50 to-transparent' : ''
                      }`}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Icon Section */}
                          <div className={`flex-shrink-0 p-2.5 rounded-xl ${
                            isUnread ? style.bgLight : 'bg-slate-100 text-slate-400'
                          } ${isUnread ? style.textDark : 'text-slate-400'}`}>
                            {style.icon}
                          </div>
                          
                          {/* Content Section */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <h3 className={`font-semibold ${isUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                                {notification.title}
                              </h3>
                              {isUnread && (
                                <Badge className="bg-blue-500 text-white rounded-full text-xs px-2 py-0">
                                  Baru
                                </Badge>
                              )}
                              <Badge className={`${style.badgeBg} ${style.badgeText} rounded-full text-xs border-0`}>
                                {notification.entity || "Umum"}
                              </Badge>
                            </div>
                            <p className={`text-sm ${isUnread ? 'text-slate-600' : 'text-slate-400'} mt-1`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(notification.created_at), { 
                                  addSuffix: true,
                                  locale: id 
                                })}
                              </div>
                              {notification.entity_id && (
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <Info className="h-3 w-3" />
                                  ID: {notification.entity_id}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {isUnread && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="bg-slate-100 rounded-full w-24 h-24 mx-auto flex items-center justify-center mb-4">
                  <BellOff className="h-12 w-12 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium text-lg">Tidak Ada Notifikasi</p>
                <p className="text-slate-400 text-sm mt-1">
                  {filter === "unread" 
                    ? "Semua notifikasi sudah dibaca" 
                    : filter === "read" 
                    ? "Belum ada notifikasi yang dibaca"
                    : "Saat Anda menerima notifikasi, akan muncul di sini"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TIPS SECTION */}
        {notifications.length > 0 && (
          <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="bg-indigo-100 p-3 rounded-xl">
                  <Sparkles className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Tips Mengelola Notifikasi</h3>
                  <p className="text-sm text-slate-600">
                    Klik notifikasi untuk menandai sebagai sudah dibaca. Gunakan tombol "Tandai Semua" untuk 
                    menandai semua notifikasi sebagai sudah dibaca, atau "Hapus yang Dibaca" untuk membersihkan 
                    notifikasi yang sudah tidak diperlukan.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* FOOTER */}
        <div className="text-center pt-4">
          <Separator className="mb-4" />
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Sistem Notifikasi - SmartAS
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Notifikasi akan tersimpan selama 30 hari
          </p>
        </div>
      </div>
    </div>
  );
}