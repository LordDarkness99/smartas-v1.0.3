
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- Create attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('present', 'sick', 'permit', 'absent');

-- Create grade type enum
CREATE TYPE public.grade_type AS ENUM ('assignment', 'midterm', 'final');

-- CORE TABLES FIRST

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Subjects
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Classes
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2025/2026',
  homeroom_teacher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teachers
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  employee_id TEXT UNIQUE,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classes
  ADD CONSTRAINT fk_homeroom_teacher
  FOREIGN KEY (homeroom_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  nis TEXT UNIQUE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  place_of_birth TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  address TEXT,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teacher-Class assignments
CREATE TABLE public.teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(teacher_id, class_id, subject_id)
);

-- Grades
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  grade_type grade_type NOT NULL DEFAULT 'assignment',
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  graded_by UUID REFERENCES auth.users(id) NOT NULL,
  notes TEXT,
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendances
CREATE TABLE public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  recorded_by UUID REFERENCES auth.users(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id, date)
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  entity TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HELPER FUNCTIONS (after tables exist)

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'teacher')
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'student')
$$;

-- TRIGGERS

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ENABLE RLS

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Allow profile creation" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

-- USER ROLES
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- SUBJECTS
CREATE POLICY "Authenticated can view subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- CLASSES
CREATE POLICY "Authenticated can view classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TEACHERS
CREATE POLICY "Authenticated can view teachers" ON public.teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teachers" ON public.teachers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Teachers can update own record" ON public.teachers FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- STUDENTS
CREATE POLICY "Authenticated can view students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage students" ON public.students FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Students can update own record" ON public.students FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- TEACHER_CLASSES
CREATE POLICY "Authenticated can view teacher_classes" ON public.teacher_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teacher_classes" ON public.teacher_classes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- GRADES
CREATE POLICY "Admins can manage grades" ON public.grades FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Students can view own grades" ON public.grades FOR SELECT TO authenticated USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);
CREATE POLICY "Teachers can view grades for their classes" ON public.grades FOR SELECT TO authenticated USING (
  class_id IN (SELECT class_id FROM public.teacher_classes WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);
CREATE POLICY "Teachers can insert grades" ON public.grades FOR INSERT TO authenticated WITH CHECK (
  class_id IN (SELECT class_id FROM public.teacher_classes WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);
CREATE POLICY "Teachers can update grades" ON public.grades FOR UPDATE TO authenticated USING (
  class_id IN (SELECT class_id FROM public.teacher_classes WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);

-- ATTENDANCES
CREATE POLICY "Admins can manage attendances" ON public.attendances FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Students can view own attendance" ON public.attendances FOR SELECT TO authenticated USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);
CREATE POLICY "Teachers can view attendance" ON public.attendances FOR SELECT TO authenticated USING (
  class_id IN (SELECT class_id FROM public.teacher_classes WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);
CREATE POLICY "Teachers can insert attendance" ON public.attendances FOR INSERT TO authenticated WITH CHECK (
  class_id IN (SELECT class_id FROM public.teacher_classes WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);
CREATE POLICY "Teachers can update attendance" ON public.attendances FOR UPDATE TO authenticated USING (
  class_id IN (SELECT class_id FROM public.teacher_classes WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()))
);

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- AUDIT LOGS
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- STORAGE

INSERT INTO storage.buckets (id, name, public) VALUES ('student-documents', 'student-documents', false);

CREATE POLICY "Admins can manage all files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'student-documents' AND public.is_admin())
  WITH CHECK (bucket_id = 'student-documents' AND public.is_admin());

CREATE POLICY "Users can upload own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'student-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

-- INDEXES

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_students_user_id ON public.students(user_id);
CREATE INDEX idx_students_class_id ON public.students(class_id);
CREATE INDEX idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX idx_grades_student_id ON public.grades(student_id);
CREATE INDEX idx_grades_class_id ON public.grades(class_id);
CREATE INDEX idx_attendances_student_id ON public.attendances(student_id);
CREATE INDEX idx_attendances_class_id ON public.attendances(class_id);
CREATE INDEX idx_attendances_date ON public.attendances(date);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_teacher_classes_teacher_id ON public.teacher_classes(teacher_id);
CREATE INDEX idx_teacher_classes_class_id ON public.teacher_classes(class_id);
