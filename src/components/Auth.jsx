import React from 'react'
import { supabase } from '../supabaseClient'
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function Auth() {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-4">Join the Game</h2>
        <p className="text-center text-gray-600 mb-6">Sign in to play trivia and pick your team!</p>
        <SupabaseAuth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']} // You can add more providers
          theme="dark"
        />
      </div>
    </div>
  )
}