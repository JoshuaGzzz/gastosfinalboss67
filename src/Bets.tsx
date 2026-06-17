import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
        <Link to="/bets" className="text-xs uppercase tracking-widest text-white transition-colors">Betting Pool</Link>
      </nav>

      {/* HEADER */}
      <header className="border-b border-zinc-800 py-8 px-6 text-center">
        <h1 className="text-4xl font-black tracking-tight uppercase text-white leading-none">
          Betting Pool
        </h1>
        <p className="mt-3 text-zinc-400 tracking-widest uppercase text-sm">
          When will Joseph break? Closest guess wins the pot.
        </p>
      </header>

      {/* STATS */}
      <section className="border-b border-zinc-800 px-6 py-6 flex flex-col sm:flex-row justify-center gap-8 text-center">
        <div>
          <div className="text-4xl font-black text-white">₱{totalPool.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
          <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Total Pool</div>
        </div>
        <div>
          <div className="text-4xl font-black text-white">{bets.length}</div>
          <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Total Bets</div>
        </div>
        {closestBet && (
          <div>
            <div className="text-4xl font-black text-yellow-400">{closestBet.name}</div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mt-1">Currently Winning</div>
          </div>
        )}
      </section>

      {/* FORM */}
      <section className="border-b border-zinc-800 px-6 py-8 max-w-xl mx-auto w-full">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Place Your Bet</p>
        <div className="flex flex-col gap-3">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name *"
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 font-mono"
          />
          <Input
            value={discord}
            onChange={e => setDiscord(e.target.value)}
            placeholder="Discord tag (optional)"
            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 font-mono"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Date you think Joseph breaks *</label>
            <Input
              type="date"
              value={betDate}
              onChange={e => setBetDate(e.target.value)}
              min={today}
              className="bg-zinc-900 border-zinc-700 text-white font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Amount to bet (₱) *</label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 50"
              min="1"
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 font-mono"
            />
          </div>
          {success && (
            <p className="text-green-400 text-xs uppercase tracking-widest">Bet placed. May the odds be ever in your favor.</p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`w-full font-black uppercase tracking-widest text-base py-6 transition-all duration-200 ${
              canSubmit && !submitting
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {submitting ? 'Placing...' : 'Place Bet'}
          </Button>
        </div>
      </section>

      {/* BETS TABLE */}
      {bets.length > 0 && (
        <section className="px-6 py-8 max-w-4xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">All Bets</h2>
          <div className="overflow-x-auto rounded border border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Name</TableHead>
                  <TableHead className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Discord</TableHead>
                  <TableHead className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Date Bet</TableHead>
                  <TableHead className="text-zinc-500 font-bold uppercase text-xs tracking-widest">Days Away</TableHead>
                  <TableHead className="text-zinc-500 font-bold uppercase text-xs tracking-widest text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bets.map((bet) => {
                  const days = daysUntil(bet.bet_date)
                  const isClosest = closestBet?.id === bet.id
                  return (
                    <TableRow key={bet.id} className={`border-zinc-800 ${isClosest ? 'bg-yellow-500/10' : 'hover:bg-zinc-900/50'}`}>
                      <TableCell className={`text-sm py-3 font-bold ${isClosest ? 'text-yellow-400' : 'text-zinc-200'}`}>
                        {bet.name} {isClosest ? '👑' : ''}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs py-3">{bet.discord_tag ?? '—'}</TableCell>
                      <TableCell className="text-zinc-300 text-xs py-3 whitespace-nowrap">{formatDate(bet.bet_date)}</TableCell>
                      <TableCell className={`text-xs py-3 ${days < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                        {days < 0 ? `${Math.abs(days)}d ago` : `in ${days}d`}
                      </TableCell>
                      <TableCell className="text-zinc-200 text-sm py-3 text-right">
                        ₱{Number(bet.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <footer className="py-4 text-center text-zinc-700 text-xs tracking-widest border-t border-zinc-900 mt-auto">
        CLOSEST GUESS WINS THE POT
      </footer>
    </div>
  )
}
