import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { BookOpen, TrendingUp, Award } from "lucide-react";

interface Grade {
  id: string;
  subject_id: string;
  score: number;
  grade_type: string;
  subject_name?: string;
  subject_code?: string;
}

interface SubjectGrade {
  subject_name: string;
  assignments: number[];
  midterms: number[];
  finals: number[];
  average: number;
}

export default function MyGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallAverage, setOverallAverage] = useState(0);

  useEffect(() => {
    const fetchGrades = async () => {
      if (!user) return;

      try {
        // Get student id from user
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, class_id')
          .eq('user_id', user.id)
          .single();

        if (studentError) throw studentError;

        if (studentData) {
          // Fetch grades with subject details
          const { data: gradesData, error: gradesError } = await supabase
            .from('grades')
            .select(`
              id,
              score,
              grade_type,
              subject_id,
              subjects:subject_id (
                name,
                code
              )
            `)
            .eq('student_id', studentData.id)
            .order('created_at', { ascending: false });

          if (gradesError) throw gradesError;
          
          const formattedGrades = gradesData?.map(grade => ({
            id: grade.id,
            score: grade.score,
            grade_type: grade.grade_type,
            subject_id: grade.subject_id,
            subject_name: grade.subjects?.name,
            subject_code: grade.subjects?.code
          })) || [];
          
          setGrades(formattedGrades);
          
          // Calculate overall average
          if (formattedGrades.length > 0) {
            const total = formattedGrades.reduce((sum, grade) => sum + grade.score, 0);
            setOverallAverage(total / formattedGrades.length);
          }
        }
      } catch (error) {
        console.error('Error fetching grades:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGrades();
  }, [user]);

  const getGradeColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeLetter = (score: number) => {
    if (score >= 85) return 'A';
    if (score >= 75) return 'B';
    if (score >= 65) return 'C';
    if (score >= 50) return 'D';
    return 'E';
  };

  // Group grades by subject
  const subjectGrades: { [key: string]: SubjectGrade } = {};
  grades.forEach(grade => {
    if (!subjectGrades[grade.subject_name || grade.subject_id]) {
      subjectGrades[grade.subject_name || grade.subject_id] = {
        subject_name: grade.subject_name || 'Unknown Subject',
        assignments: [],
        midterms: [],
        finals: [],
        average: 0
      };
    }
    
    if (grade.grade_type === 'assignment') {
      subjectGrades[grade.subject_name || grade.subject_id].assignments.push(grade.score);
    } else if (grade.grade_type === 'midterm') {
      subjectGrades[grade.subject_name || grade.subject_id].midterms.push(grade.score);
    } else if (grade.grade_type === 'final') {
      subjectGrades[grade.subject_name || grade.subject_id].finals.push(grade.score);
    }
  });

  // Calculate averages for each subject
  Object.values(subjectGrades).forEach(subject => {
    const allScores = [...subject.assignments, ...subject.midterms, ...subject.finals];
    subject.average = allScores.length > 0 
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
      : 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading grades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Grades</h1>
          <p className="text-gray-600 mt-1">Track your academic performance</p>
        </div>
        {overallAverage > 0 && (
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm opacity-90">Overall Average</p>
                <p className="text-3xl font-bold">{overallAverage.toFixed(1)}</p>
                <p className="text-xs opacity-80">Grade: {getGradeLetter(overallAverage)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Subjects</p>
              <p className="text-2xl font-bold">{Object.keys(subjectGrades).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Total Grades</p>
              <p className="text-2xl font-bold">{grades.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Award className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-600">Best Score</p>
              <p className="text-2xl font-bold">
                {grades.length > 0 ? Math.max(...grades.map(g => g.score)) : 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Averages */}
      {Object.values(subjectGrades).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subject Averages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.values(subjectGrades).map((subject) => (
              <div key={subject.subject_name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{subject.subject_name}</span>
                  <span className={getGradeColor(subject.average)}>
                    {subject.average.toFixed(1)} ({getGradeLetter(subject.average)})
                  </span>
                </div>
                <Progress value={subject.average} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Detailed Grades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Grades</CardTitle>
        </CardHeader>
        <CardContent>
          {grades.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Grade Type</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grades.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell className="font-medium">
                        {grade.subject_name || grade.subject_id}
                        {grade.subject_code && (
                          <span className="text-xs text-gray-500 ml-2">({grade.subject_code})</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{grade.grade_type}</TableCell>
                      <TableCell className={getGradeColor(grade.score)}>
                        {grade.score}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          grade.score >= 85 ? 'bg-green-100 text-green-700' :
                          grade.score >= 70 ? 'bg-blue-100 text-blue-700' :
                          grade.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {getGradeLetter(grade.score)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No grades found yet.</p>
              <p className="text-sm mt-1">Grades will appear here once your teacher adds them.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}