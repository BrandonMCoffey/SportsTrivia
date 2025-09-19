import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import Auth from './Auth'

export default function Header({ session }) {
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleUpgrade = () => {
    setShowAuthModal(true)
  }

  return (
    <>
      <header className="w-full bg-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="text-lg font-bold">Live Trivia</div>
          <div>
            {session.user.is_anonymous ? (
              // User is a guest
              <>
                <span className="text-gray-600 mr-4">Welcome, Guest!</span>
                <button
                  onClick={handleUpgrade}
                  className="bg-green-500 text-white font-semibold py-2 px-4 rounded hover:bg-green-600"
                >
                  Save / Upgrade Account
                </button>
              </>
            ) : (
              // User is a full member
              <>
                <span className="text-gray-600 mr-4">Welcome, {session.user.email}</span>
                <button
                  onClick={handleLogout}
                  className="bg-gray-700 text-white font-semibold py-2 px-4 rounded hover:bg-gray-800"
                >
                  Log Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      
      {showAuthModal && <Auth onClose={() => setShowAuthModal(false)} />}
    </>
  )
}