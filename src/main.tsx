import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Bets from './Bets.tsx'
import WordProblems from './WordProblems.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/bets" element={<Bets />} />
        <Route path="/quiz" element={<WordProblems />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
