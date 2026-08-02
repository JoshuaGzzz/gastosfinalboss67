import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/* ── Types ─────────────────────────────────── */

interface SpendingRecord {
  id: number
  timestamp: string
  reason: string
  category: string | null
  prev_start_time: number | null
}

interface WordProblem {
  question: string
  answer: number
  hint: string
  sourceRecord: SpendingRecord
  difficulty: 'easy' | 'medium' | 'tricky'
}

/* ── Price extraction ──────────────────────── */

function extractPrice(reason: string): number | null {
  // Try to find peso amounts in the reason text
  const patterns = [
    /₱\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(\d[\d,]*(?:\.\d{1,2})?)\s*(?:pesos?|php)/i,
    /(?:price|cost|paid|worth|for)\s*(?:of\s*)?₱?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /(\d[\d,]*(?:\.\d{1,2})?)\s*(?:each|per|lang|total)/i,
  ]
  for (const p of patterns) {
    const m = reason.match(p)
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''))
      if (num > 0 && num < 1_000_000) return num
    }
  }
  return null
}

/* ── Category-based price ranges ───────────── */

const CATEGORY_PRICE_RANGES: Record<string, { min: number; max: number; typical: number }> = {
  'Albums': { min: 400, max: 1800, typical: 850 },
  'Merch': { min: 150, max: 3000, typical: 500 },
  'Concerts / Events': { min: 1500, max: 15000, typical: 4500 },
  'Photocards': { min: 50, max: 2000, typical: 250 },
  'Lightsticks': { min: 1200, max: 3500, typical: 2200 },
  'Weverse / Digital': { min: 50, max: 500, typical: 150 },
}

function getPriceForRecord(record: SpendingRecord): number {
  const extracted = extractPrice(record.reason)
  if (extracted) return extracted
  const cat = record.category ?? 'Photocards'
  const range = CATEGORY_PRICE_RANGES[cat] ?? CATEGORY_PRICE_RANGES['Photocards']
  // Use a seeded-ish value based on record id for consistency
  const t = ((record.id * 7 + 13) % 100) / 100
  return Math.round(range.min + t * (range.max - range.min))
}

/* ── Name pool ─────────────────────────────── */

const NAMES = ['Joseph', 'Mika', 'Lia', 'Carlos', 'Bea', 'Javi', 'Ate Nina', 'Kuya Dan', 'Charm', 'Yuki']
function pickName(seed: number) {
  return NAMES[Math.abs(seed) % NAMES.length]
}

/* ── Problem generators ────────────────────── */

type Generator = (record: SpendingRecord, price: number, seed: number) => WordProblem

