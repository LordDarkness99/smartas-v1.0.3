// File: src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { User } from "@/hooks/useAuth";

/**
 * Menggabungkan class CSS dengan tailwind-merge dan clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Menentukan apakah user perlu melakukan filter data berdasarkan id_jurusan.
 * Hanya admin_jurusan yang perlu filter, sementara admin dan BK melihat semua data.
 * @param user - Objek user dari useAuth()
 * @returns true jika user adalah admin_jurusan dan memiliki id_jurusan
 */
export function shouldFilterByJurusan(user: User | null): boolean {
  return user?.peran === 'admin_jurusan' && !!user.id_jurusan;
}

/**
 * Mendapatkan filter object untuk query Supabase berdasarkan jurusan.
 * Berguna untuk menerapkan filter pada query SELECT.
 * @param user - Objek user dari useAuth()
 * @returns Object filter { id_jurusan: user.id_jurusan } atau null jika tidak perlu filter
 * 
 * @example
 * let query = supabase.from('kelas').select('*');
 * const jurusanFilter = getJurusanFilter(user);
 * if (jurusanFilter) query = query.eq('id_jurusan', jurusanFilter.id_jurusan);
 */
export function getJurusanFilter(user: User | null): { id_jurusan: number } | null {
  if (shouldFilterByJurusan(user) && user?.id_jurusan) {
    return { id_jurusan: user.id_jurusan };
  }
  return null;
}

/**
 * Mengecek apakah user memiliki role yang diizinkan (salah satu dari roles).
 * @param user - Objek user dari useAuth()
 * @param allowedRoles - Array string role yang diizinkan, misal ['admin', 'bk']
 * @returns true jika user ada dan perannya termasuk dalam allowedRoles
 */
export function hasRole(user: User | null, allowedRoles: string[]): boolean {
  return !!user && allowedRoles.includes(user.peran);
}

/**
 * Mengecek apakah user adalah admin (super admin).
 */
export function isAdmin(user: User | null): boolean {
  return user?.peran === 'admin';
}

/**
 * Mengecek apakah user adalah BK (Bimbingan Konseling).
 */
export function isBK(user: User | null): boolean {
  return user?.peran === 'bk';
}

/**
 * Mengecek apakah user adalah admin jurusan.
 */
export function isAdminJurusan(user: User | null): boolean {
  return user?.peran === 'admin_jurusan';
}

/**
 * Mengecek apakah user adalah guru.
 */
export function isGuru(user: User | null): boolean {
  return user?.peran === 'guru';
}

/**
 * Mengecek apakah user adalah siswa.
 */
export function isSiswa(user: User | null): boolean {
  return user?.peran === 'siswa';
}

/**
 * Mendapatkan role user dalam bentuk string, atau null jika user tidak ada.
 */
export function getUserRole(user: User | null): string | null {
  return user?.peran || null;
}