import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Jika allowedRoles ditentukan dan role user tidak ada di dalamnya
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.peran)) {
    // Redirect ke dashboard sesuai role
    if (user.peran === "siswa") return <Navigate to="/student/dashboard" replace />;
    if (user.peran === "guru") return <Navigate to="/guru/dashboard" replace />;
    if (user.peran === "admin") return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}