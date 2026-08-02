import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Bet {
  id: number
  name: string
  discord_tag: string | null
  bet_date: string
  amount: number
  created_at: string
}

function daysUntil(dateStr: string) {
  const target = new Date(dateStr)
  const now = new Date()
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

export default function Bets() {
  const [bets, setBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState('')
  const [discord, setDiscord] = useState('')
  const [betDate, setBetDate] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    async function loadBets() {
      const { data } = await supabase
        .from('bets')
        .select('*')
        .order('bet_date', { ascending: true })
      if (data) setBets(data)
      setLoading(false)
    }
    loadBets()
  }, [])

  const canSubmit = name.trim() && betDate && parseFloat(amount) > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)

    await supabase.from('bets').insert({
      name: name.trim(),
      discord_tag: discord.trim() || null,
      bet_date: betDate,
      amount: parseFloat(amount)
    })

    const { data } = await supabase
      .from('bets')
      .select('*')
      .order('bet_date', { ascending: true })

    if (data) setBets(data)
    setName('')
    setDiscord('')
    setBetDate('')
    setAmount('')
    setSubmitting(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const totalPool = bets.reduce((sum, b) => sum + Number(b.amount), 0)

  // Find closest bet to today
  const today = new Date().toISOString().split('T')[0]
  const closestBet = bets.length > 0
    ? bets.reduce((prev, curr) => {
        const prevDiff = Math.abs(new Date(prev.bet_date).getTime() - new Date(today).getTime())
        const currDiff = Math.abs(new Date(curr.bet_date).getTime() - new Date(today).getTime())
        return currDiff < prevDiff ? curr : prev
      })
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display tracking-widest uppercase text-sm animate-pulse">loading pool…</p>
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
          <Link to="/" className="px-3 py-1.5 rounded-full text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">Timeline</Link>
          <Link to="/bets" className="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-white/10 text-white transition-colors">Bet Pool</Link>
          <Link to="/quiz" className="px-3 py-1.5 rounded-full text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">Quiz</Link>
        </div>
      </nav>

      {/* ── HEADER ── */}
      <header className="px-4 sm:px-6 pt-8 pb-4 max-w-2xl mx-auto w-full text-center">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
          Prediction Pool
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          when does joseph type "mine" again? closest guess takes the pot 💸
        </p>
      </header>

      {/* ── STATS ── */}
      <section className="border-b border-white/5 px-4 sm:px-6 py-6 max-w-2xl mx-auto w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl border border-white/5 p-4 text-center">
          <div className="font-display text-2xl sm:text-3xl font-bold gradient-text">₱{totalPool.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1 font-medium">Total Pool</div>
        </div>
        <div className="glass-card rounded-2xl border border-white/5 p-4 text-center">
          <div className="font-display text-2xl sm:text-3xl font-bold text-foreground">{bets.length}</div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1 font-medium">Total Bets</div>
        </div>
        {closestBet && (
          <div className="glass-card rounded-2xl border border-holo-lilac/25 p-4 text-center col-span-2 sm:col-span-1">
            <div className="font-display text-lg sm:text-xl font-bold text-holo-lilac truncate">👑 {closestBet.name}</div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1 font-medium">Currently Winning</div>
          </div>
        )}
      </section>

      {/* ── FORM ── */}
      <section className="border-b border-white/5 px-4 sm:px-6 py-8 max-w-xl mx-auto w-full">
        <div className="lightstick-border rounded-2xl glass-card p-4 sm:p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-medium">place your bet</p>
          <div className="flex flex-col gap-3">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name *"
              className="bg-black/20 border-white/10 text-foreground placeholder:text-muted-foreground/50 rounded-lg"
            />
            <Input
              value={discord}
              onChange={e => setDiscord(e.target.value)}
              placeholder="Discord tag (optional)"
              className="bg-black/20 border-white/10 text-foreground placeholder:text-muted-foreground/50 rounded-lg"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Date you think Joseph mines</label>
              <Input
                type="date"
                value={betDate}
                onChange={e => setBetDate(e.target.value)}
                min={today}
                className="bg-black/20 border-white/10 text-foreground rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Amount to bet (₱)</label>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 50"
                min="1"
                className="bg-black/20 border-white/10 text-foreground placeholder:text-muted-foreground/50 rounded-lg"
              />
            </div>
            {success && (
              <p className="text-emerald-400 text-xs uppercase tracking-widest font-medium">✓ bet placed. may the odds be ever in your favor.</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`w-full font-display font-semibold uppercase tracking-widest text-sm py-6 rounded-full transition-all duration-200 ${
                canSubmit && !submitting
                  ? 'gradient-fill hover:opacity-90 text-white cursor-pointer shadow-glow-peach'
                  : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {submitting ? 'placing…' : 'place bet 🎯'}
            </Button>
          </div>
        </div>
      </section>

      {/* ── BETS LIST ── */}
      {bets.length > 0 && (
        <section className="px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">all bets</h2>
          <div className="flex flex-col gap-3">
            {bets.map((bet) => {
              const days = daysUntil(bet.bet_date)
              const isClosest = closestBet?.id === bet.id
              return (
                <div
                  key={bet.id}
                  className={`glass-card rounded-xl border p-4 flex items-center justify-between gap-3 transition-colors ${
                    isClosest ? 'border-holo-lilac/30 bg-holo-lilac/5' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold flex items-center gap-1.5 ${isClosest ? 'text-holo-lilac' : 'text-foreground'}`}>
                      {bet.name} {isClosest && <span>👑</span>}
                    </div>
                    <div className="text-muted-foreground text-xs mt-0.5">{bet.discord_tag ?? 'no discord tag'}</div>
                    <div className="text-muted-foreground/70 text-xs mt-1">{formatDate(bet.bet_date)} · <span className={days < 0 ? 'text-twice-peach' : 'text-muted-foreground/70'}>{days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}</span></div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-semibold text-foreground text-sm">₱{Number(bet.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <footer className="py-5 text-center text-muted-foreground/60 text-xs tracking-widest border-t border-white/5 mt-auto font-display">
        ✦ CLOSEST GUESS WINS THE POT ✦
      </footer>
    </div>
  )
}