const generators: Generator[] = [
  // 1 — Simple multiplication: how much for N items?
  (record, price, seed) => {
    const qty = (seed % 4) + 2 // 2–5
    const name = pickName(seed)
    const cat = (record.category ?? 'photocard').toLowerCase().replace(/\s*\/\s*/g, ' / ')
    const answer = price * qty
    return {
      question: `${name} wants to buy ${qty} ${cat}${qty > 1 ? 's' : ''}. Each one costs ₱${price.toLocaleString()}. How much will ${name} spend in total?`,
      answer,
      hint: `Multiply the price by how many items.`,
      sourceRecord: record,
      difficulty: 'easy',
    }
  },

  // 2 — Change / subtraction: given allowance, what's left?
  (record, price, seed) => {
    const name = pickName(seed + 3)
    const allowances = [500, 1000, 1500, 2000, 3000, 5000]
    // Pick an allowance bigger than price
    const allowance = allowances.find(a => a > price) ?? price + 500
    const answer = allowance - price
    const item = record.reason.split(' ').slice(0, 4).join(' ').toLowerCase() || (record.category ?? 'a K-pop item').toLowerCase()
    return {
      question: `${name} has ₱${allowance.toLocaleString()} as allowance and spent ₱${price.toLocaleString()} on ${item}. How much money does ${name} have left?`,
      answer,
      hint: `Subtract what was spent from the allowance.`,
      sourceRecord: record,
      difficulty: 'easy',
    }
  },

  // 3 — Saving up: how many weeks to save?
  (record, price, seed) => {
    const name = pickName(seed + 7)
    const weeklyOptions = [50, 100, 150, 200, 250, 300, 500]
    const weekly = weeklyOptions[seed % weeklyOptions.length]
    const answer = Math.ceil(price / weekly)
    const cat = (record.category ?? 'K-pop item').toLowerCase()
    return {
      question: `${name} saves ₱${weekly} every week. A ${cat} costs ₱${price.toLocaleString()}. How many weeks does ${name} need to save to afford it?`,
      answer,
      hint: `Divide the total price by how much is saved each week. Round up!`,
      sourceRecord: record,
      difficulty: 'medium',
    }
  },

  // 4 — Photocard collection over months
  (record, price, seed) => {
    const name = pickName(seed + 2)
    const months = (seed % 4) + 2 // 2–5
    const monthlyAllowance = [500, 1000, 1500, 2000][seed % 4]
    const pcPrice = Math.min(price, monthlyAllowance - 50)
    const actualPrice = pcPrice > 0 ? pcPrice : 100
    const totalMoney = monthlyAllowance * months
    const answer = Math.floor(totalMoney / actualPrice)
    return {
      question: `If ${name} has ₱${monthlyAllowance.toLocaleString()} as monthly allowance, how many photocards can they collect in ${months} months if each photocard costs ₱${actualPrice.toLocaleString()}?`,
      answer,
      hint: `First find the total money over all months, then divide by the price of one photocard.`,
      sourceRecord: record,
      difficulty: 'medium',
    }
  },

  // 5 — Splitting cost with friends
  (record, price, seed) => {
    const name = pickName(seed + 5)
    const friends = (seed % 3) + 2 // 2–4 friends
    const totalPeople = friends + 1
    // Round price to be divisible
    const roundedPrice = Math.ceil(price / totalPeople) * totalPeople
    const answer = roundedPrice / totalPeople
    const cat = (record.category ?? 'K-pop merch').toLowerCase()
    return {
      question: `${name} and ${friends} friends want to split the cost of ${cat} worth ₱${roundedPrice.toLocaleString()} equally. How much does each person pay?`,
      answer,
      hint: `Divide the total cost by the number of people (don't forget to count ${name}!).`,
      sourceRecord: record,
      difficulty: 'medium',
    }
  },

  // 6 — Comparison: how many X could you get for the price of Y?
  (record, price, seed) => {
    const name = pickName(seed + 9)
    const cheapItemPrice = [50, 100, 150, 200][seed % 4]
    const answer = Math.floor(price / cheapItemPrice)
    return {
      question: `${name} spent ₱${price.toLocaleString()} on ${(record.category ?? 'K-pop stuff').toLowerCase()}. If a sticker costs ₱${cheapItemPrice}, how many stickers could ${name} have bought instead?`,
      answer,
      hint: `Divide the amount spent by the cost of one sticker.`,
      sourceRecord: record,
      difficulty: 'easy',
    }
  },
]

/* ── Generate a problem from a record ──────── */

function generateProblem(record: SpendingRecord, seed: number): WordProblem {
  const price = getPriceForRecord(record)
  const genIndex = Math.abs(seed) % generators.length
  return generators[genIndex](record, price, seed)
}

/* ── Component ─────────────────────────────── */

type AnswerState = 'idle' | 'correct' | 'wrong'

