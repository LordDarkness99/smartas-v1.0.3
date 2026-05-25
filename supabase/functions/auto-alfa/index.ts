// supabase/functions/auto-alfa/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('VITE_SUPABASE_URL')!,
      Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    )

    // Tentukan tanggal yang akan diproses
    let targetDate = new Date()
    const url = new URL(req.url)
    if (url.searchParams.has('date')) {
      targetDate = new Date(url.searchParams.get('date')!)
    }
    // HAPUS baris yang mengurangi satu hari
    // targetDate.setDate(targetDate.getDate() - 1)

    const dateStr = targetDate.toISOString().split('T')[0]
    const startOfDay = `${dateStr}T00:00:00`
    const endOfDay = `${dateStr}T23:59:59`

    // Panggil RPC untuk presensi harian (jika bukan Sabtu/Minggu akan di-skip di dalam fungsi SQL)
    const { error: errorHarian } = await supabase.rpc('insert_missing_presensi_harian', {
      p_start_date: startOfDay,
      p_end_date: endOfDay,
      p_status: 'Alfa'
    })
    if (errorHarian) throw errorHarian

    // Panggil RPC untuk presensi mapel
    const { error: errorMapel } = await supabase.rpc('insert_missing_presensi_mapel', {
      p_date: dateStr
    })
    if (errorMapel) throw errorMapel

    return new Response(
      JSON.stringify({ success: true, date: dateStr }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})