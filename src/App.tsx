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

// Admin pages (now used by pimpinan, kepala_jurusan, bk)
import AdminDashboard from "@/pages/admin/Dashboard";
import UserManagement from "@/pages/admin/UserManagement";
import ScheduleManagement from "@/pages/admin/ScheduleManagement";
import PKLManagement from "@/pages/admin/PKLManagement";
import AttendanceManagement from "@/pages/attendance/AttendanceManagement";
import AttendanceReport from "@/pages/report/AttendanceReport";

// Guru pages
import GuruDashboard from "@/pages/guru/Dashboard";
import ScheduleView from "@/pages/schedule/ScheduleView";
import AttendanceManagementGuru from "@/pages/guru/AttendanceManagement";

// Fungsi untuk merender dashboard sesuai role (peran baru)
function DashboardRenderer() {
  const { user } = useAuth();
  const role = user?.peran;

  if (role === "siswa") return <StudentDashboard />;
  if (role === "guru") return <GuruDashboard />;
  // Peran baru: pimpinan, kepala_jurusan, bk → gunakan AdminDashboard
  if (role === "pimpinan") return <AdminDashboard />;
  if (role === "kepala_jurusan") return <AdminDashboard />;
  if (role === "bk") return <AdminDashboard />;
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
    // Redirect berdasarkan role (peran baru)
    if (user.peran === "siswa") return <Navigate to="/student/dashboard" replace />;
    if (user.peran === "guru") return <Navigate to="/guru/dashboard" replace />;
    if (user.peran === "pimpinan") return <Navigate to="/admin/dashboard" replace />;
    if (user.peran === "kepala_jurusan") return <Navigate to="/admin-jurusan/dashboard" replace />;
    if (user.peran === "bk") return <Navigate to="/bk/dashboard" replace />;
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
            <Route path="attendance" element={<AttendanceManagementGuru />} />
            <Route path="schedule" element={<ScheduleView />} />
            <Route path="reports" element={<AttendanceReport />} />
            <Route path="face-registration" element={<FaceRegistration />} />
          </Route>

          {/* Pimpinan Routes (URL tetap /admin) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["pimpinan"]}>
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

          {/* BK Routes */}
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

          {/* Kepala Jurusan Routes (URL tetap /admin-jurusan) */}
          <Route
            path="/admin-jurusan"
            element={
              <ProtectedRoute allowedRoles={["kepala_jurusan"]}>
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