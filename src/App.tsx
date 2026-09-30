import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import './App.css'

const KPOP_CATEGORIES = [
  'Food',
  'Coffee',
  'Drinks',
  'Gaming',
  'Clothes',
  'Shopping',
  'Transport',
  'Bills',
  'Subscriptions',
  'Albums',
  'Merch',
  'Concerts / Events',
  'Photocards',
  'Lightsticks',
  'Weverse / Digital',
  'Custom',
]

interface SpendingRecord {
  id: number
  timestamp: string
  created_at?: string
  reason: string
  category: string | null
  prev_start_time: number | null
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

function formatStreakDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDays = Math.floor(totalHours / 24)
  const months = Math.floor(totalDays / 30)
  const weeks = Math.floor((totalDays % 30) / 7)
  const days = totalDays % 7
  const hours = totalHours % 24
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (months > 0) parts.push(`${months}mo`)
  if (weeks > 0) parts.push(`${weeks}w`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (parts.length === 0) parts.push('< 1m')
  // keep it short: only the 3 most significant units
  return parts.slice(0, 3).join(' ')
}

// `timestamp` is a display string like "September 29, 2026 at 07:41:20 PM",
// which new Date() cannot parse (the " at " gives NaN). Prefer created_at (ISO),
// and fall back to the display string with " at " removed.
function getRecordEndMs(record: SpendingRecord): number {
  if (record.created_at) {
    const ms = new Date(record.created_at).getTime()
    if (!Number.isNaN(ms)) return ms
  }
  return new Date(record.timestamp.replace(' at ', ' ')).getTime()
}

function getRecordStreakMs(record: SpendingRecord): number | null {
  if (record.prev_start_time == null) return null
  const ms = getRecordEndMs(record) - record.prev_start_time
  return Number.isFinite(ms) && ms > 0 ? ms : null
}

function getLongestStreak(records: SpendingRecord[], currentStartTime: number) {
  const currentMs = Date.now() - currentStartTime
  const pastStreaks = records
    .filter(r => r.prev_start_time != null)
    .map(r => {
      return getRecordEndMs(r) - r.prev_start_time!
    })
    .filter(ms => ms > 0)
  const allStreaks = [...pastStreaks, currentMs]
  return Math.max(...allStreaks)
}

function getCategoryBreakdown(records: SpendingRecord[]) {
  const counts: Record<string, number> = {}
  for (const r of records) {
    const cat = r.category ?? 'Uncategorized'
    counts[cat] = (counts[cat] ?? 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

const CATEGORY_STYLES: Record<string, string> = {
  'Food': 'from-orange-400 to-red-500',
  'Coffee': 'from-amber-600 to-yellow-700',
  'Drinks': 'from-sky-400 to-cyan-500',
  'Gaming': 'from-green-400 to-emerald-600',
  'Clothes': 'from-fuchsia-400 to-pink-500',
  'Shopping': 'from-yellow-300 to-orange-400',
  'Transport': 'from-slate-400 to-blue-500',
  'Bills': 'from-red-400 to-rose-600',
  'Subscriptions': 'from-violet-400 to-indigo-500',
  'Albums': 'from-rose-400 to-pink-500',
  'Merch': 'from-purple-400 to-violet-500',
  'Concerts / Events': 'from-amber-300 to-rose-400',
  'Photocards': 'from-blue-300 to-indigo-400',
  'Lightsticks': 'from-cyan-300 to-blue-400',
  'Weverse / Digital': 'from-emerald-400 to-teal-500',
  'Uncategorized': 'from-zinc-500 to-zinc-600',
}

function getCategoryStyle(cat: string) {
  return CATEGORY_STYLES[cat] ?? 'from-purple-400 to-pink-400'
}

function App() {
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [records, setRecords] = useState<SpendingRecord[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState(KPOP_CATEGORIES[0])
  const [customCategory, setCustomCategory] = useState('')
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

  const finalCategory = category === 'Custom' ? customCategory.trim() : category

  const handleReset = async () => {
    const trimmed = reason.trim()
    if (!trimmed) return
    if (category === 'Custom' && !customCategory.trim()) return
    const now = Date.now()
    const timestamp = new Date(now).toLocaleString('en-PH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
    await Promise.all([
      supabase.from('timer_state').update({ start_time: now }).eq('id', 1),
      supabase.from('spending_records').insert({
        timestamp,
        reason: trimmed,
        category: finalCategory,
        prev_start_time: startTime
      })
    ])
    const { data: newRecords } = await supabase
      .from('spending_records').select('*').order('created_at', { ascending: false })
    setStartTime(now)
    setElapsed(0)
    setRecords(newRecords ?? [])
    setReason('')
    setCategory(KPOP_CATEGORIES[0])
    setCustomCategory('')
  }

  const { months, weeks, days, hours, minutes, seconds } = formatElapsed(elapsed)
  const canReset = reason.trim().length > 0 && (category !== 'Custom' || customCategory.trim().length > 0)
  const longestStreakMs = loading ? 0 : getLongestStreak(records, startTime)
  const isCurrentStreakBest = elapsed >= longestStreakMs && !loading
  const breakdown = getCategoryBreakdown(records)
  const totalResets = records.length

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display tracking-widest uppercase text-sm animate-pulse">loading timeline…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-20 glass-card border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-lg text-twice-peach">✦</span>
          <span className="font-display font-bold tracking-tight text-lg gradient-text">MINE.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link to="/" className="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-white/10 text-white transition-colors">Timeline</Link>
          <Link to="/bets" className="px-3 py-1.5 rounded-full text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">Bet Pool</Link>
          <Link to="/quiz" className="px-3 py-1.5 rounded-full text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">Quiz</Link>
        </div>
      </nav>

      {/* ── PROFILE CARD ── */}
      <header className="px-4 sm:px-6 pt-8 pb-2 max-w-2xl mx-auto w-full">
        <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full gradient-fill flex items-center justify-center font-display text-2xl font-bold text-white ${isCurrentStreakBest ? 'holo-ring' : ''}`}>
            JM
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <h1 className="font-display text-xl font-bold">Joseph</h1>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-en-frost" aria-label="verified">
              <path d="M12 2l2.2 2.2 3.1-.6.6 3.1 2.2 2.2-.6 3.1.6 3.1-2.2 2.2-.6 3.1-3.1-.6L12 22l-2.2-2.2-3.1.6-.6-3.1-2.2-2.2.6-3.1-.6-3.1 2.2-2.2.6-3.1 3.1.6z"/>
              <path d="M9.5 12.5l1.8 1.8 3.7-3.7" stroke="#0C0B1D" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">@joseph.mines</p>
          <p className="mt-2 text-sm text-foreground/60 max-w-xs">certified compulsive commenter 💅 · types "mine" faster than his bank can decline it</p>

          {/* Streak badge */}
          <div className={`mt-4 px-4 py-2 rounded-full text-xs font-medium tracking-wide ${
            isCurrentStreakBest
              ? 'bg-gradient-to-r from-twice-peach/15 via-holo-lilac/15 to-en-frost/15 text-twice-peach border border-twice-peach/20'
              : 'text-muted-foreground border border-white/10'
          }`}>
            {isCurrentStreakBest
              ? `✨ new personal best — ${formatStreakDuration(elapsed)} without mining`
              : `🏆 personal best: ${formatStreakDuration(longestStreakMs)} without mining`}
          </div>
        </div>
      </header>

      {/* ── TIMER (hero / signature element) ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-14">
        <p className="text-muted-foreground tracking-widest uppercase text-xs mb-6 font-medium">time since joseph last typed "mine"</p>
        <div className={`lightstick-border ${isCurrentStreakBest ? 'lightstick-border--glow' : ''} rounded-2xl px-4 sm:px-8 py-6 glass-card flex gap-1.5 sm:gap-3 items-end`}>
          {[
            { value: months, label: 'Mo' },
            { value: weeks, label: 'Wk' },
            { value: days, label: 'Day' },
            { value: hours, label: 'Hr' },
            { value: minutes, label: 'Min' },
            { value: seconds, label: 'Sec' },
          ].map((unit, i, arr) => (
            <div key={unit.label} className="flex items-end gap-1.5 sm:gap-3">
              <div className="flex flex-col items-center">
                <div className={`font-display text-3xl sm:text-5xl md:text-6xl font-bold tabular-nums leading-none tracking-tight ${isCurrentStreakBest ? 'gradient-text' : 'text-foreground'}`}>
                  {unit.value}
                </div>
                <span className="text-muted-foreground text-[10px] sm:text-xs uppercase tracking-widest mt-2">{unit.label}</span>
              </div>
              {i < arr.length - 1 && (
                <span className="text-2xl sm:text-4xl md:text-5xl font-bold text-holo-lilac/30 pb-5 select-none">:</span>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* ── CATEGORY BREAKDOWN ── */}
      {totalResets > 0 && (
        <section className="border-t border-white/5 px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">mining breakdown</h2>
          <div className="flex gap-1 h-2.5 rounded-full overflow-hidden mb-4">
            {breakdown.map(([cat, count]) => (
              <div
                key={cat}
                className={`bg-gradient-to-r ${getCategoryStyle(cat)} transition-all`}
                style={{ width: `${(count / totalResets) * 100}%` }}
                title={`${cat}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {breakdown.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-card border border-white/5">
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${getCategoryStyle(cat)} inline-block`} />
                <span className="text-foreground/80 text-xs font-medium">#{cat.replace(/\s+/g, '')}</span>
                <span className="text-muted-foreground text-xs">×{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── COMPOSE / RESET ── */}
      <section className="border-t border-white/5 px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
        <div className="lightstick-border rounded-2xl glass-card p-4 sm:p-5">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full gradient-fill flex items-center justify-center font-display text-xs font-bold text-white flex-shrink-0">JM</div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-medium">what did you mine, joseph?</p>

              <div className="mb-3 flex flex-wrap gap-2">
                {KPOP_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                      category === cat
                        ? 'border-transparent gradient-fill text-white shadow-glow-peach'
                        : 'border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground'
                    }`}
                  >
                    #{cat.replace(/\s+/g, '')}
                  </button>
                ))}
              </div>
              {category === 'Custom' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Enter custom hashtag..."
                  className="mb-3 w-full bg-black/20 border border-white/10 text-foreground placeholder:text-muted-foreground/50 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-holo-lilac transition-colors"
                />
              )}

              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="mine 😭 what did you get this time..."
                className="bg-black/20 border-white/10 text-foreground placeholder:text-muted-foreground/50 resize-none focus:border-holo-lilac focus:ring-0 mb-4 rounded-lg"
                rows={3}
              />
              <Button
                onClick={handleReset}
                disabled={!canReset}
                className={`w-full font-display font-semibold uppercase tracking-widest text-sm py-6 rounded-full transition-all duration-200 ${
                  canReset ? 'gradient-fill hover:opacity-90 text-white cursor-pointer shadow-glow-peach' : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {canReset ? 'MINE 🙋‍♂️ (reset timer)' : 'say what you mined first'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEED / HISTORY ── */}
      {records.length > 0 && (
        <section className="border-t border-white/5 px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">mine feed</h2>
          <div className="flex flex-col gap-3">
            {records.map((record) => {
              const streakMs = getRecordStreakMs(record)
              const cat = record.category ?? 'Uncategorized'
              return (
                <div key={record.id} className="glass-card rounded-xl border border-white/5 hover:border-white/10 transition-colors overflow-hidden flex">
                  <div className={`w-1 flex-shrink-0 bg-gradient-to-b ${getCategoryStyle(cat)}`} />
                  <div className="p-4 flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-semibold text-sm text-foreground">Joseph</span>
                      <span className="text-muted-foreground text-xs">@joseph.mines</span>
                      <span className="text-muted-foreground/50 text-xs">· {record.timestamp}</span>
                    </div>
                    <p className="text-foreground/80 text-sm mt-1 break-words">{record.reason}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full bg-gradient-to-r ${getCategoryStyle(cat)} text-white`}>
                        #{cat.replace(/\s+/g, '')}
                      </span>
                      {streakMs != null && (
                        <span className="text-[11px] text-muted-foreground">streak broken after {formatStreakDuration(streakMs)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <footer className="py-5 text-center text-muted-foreground/60 text-xs tracking-widest border-t border-white/5 font-display">
        ✦ MADE WITH STAN TEARS ✦
      </footer>
    </div>
  )
}

export default App
