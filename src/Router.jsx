import { useState } from 'react'
import App from './App'
import Landing from './Landing'
import './Launch.css'

export default function Router() {
  const [showNotes, setShowNotes] = useState(() => {
    return sessionStorage.getItem('ink_notes_in_app') === 'true'
  })
  const [transitioning, setTransitioning] = useState(false)

  const handleStartNotes = () => {
    setTransitioning(true)
    setTimeout(() => {
      sessionStorage.setItem('ink_notes_in_app', 'true')
      setShowNotes(true)
      setTransitioning(false)
    }, 2000)
  }

  const handleBackHome = () => {
    sessionStorage.removeItem('ink_notes_in_app')
    setShowNotes(false)
  }

  return (
    <>
      {transitioning && (
        <div className="launch-overlay">
          <div className="launch-content">
            <svg className="launch-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
            <svg className="launch-line" viewBox="0 0 400 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path className="launch-stroke" d="M0 25 C40 10, 60 40, 100 25 C140 10, 160 40, 200 25 C240 10, 260 40, 300 25 C340 10, 360 40, 400 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div className="launch-text">Opening your canvas...</div>
          </div>
        </div>
      )}
      {showNotes ? <App onHome={handleBackHome} /> : <Landing onStart={handleStartNotes} />}
    </>
  )
}
