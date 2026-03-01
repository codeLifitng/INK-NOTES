import { useState } from 'react'
import App from './App'
import Landing from './Landing'

export default function Router() {
  const [showNotes, setShowNotes] = useState(() => {
    return localStorage.getItem('ink_notes_skip_landing') === 'true'
  })

  const handleStartNotes = () => {
    localStorage.setItem('ink_notes_skip_landing', 'true')
    setShowNotes(true)
  }

  const handleBackHome = () => {
    localStorage.removeItem('ink_notes_skip_landing')
    setShowNotes(false)
  }

  return showNotes ? <App onHome={handleBackHome} /> : <Landing onStart={handleStartNotes} />
}
