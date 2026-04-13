import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

// Student pages
import StudentDashboard from "@/pages/student/Dashboard";
import StudentMyGrades from "@/pages/student/MyGrades";
import StudentMyAttendance from "@/pages/student/MyAttendance";
import StudentNotifications from "@/pages/student/Notifications";

// Admin pages
import UserManagement from "@/pages/admin/UserManagement";
import ScheduleManagement from "@/pages/admin/ScheduleManagement";
import PKLManagement from "@/pages/admin/PKLManagement";
import AttendanceManagement from "@/pages/attendance/AttendanceManagement";
import AttendanceReport from "@/pages/report/AttendanceReport";

// Temporary pages untuk guru dan admin
function GuruDashboard() {
  const { user } = useAuth();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard Guru</h1>
      <p>Selamat datang, {user?.nama}</p>
      <p>Halaman ini sedang dalam pengembangan</p>
    </div>
  );
}

function AdminDashboard() {
  const { user } = useAuth();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>
      <p>Selamat datang, {user?.nama}</p>
      <p>Halaman ini sedang dalam pengembangan</p>
    </div>
  );
}

// Komponen untuk redirect berdasarkan role
function DashboardRouter() {
  const { user } = useAuth();
  
  if (user?.peran === "siswa") return <Navigate to="/student/dashboard" replace />;
  if (user?.peran === "guru") return <Navigate to="/guru/dashboard" replace />;
  if (user?.peran === "admin") return <Navigate to="/admin/dashboard" replace />;
  
  return <Navigate to="/login" replace />;
}

// Root router - cek auth status
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
            <Route path="my-grades" element={<StudentMyGrades />} />
            <Route path="my-attendance" element={<StudentMyAttendance />} />
            <Route path="notifications" element={<StudentNotifications />} />
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
          </Route>
          
          {/* Dashboard redirect based on role */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardRouter />} />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;