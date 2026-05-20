// File: src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import * as bcrypt from 'bcryptjs';
import type { PostgrestError } from '@supabase/supabase-js';

// Definisikan tipe untuk data akun (sesuai struktur tabel akun + id_jurusan)
interface AkunData {
  id_akun: string;
  nama: string;
  username: string | null;
  peran: string | null;
  aktif: boolean | null;
  id_guru: number | null;
  id_siswa: number | null;
  id_jurusan: number | null; // untuk admin_jurusan
  kata_sandi: string | null;
}

export interface User {
  id_akun: string;
  nama: string;
  username: string;
  peran: string; // 'admin', 'guru', 'siswa', 'bk', 'admin_jurusan'
  aktif: boolean;
  id_guru?: number | null;
  id_siswa?: number | null;
  id_jurusan?: number | null; // untuk admin_jurusan
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  faceSignIn: (username: string) => Promise<{ error: string | null }>;
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

  const signIn = async (username: string, password: string) => {
    try {
      if (!username || !password) {
        return { error: 'username dan password harus diisi' };
      }

      const { data: akun, error: queryError } = await supabase
        .from('akun')
        .select('id_akun, nama, username, peran, aktif, id_guru, id_siswa, id_jurusan, kata_sandi')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle() as { data: AkunData | null; error: PostgrestError | null };

      if (queryError) {
        console.error('Query error:', queryError);
        return { error: 'Terjadi kesalahan database' };
      }

      if (!akun) {
        return { error: 'username tidak ditemukan' };
      }

      if (akun.aktif === false) {
        return { error: 'Akun Anda tidak aktif. Hubungi administrator.' };
      }

      if (!akun.kata_sandi) {
        return { error: 'Akun tidak memiliki password. Hubungi administrator.' };
      }

      const isPasswordValid = await bcrypt.compare(password, akun.kata_sandi);
      if (!isPasswordValid) {
        return { error: 'Password salah' };
      }

      const userData: User = {
        id_akun: akun.id_akun,
        nama: akun.nama,
        username: akun.username || username,
        peran: akun.peran || 'siswa',
        aktif: akun.aktif || false,
        id_guru: akun.id_guru,
        id_siswa: akun.id_siswa,
        id_jurusan: akun.id_jurusan,
      };
      
      localStorage.setItem('smartas_user', JSON.stringify(userData));
      setUser(userData);
      return { error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'Terjadi kesalahan saat login: ' + (err as Error).message };
    }
  };

  const faceSignIn = async (username: string) => {
    try {
      if (!username) {
        return { error: 'Username tidak ditemukan' };
      }

      const { data: akun, error: queryError } = await supabase
        .from('akun')
        .select('id_akun, nama, username, peran, aktif, id_guru, id_siswa, id_jurusan')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();

      if (queryError || !akun) {
        return { error: 'Username tidak ditemukan' };
      }

      if (akun.aktif === false) {
        return { error: 'Akun Anda tidak aktif. Hubungi administrator.' };
      }

      const userData: User = {
        id_akun: akun.id_akun,
        nama: akun.nama,
        username: akun.username || username,
        peran: akun.peran || 'siswa',
        aktif: akun.aktif || false,
        id_guru: akun.id_guru,
        id_siswa: akun.id_siswa,
        id_jurusan: akun.id_jurusan,
      };
      
      localStorage.setItem('smartas_user', JSON.stringify(userData));
      setUser(userData);
      return { error: null };
    } catch (err) {
      console.error('Face sign in error:', err);
      return { error: 'Terjadi kesalahan saat login dengan wajah' };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('smartas_user');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, faceSignIn }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}