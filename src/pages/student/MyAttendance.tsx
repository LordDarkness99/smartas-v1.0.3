import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

interface Attendance {
  id: string;
  date: string;
  status: 'present' | 'sick' | 'permit' | 'absent';
  notes: string;
  class_name?: string;
}

export default function MyAttendance() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    present: 0,
    sick: 0,
    permit: 0,
    absent: 0,
    total: 0,
    percentage: 0
  });

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!user) return;

      try {
        // Get student data
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, class_id')
          .eq('user_id', user.id)
          .single();

        if (studentError) throw studentError;

        if (studentData) {
          // Fetch attendance with class info
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendances')
            .select(`
              *,
              classes:class_id (
                name
              )
            `)
            .eq('student_id', studentData.id)
            .order('date', { ascending: false });

          if (attendanceError) throw attendanceError;
          
          const formattedAttendances = attendanceData?.map(att => ({
            id: att.id,
            date: att.date,
            status: att.status,
            notes: att.notes || '',
            class_name: att.classes?.name
          })) || [];
          
          setAttendances(formattedAttendances);
          
          // Calculate statistics
          const stats = {
            present: formattedAttendances.filter(a => a.status === 'present').length,
            sick: formattedAttendances.filter(a => a.status === 'sick').length,
            permit: formattedAttendances.filter(a => a.status === 'permit').length,
            absent: formattedAttendances.filter(a => a.status === 'absent').length,
            total: formattedAttendances.length,
            percentage: 0
          };
          stats.percentage = stats.total > 0 
            ? (stats.present / stats.total) * 100 
            : 0;
          setStatistics(stats);
        }
      } catch (error) {
        console.error('Error fetching attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'absent':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'sick':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'permit':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'text-green-600 bg-green-50';
      case 'absent': return 'text-red-600 bg-red-50';
      case 'sick': return 'text-yellow-600 bg-yellow-50';
      case 'permit': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'sick': return 'Sick';
      case 'permit': return 'Permit';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading attendance records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Attendance</h1>
        <p className="text-gray-600 mt-1">Track your attendance history</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-green-50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-700">{statistics.present}</p>
            <p className="text-xs text-green-600">Present</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50">
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-700">{statistics.sick}</p>
            <p className="text-xs text-yellow-600">Sick</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-700">{statistics.permit}</p>
            <p className="text-xs text-blue-600">Permit</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-700">{statistics.absent}</p>
            <p className="text-xs text-red-600">Absent</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50">
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-purple-700">{statistics.percentage.toFixed(1)}%</p>
            <p className="text-xs text-purple-600">Attendance Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          {attendances.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((attendance) => (
                    <TableRow key={attendance.id}>
                      <TableCell>
                        {new Date(attendance.date).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>{attendance.class_name || 'General'}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 px-2 py-1 rounded-full w-fit ${getStatusColor(attendance.status)}`}>
                          {getStatusIcon(attendance.status)}
                          <span className="text-sm font-medium">
                            {getStatusLabel(attendance.status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {attendance.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No attendance records found.</p>
              <p className="text-sm mt-1">Attendance will appear here once your teacher records it.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Present - Attended class</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="text-sm">Sick - Medical leave</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="text-sm">Permit - Official permission</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">Absent - No attendance</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}