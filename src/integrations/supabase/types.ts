export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      akun: {
        Row: {
          id_akun: string
          nama: string
          email: string | null
          peran: string | null
          aktif: boolean | null
          dibuat_pada: string | null
          id_guru: number | null
          id_siswa: number | null
          kata_sandi: string | null
        }
        Insert: {
          id_akun?: string
          nama: string
          email?: string | null
          peran?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
          id_guru?: number | null
          id_siswa?: number | null
          kata_sandi?: string | null
        }
        Update: {
          id_akun?: string
          nama?: string
          email?: string | null
          peran?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
          id_guru?: number | null
          id_siswa?: number | null
          kata_sandi?: string | null
        }
      }
      guru: {
        Row: {
          id_guru: number
          nama: string
          nip: number | null
          gender: string | null
          aktif: boolean | null
          dibuat_pada: string | null
        }
        Insert: {
          id_guru: number
          nama: string
          nip?: number | null
          gender?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
        Update: {
          id_guru?: number
          nama?: string
          nip?: number | null
          gender?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
      }
      siswa: {
        Row: {
          id_siswa: number
          nama: string
          nis: number | null
          gender: string | null
          aktif: boolean | null
          dibuat_pada: string | null
        }
        Insert: {
          id_siswa: number
          nama: string
          nis?: number | null
          gender?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
        Update: {
          id_siswa?: number
          nama?: string
          nis?: number | null
          gender?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
      }
      jadwal: {
        Row: {
          id_jadwal: number
          id_kelas: number | null
          id_mapel: number | null
          id_guru: number | null
          hari: string | null
          jam: string | null
          aktif: boolean | null
          dibuat_pada: string | null
        }
        Insert: {
          id_jadwal?: number
          id_kelas?: number | null
          id_mapel?: number | null
          id_guru?: number | null
          hari?: string | null
          jam?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
        Update: {
          id_jadwal?: number
          id_kelas?: number | null
          id_mapel?: number | null
          id_guru?: number | null
          hari?: string | null
          jam?: string | null
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
      }
      kelas: {
        Row: {
          id_kelas: number
          nama: string
          aktif: boolean | null
          dibuat_pada: string | null
        }
        Insert: {
          id_kelas?: number
          nama: string
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
        Update: {
          id_kelas?: number
          nama?: string
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
      }
      mata_pelajaran: {
        Row: {
          id_mapel: number
          nama: string
          aktif: boolean | null
          dibuat_pada: string | null
        }
        Insert: {
          id_mapel?: number
          nama: string
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
        Update: {
          id_mapel?: number
          nama?: string
          aktif?: boolean | null
          dibuat_pada?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}