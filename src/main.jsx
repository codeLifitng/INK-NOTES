import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Landing from './Landing'

function Root() {
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
