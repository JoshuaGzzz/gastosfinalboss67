import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import './App.css'

interface SpendingRecord {
  id: number
  timestamp: string
  reason: string
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const totalHours = Math.floor(totalMinutes / 60)
  const hours = totalHours % 24
  const totalDays = Math.floor(totalHours / 24)
  const days = totalDays % 7
  const weeks = Math.floor(totalDays / 7) % 4
  const months = Math.floor(totalDays / 30)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { months: pad(months), weeks: pad(weeks), days: pad(days), hours: pad(hours), minutes: pad(minutes), seconds: pad(seconds) }
}

function App() {
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [records, setRecords] = useState<SpendingRecord[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function loadData() {
      const [{ data: timerData }, { data: recordsData }] = await Promise.all([
        supabase.from('timer_state').select('start_time').eq('id', 1).single(),
        supabase.from('spending_records').select('*').order('created_at', { ascending: false })
      ])
      if (timerData) setStartTime(timerData.start_time)
      if (recordsData) setRecords(recordsData)
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    if (loading) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startTime)
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [startTime, loading])

  const handleReset = async () => {
    const trimmed = reason.trim()
    if (!trimmed) return

    const now = Date.now()
    const timestamp = new Date(now).toLocaleString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })

    await Promise.all([
      supabase.from('timer_state').update({ start_time: now }).eq('id', 1),
      supabase.from('spending_records').insert({ timestamp, reason: trimmed })
    ])

    const { data: newRecords } = await supabase
      .from('spending_records')
      .select('*')
      .order('created_at', { ascending: false })

    setStartTime(now)
    setElapsed(0)
    setRecords(newRecords ?? [])
    setReason('')
  }

  const { months, weeks, days, hours, minutes, seconds } = formatElapsed(elapsed)
  const canReset = reason.trim().length > 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-zinc-500 font-mono tracking-widest uppercase text-sm animate-pulse">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono flex flex-col">

      {/* NAV */}
      <nav className="border-b border-zinc-800 px-6 py-3 flex justify-end gap-4">
        <Link to="/" className="text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Tracker</Link>
        <Link to="/bets" className="text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Betting Pool</Link>
      </nav>

      {/* HEADER */}
      <header className="border-b border-zinc-800 py-8 px-6 text-center">
        <h1 className="text-4xl font-black tracking-tight uppercase text-white leading-none">
          Joseph Gastos Tracker
        </h1>
        <p className="mt-3 text-zinc-400 text-base tracking-widest uppercase text-sm">
          Joseph has not spent money since:
        </p>
      </header>

      {/* TIMER */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex gap-2 sm:gap-4 items-end">
          {[
            { value: months, label: 'Months' },
            { value: weeks, label: 'Weeks' },
            { value: days, label: 'Days' },
            { value: hours, label: 'Hours' },
            { value: minutes, label: 'Min' },
            { value: seconds, label: 'Sec' },
          ].map((unit, i, arr) => (
            <div key={unit.label} className="flex items-end gap-2 sm:gap-4">
              <div className="flex flex-col items-center">
                <div className="text-5xl sm:text-7xl md:text-8xl font-black tabular-nums text-white leading-none tracking-tight">
                  {unit.value}
                </div>
                <span className="text-zinc-500 text-xs uppercase tracking-widest mt-2">{unit.label}</span>
              </div>
              {i < arr.length - 1 && (
                <span className="text-4xl sm:text-6xl md:text-7xl font-black text-zinc-600 pb-6 select-none">:</span>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* RESET SECTION */}
      <section className="border-t border-zinc-800 px-6 py-8 max-w-2xl mx-auto w-full">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
          State your reason before resetting
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why did Joseph spend money this time..."
          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 resize-none focus:border-red-500 focus:ring-0 mb-4 font-mono"
          rows={3}
        />
        <Button
          onClick={handleReset}
          disabled={!canReset}
          className={`w-full font-black uppercase tracking-widest text-base py-6 transition-all duration-200 ${
            canReset
              ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {canReset ? '⚠ Reset Timer' : 'Enter a reason first'}
        </Button>
      </section>

      {/* HISTORY TABLE */}
      {records.length > 0 && (
        <section className="border-t border-zinc-800 px-6 py-8 max-w-4xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Spending History</h2>
          <div className="overflow-x-auto rounded border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500 font-bold uppercase text-xs tracking-widest w-[220px]">Date & Time</TableHead>
                  <TableHead className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} className="border-zinc-800 hover:bg-zinc-900/50">
                    <TableCell className="text-zinc-400 text-xs align-top py-3 whitespace-nowrap">{record.timestamp}</TableCell>
                    <TableCell className="text-zinc-200 text-sm py-3">{record.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <footer className="py-4 text-center text-zinc-700 text-xs tracking-widest border-t border-zinc-900">
        ACCOUNTABILITY IS FOREVER
      </footer>
    </div>
  )
}

export default App
