import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, School, BookOpen, TrendingUp, CalendarCheck } from "lucide-react";

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: string | number; icon: React.ElementType; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-2xl font-bold">{value}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { role } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, teachers, classes, subjects, grades, attendances] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("teachers").select("*", { count: "exact", head: true }),
        supabase.from("classes").select("*", { count: "exact", head: true }),
        supabase.from("subjects").select("*", { count: "exact", head: true }),
        supabase.from("grades").select("score"),
        supabase.from("attendances").select("status"),
      ]);

      const avgGrade = grades.data?.length
        ? (grades.data.reduce((sum, g) => sum + Number(g.score), 0) / grades.data.length).toFixed(1)
        : "0";

      const presentCount = attendances.data?.filter((a) => a.status === "present").length ?? 0;
      const totalAttendance = attendances.data?.length ?? 0;
      const attendanceRate = totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(1) + "%" : "0%";

      return {
        students: students.count ?? 0,
        teachers: teachers.count ?? 0,
        classes: classes.count ?? 0,
        subjects: subjects.count ?? 0,
        avgGrade,
        attendanceRate,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {role === "admin" ? "Overview of your school" : role === "teacher" ? "Your teaching overview" : "Your academic overview"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Students" value={stats?.students ?? 0} icon={Users} loading={isLoading} />
        <StatCard title="Teachers" value={stats?.teachers ?? 0} icon={GraduationCap} loading={isLoading} />
        <StatCard title="Classes" value={stats?.classes ?? 0} icon={School} loading={isLoading} />
        <StatCard title="Subjects" value={stats?.subjects ?? 0} icon={BookOpen} loading={isLoading} />
        <StatCard title="Avg Grade" value={stats?.avgGrade ?? "0"} icon={TrendingUp} loading={isLoading} />
        <StatCard title="Attendance" value={stats?.attendanceRate ?? "0%"} icon={CalendarCheck} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Activity timeline will appear here as you use the system.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Charts and detailed analytics will appear here as data is added.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