export default function WordProblems() {
  const [records, setRecords] = useState<SpendingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<WordProblem | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [showHint, setShowHint] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [streak, setStreak] = useState(0)
  const [shakeWrong, setShakeWrong] = useState(false)
  const [celebrateCorrect, setCelebrateCorrect] = useState(false)
  const [seedOffset, setSeedOffset] = useState(0)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('spending_records')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setRecords(data)
      setLoading(false)
    }
    load()
  }, [])

  const pickNewProblem = useCallback((recs: SpendingRecord[], offset: number) => {
    if (recs.length === 0) return
    const idx = Math.abs(Date.now() + offset) % recs.length
    const seed = Math.abs(Date.now() + offset * 7)
    setProblem(generateProblem(recs[idx], seed))
    setUserAnswer('')
    setAnswerState('idle')
    setShowHint(false)
    setShakeWrong(false)
    setCelebrateCorrect(false)
  }, [])

  useEffect(() => {
    if (!loading && records.length > 0 && !problem) {
      pickNewProblem(records, 0)
    }
  }, [loading, records, problem, pickNewProblem])

  const handleSubmit = () => {
    if (!problem || answerState !== 'idle') return
    const parsed = parseFloat(userAnswer.replace(/,/g, ''))
    if (isNaN(parsed)) return

    const isCorrect = Math.abs(parsed - problem.answer) < 0.01

    if (isCorrect) {
      setAnswerState('correct')
      setCelebrateCorrect(true)
      setScore(s => ({ correct: s.correct + 1, total: s.total + 1 }))
      setStreak(s => s + 1)
    } else {
      setAnswerState('wrong')
      setShakeWrong(true)
      setScore(s => ({ ...s, total: s.total + 1 }))
      setStreak(0)
      setTimeout(() => setShakeWrong(false), 600)
    }
  }

  const handleNext = () => {
    const newOffset = seedOffset + 1
    setSeedOffset(newOffset)
    pickNewProblem(records, newOffset)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (answerState !== 'idle') {
        handleNext()
      } else {
        handleSubmit()
      }
    }
  }

  const difficultyColor = {
    easy: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5',
    medium: 'text-amber-400 border-amber-400/20 bg-amber-400/5',
    tricky: 'text-twice-peach border-twice-peach/20 bg-twice-peach/5',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-display tracking-widest uppercase text-sm animate-pulse">sharpening pencils…</p>
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
          <Link to="/bets" className="px-3 py-1.5 rounded-full text-xs font-medium tracking-wide text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">Bet Pool</Link>
          <Link to="/quiz" className="px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-white/10 text-white transition-colors">Quiz</Link>
        </div>
      </nav>

      {/* ── HEADER ── */}
      <header className="px-4 sm:px-6 pt-8 pb-2 max-w-2xl mx-auto w-full text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="text-2xl">✏️</span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            Mining Math
          </h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Joseph's spending habits, turned into word problems. Solve them. Learn from his mistakes.
        </p>
      </header>

      {/* ── SCORE BAR ── */}
      <section className="px-4 sm:px-6 py-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <div className="glass-card rounded-xl border border-white/5 px-4 py-2.5 text-center">
            <div className="font-display text-xl font-bold text-foreground">{score.correct}<span className="text-muted-foreground font-normal text-sm">/{score.total}</span></div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5 font-medium">Score</div>
          </div>
          <div className={`glass-card rounded-xl border px-4 py-2.5 text-center transition-colors ${streak >= 3 ? 'border-amber-400/25 bg-amber-400/5' : 'border-white/5'}`}>
            <div className="font-display text-xl font-bold">
              {streak >= 3 ? '🔥' : ''} {streak}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5 font-medium">Streak</div>
          </div>
          {score.total > 0 && (
            <div className="glass-card rounded-xl border border-white/5 px-4 py-2.5 text-center">
              <div className="font-display text-xl font-bold gradient-text">{score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0}%</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5 font-medium">Accuracy</div>
            </div>
          )}
        </div>
      </section>

      {/* ── QUIZ CARD ── */}
      {problem && (
        <main className="flex-1 flex flex-col items-center px-4 pb-10">
          <div className={`quiz-card w-full max-w-xl transition-transform duration-300 ${shakeWrong ? 'animate-shake' : ''} ${celebrateCorrect ? 'animate-pop' : ''}`}>
            {/* Worksheet header */}
            <div className="quiz-card-header flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="quiz-card-number font-display font-bold text-sm">
                  Q{score.total + (answerState === 'idle' ? 1 : 0)}
                </span>
                <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${difficultyColor[problem.difficulty]}`}>
                  {problem.difficulty}
                </span>
              </div>
              {problem.sourceRecord.category && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium">
                  #{problem.sourceRecord.category.replace(/\s+/g, '')}
                </span>
              )}
            </div>

            {/* The question */}
            <div className="quiz-card-question mb-6">
              <p className="text-foreground/90 text-base sm:text-lg leading-relaxed font-medium">
                {problem.question}
              </p>
            </div>

            {/* Ruled lines decoration */}
            <div className="quiz-ruled-lines mb-5">
              <div className="quiz-rule" />
              <div className="quiz-rule" />
              <div className="quiz-rule" />
            </div>

            {/* Answer area */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Your answer</span>
                {answerState === 'idle' && (
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="text-[10px] uppercase tracking-widest text-holo-lilac/60 hover:text-holo-lilac transition-colors font-medium"
                  >
                    {showHint ? 'hide hint' : '💡 hint'}
                  </button>
                )}
              </div>

              {showHint && answerState === 'idle' && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-holo-lilac/5 border border-holo-lilac/15 text-holo-lilac/80 text-xs leading-relaxed">
                  {problem.hint}
                </div>
              )}

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 text-sm font-medium">₱</span>
                  <Input
                    id="quiz-answer-input"
                    type="text"
                    inputMode="numeric"
                    value={userAnswer}
                    onChange={e => setUserAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={answerState !== 'idle'}
                    placeholder="type your answer"
                    className={`pl-7 bg-black/20 border-white/10 text-foreground placeholder:text-muted-foreground/40 rounded-lg text-lg font-display font-semibold transition-all ${
                      answerState === 'correct' ? 'border-emerald-400/50 bg-emerald-400/5 text-emerald-300' :
                      answerState === 'wrong' ? 'border-twice-peach/50 bg-twice-peach/5 text-twice-peach' :
                      'focus:border-holo-lilac'
                    }`}
                    autoComplete="off"
                  />
                </div>
                {answerState === 'idle' ? (
                  <Button
                    id="quiz-submit-btn"
                    onClick={handleSubmit}
                    disabled={!userAnswer.trim()}
                    className={`font-display font-semibold uppercase tracking-wider text-sm px-5 rounded-lg transition-all ${
                      userAnswer.trim()
                        ? 'gradient-fill hover:opacity-90 text-white cursor-pointer shadow-glow-peach'
                        : 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    Check
                  </Button>
                ) : (
                  <Button
                    id="quiz-next-btn"
                    onClick={handleNext}
                    className="font-display font-semibold uppercase tracking-wider text-sm px-5 rounded-lg gradient-fill hover:opacity-90 text-white cursor-pointer shadow-glow-peach transition-all"
                  >
                    Next →
                  </Button>
                )}
              </div>
            </div>

            {/* Feedback */}
            {answerState !== 'idle' && (
              <div className={`mt-5 rounded-xl p-4 border transition-all ${
                answerState === 'correct'
                  ? 'quiz-feedback-correct'
                  : 'quiz-feedback-wrong'
              }`}>
                {answerState === 'correct' ? (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">🎉</span>
                    <div>
                      <p className="text-emerald-300 font-display font-semibold text-sm">Correct!</p>
                      <p className="text-emerald-300/70 text-xs mt-1">The answer is ₱{problem.answer.toLocaleString()}. Nice work — maybe you can teach Joseph some restraint.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">😅</span>
                    <div>
                      <p className="text-twice-peach font-display font-semibold text-sm">Not quite!</p>
                      <p className="text-twice-peach/70 text-xs mt-1">
                        The correct answer is <span className="font-display font-bold text-twice-peach">₱{problem.answer.toLocaleString()}</span>. {problem.hint}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Source tag */}
            <div className="mt-4 pt-3 border-t border-dashed border-white/5 flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-medium">Based on:</span>
              <span className="text-[10px] text-muted-foreground/50 truncate italic">"{problem.sourceRecord.reason}"</span>
            </div>
          </div>

          {/* ── NO RECORDS FALLBACK ── */}
          {records.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">No spending records yet. Joseph hasn't mined anything!</p>
              <p className="text-muted-foreground/60 text-xs mt-1">Come back after the first relapse.</p>
            </div>
          )}
        </main>
      )}

      <footer className="py-5 text-center text-muted-foreground/60 text-xs tracking-widest border-t border-white/5 mt-auto font-display">
        ✦ MATH IS THE REAL MINE ✦
      </footer>
    </div>
  )
}
