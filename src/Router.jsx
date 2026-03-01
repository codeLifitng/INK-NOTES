import { useState } from 'react'
import App from './App'
import Landing from './Landing'

export default function Router() {
  const [showNotes, setShowNotes] = useState(() => {
    return sessionStorage.getItem('ink_notes_in_app') === 'true'
  })

  const handleStartNotes = () => {
    sessionStorage.setItem('ink_notes_in_app', 'true')
    setShowNotes(true)
  }

  const handleBackHome = () => {
    sessionStorage.removeItem('ink_notes_in_app')
    setShowNotes(false)
  }

  return showNotes ? <App onHome={handleBackHome} /> : <Landing onStart={handleStartNotes} />
}
