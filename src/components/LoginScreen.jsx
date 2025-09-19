import React from 'react'
import { supabase } from '../supabaseClient'
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function LoginScreen() {

  const handleAnonymousSignIn = async () => {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('Error signing in anonymously:', error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-6">Welcome to Live Trivia!</h2>
        
        <SupabaseAuth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google', 'apple', 'discord']}
          theme="dark"
        />

        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        <button
          onClick={handleAnonymousSignIn}
          className="w-full bg-gray-700 text-white font-bold py-3 rounded-lg text-lg transition-transform hover:scale-105"
        >
          ► Play as Guest
        </button>
      </div>
    </div>
  )
}