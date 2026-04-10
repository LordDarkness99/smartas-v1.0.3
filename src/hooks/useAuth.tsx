// File: src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import * as bcrypt from 'bcryptjs';

// Definisikan tipe untuk data akun
interface AkunData {
  id_akun: string;
  nama: string;
  email: string | null;
  peran: string | null;
  aktif: boolean | null;
  id_guru: number | null;
  id_siswa: number | null;
  kata_sandi: string | null;
}

interface User {
  id_akun: string;
  nama: string;
  email: string;
  peran: string;
  aktif: boolean;
  id_guru?: number | null;
  id_siswa?: number | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('smartas_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem('smartas_user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      if (!email || !password) {
        return { error: 'Email dan password harus diisi' };
      }

      console.log('Mencoba login dengan:', email);

      // Cari akun berdasarkan email
      const { data: akun, error: queryError } = await supabase
        .from('akun')
        .select('id_akun, nama, email, peran, aktif, id_guru, id_siswa, kata_sandi')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle() as { data: AkunData | null; error: any };

      console.log('Data dari database:', akun);
      console.log('Query error:', queryError);

      if (queryError) {
        console.error('Query error:', queryError);
        return { error: 'Terjadi kesalahan database' };
      }

      if (!akun) {
        return { error: 'Email tidak ditemukan' };
      }

      // Cek status aktif
      if (akun.aktif === false) {
        return { error: 'Akun Anda tidak aktif. Hubungi administrator.' };
      }

      // Verifikasi password dengan bcrypt
      if (!akun.kata_sandi) {
        return { error: 'Akun tidak memiliki password. Hubungi administrator.' };
      }

      const isPasswordValid = await bcrypt.compare(password, akun.kata_sandi);
      
      if (!isPasswordValid) {
        return { error: 'Password salah' };
      }

      // Simpan user ke localStorage
      const userData: User = {
        id_akun: akun.id_akun,
        nama: akun.nama,
        email: akun.email || email,
        peran: akun.peran || 'siswa',
        aktif: akun.aktif || false,
        id_guru: akun.id_guru,
        id_siswa: akun.id_siswa,
      };
      
      console.log('Login berhasil, user data:', userData);
      
      localStorage.setItem('smartas_user', JSON.stringify(userData));
      setUser(userData);
      
      return { error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'Terjadi kesalahan saat login: ' + (err as Error).message };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('smartas_user');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}