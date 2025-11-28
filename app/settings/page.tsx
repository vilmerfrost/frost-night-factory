"use client"

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useSessionContext } from '@supabase/auth-helpers-react'

const SettingsPage = () => {
  const { theme, setTheme } = useTheme()
  const [currentTheme, setCurrentTheme] = useState(theme)
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = useSupabaseClient();
  const { session } = useSessionContext();

  useEffect(() => {
    setCurrentTheme(theme)
  }, [theme])

  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id);
      fetchUserPreferences(session.user.id);
    }
  }, [session]);

  const fetchUserPreferences = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user preferences:', error);
        return;
      }

      if (data) {
        setTheme(data.theme as 'light' | 'dark' | 'system');
      }
    } catch (error) {
      console.error('Unexpected error fetching user preferences:', error);
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme as 'light' | 'dark' | 'system')
    setCurrentTheme(newTheme)

    if (!userId) {
      console.warn('User ID not available.  Cannot save preference.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: userId,
            theme: newTheme,
          },
          { onConflict: 'user_id' }
        )
        .select();

      if (error) {
        console.error('Error updating user preferences:', error);
      }

      if(data) {
        console.log('User preferences updated successfully:', data);
      }
    } catch (error) {
      console.error('Unexpected error updating user preferences:', error);
    }
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-5">Settings</h1>
      <div className="mb-5">
        <label htmlFor="theme-select" className="block text-sm font-medium text-gray-700">Theme</label>
        <select
          id="theme-select"
          className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          value={currentTheme}
          onChange={(e) => handleThemeChange(e.target.value)}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </div>
  )
}

export default SettingsPage;