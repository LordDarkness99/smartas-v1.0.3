// File: src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Toaster } from "@/components/ui/toaster";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import FaceRegistration from "./pages/FaceRegistration";

// Student pages
import StudentDashboard from "@/pages/student/Dashboard";
import StudentAttendance from "@/pages/student/StudentAttendance";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import UserManagement from "@/pages/admin/UserManagement";
import ScheduleManagement from "@/pages/admin/ScheduleManagement";
import PKLManagement from "@/pages/admin/PKLManagement";
import AttendanceManagement from "@/pages/attendance/AttendanceManagement";
import AttendanceReport from "@/pages/report/AttendanceReport";

// Guru pages
import GuruDashboard from "@/pages/guru/Dashboard";
import ScheduleView from "@/pages/schedule/ScheduleView";

// BK & Admin Jurusan (gunakan komponen yang sama dengan filter role)
// Dashboard sederhana untuk BK dan Admin Jurusan bisa menggunakan AdminDashboard yang sudah ada,
// atau buat komponen terpisah. Untuk kemudahan, kita gunakan AdminDashboard dengan conditional render.
// Untuk BK, hanya tampilkan statistik dan laporan; untuk Admin Jurusan, tampilkan semua fitur tetapi data terfilter.

// Fungsi untuk merender dashboard sesuai role
function DashboardRenderer() {
  const { user } = useAuth();
  const role = user?.peran;

  if (role === "siswa") return <StudentDashboard />;
  if (role === "guru") return <GuruDashboard />;
  if (role === "admin") return <AdminDashboard />;
  if (role === "bk") return <AdminDashboard />; // BK bisa menggunakan AdminDashboard dengan modifikasi internal (filter menu)
  if (role === "admin_jurusan") return <AdminDashboard />;
  return <Navigate to="/login" replace />;
}

function RootRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (user) {
    // Redirect berdasarkan role ke dashboard yang sesuai
    if (user.peran === "siswa") return <Navigate to="/student/dashboard" replace />;
    if (user.peran === "guru") return <Navigate to="/guru/dashboard" replace />;
    if (user.peran === "admin") return <Navigate to="/admin/dashboard" replace />;
    if (user.peran === "bk") return <Navigate to="/bk/dashboard" replace />;
    if (user.peran === "admin_jurusan") return <Navigate to="/admin-jurusan/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRouter />} />
          <Route path="/login" element={<Login />} />

          {/* Redirect from old /face-registration to the one with sidebar */}
          <Route path="/face-registration" element={<Navigate to="/dashboard/face-registration" replace />} />

          {/* Student Routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={["siswa"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentDashboard />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="schedule" element={<ScheduleView />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="face-registration" element={<FaceRegistration />} />
          </Route>

          {/* Guru Routes */}
          <Route
            path="/guru"
            element={
              <ProtectedRoute allowedRoles={["guru"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<GuruDashboard />} />
            <Route path="dashboard" element={<GuruDashboard />} />
            <Route path="attendance" element={<AttendanceManagement />} />
            <Route path="schedule" element={<ScheduleView />} />
            <Route path="reports" element={<AttendanceReport />} />
            <Route path="face-registration" element={<FaceRegistration />} />
          </Route>

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="manage-users" element={<UserManagement />} />
            <Route path="schedule" element={<ScheduleManagement />} />
            <Route path="pkl" element={<PKLManagement />} />
            <Route path="attendance" element={<AttendanceManagement />} />
            <Route path="reports" element={<AttendanceReport />} />
            <Route path="face-registration" element={<FaceRegistration />} />
          </Route>

          {/* BK Routes (hanya dashboard dan laporan) */}
          <Route
            path="/bk"
            element={
              <ProtectedRoute allowedRoles={["bk"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="reports" element={<AttendanceReport />} />
            <Route path="face-registration" element={<FaceRegistration />} />
          </Route>

          {/* Admin Jurusan Routes (akses seperti admin namun data terfilter) */}
          <Route
            path="/admin-jurusan"
            element={
              <ProtectedRoute allowedRoles={["admin_jurusan"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="manage-users" element={<UserManagement />} />
            <Route path="schedule" element={<ScheduleManagement />} />
            <Route path="pkl" element={<PKLManagement />} />
            <Route path="attendance" element={<AttendanceManagement />} />
            <Route path="reports" element={<AttendanceReport />} />
            <Route path="face-registration" element={<FaceRegistration />} />
          </Route>

          {/* Dashboard redirect - langsung render dashboard sesuai role */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardRenderer />} />
            <Route path="face-registration" element={<FaceRegistration />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;