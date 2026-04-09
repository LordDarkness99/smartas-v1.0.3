export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      akun: {
        Row: {
          aktif: boolean | null
          dibuat_pada: string | null
          email: string | null
          id_akun: string
          id_guru: number | null
          id_siswa: number | null
          kata_sandi: string | null
          nama: string
          peran: string | null
        }
        Insert: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          email?: string | null
          id_akun?: string
          id_guru?: number | null
          id_siswa?: number | null
          kata_sandi?: string | null
          nama: string
          peran?: string | null
        }
        Update: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          email?: string | null
          id_akun?: string
          id_guru?: number | null
          id_siswa?: number | null
          kata_sandi?: string | null
          nama?: string
          peran?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "akun_id_guru_fkey"
            columns: ["id_guru"]
            isOneToOne: true
            referencedRelation: "guru"
            referencedColumns: ["id_guru"]
          },
          {
            foreignKeyName: "akun_id_siswa_fkey"
            columns: ["id_siswa"]
            isOneToOne: true
            referencedRelation: "siswa"
            referencedColumns: ["id_siswa"]
          },
        ]
      }
      guru: {
        Row: {
          aktif: boolean | null
          dibuat_pada: string | null
          gender: string | null
          id_guru: number
          nama: string
          nip: number | null
        }
        Insert: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          gender?: string | null
          id_guru: number
          nama: string
          nip?: number | null
        }
        Update: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          gender?: string | null
          id_guru?: number
          nama?: string
          nip?: number | null
        }
        Relationships: []
      }
      jadwal: {
        Row: {
          aktif: boolean | null
          dibuat_pada: string | null
          hari: string | null
          id_guru: number | null
          id_jadwal: number
          id_kelas: number | null
          id_mapel: number | null
          jam: string | null
        }
        Insert: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          hari?: string | null
          id_guru?: number | null
          id_jadwal?: number
          id_kelas?: number | null
          id_mapel?: number | null
          jam?: string | null
        }
        Update: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          hari?: string | null
          id_guru?: number | null
          id_jadwal?: number
          id_kelas?: number | null
          id_mapel?: number | null
          jam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jadwal_id_guru_fkey"
            columns: ["id_guru"]
            isOneToOne: false
            referencedRelation: "guru"
            referencedColumns: ["id_guru"]
          },
          {
            foreignKeyName: "jadwal_id_kelas_fkey"
            columns: ["id_kelas"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id_kelas"]
          },
          {
            foreignKeyName: "jadwal_id_mapel_fkey"
            columns: ["id_mapel"]
            isOneToOne: false
            referencedRelation: "mata_pelajaran"
            referencedColumns: ["id_mapel"]
          },
        ]
      }
      kelas: {
        Row: {
          aktif: boolean | null
          dibuat_pada: string | null
          id_kelas: number
          nama: string
        }
        Insert: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          id_kelas?: number
          nama: string
        }
        Update: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          id_kelas?: number
          nama?: string
        }
        Relationships: []
      }
      mata_pelajaran: {
        Row: {
          aktif: boolean | null
          dibuat_pada: string | null
          id_mapel: number
          nama: string
        }
        Insert: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          id_mapel?: number
          nama: string
        }
        Update: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          id_mapel?: number
          nama?: string
        }
        Relationships: []
      }
      siswa: {
        Row: {
          aktif: boolean | null
          dibuat_pada: string | null
          gender: string | null
          id_kelas: number | null
          id_siswa: number
          nama: string
          nis: number | null
        }
        Insert: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          gender?: string | null
          id_kelas?: number | null
          id_siswa: number
          nama: string
          nis?: number | null
        }
        Update: {
          aktif?: boolean | null
          dibuat_pada?: string | null
          gender?: string | null
          id_kelas?: number | null
          id_siswa?: number
          nama?: string
          nis?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "siswa_id_kelas_fkey"
            columns: ["id_kelas"]
            isOneToOne: false
            referencedRelation: "kelas"
            referencedColumns: ["id_kelas"]
          },
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
