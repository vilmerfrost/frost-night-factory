"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"; // ✅ Rätt import
import { useRouter } from "next/navigation";

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient(); // ✅ Skapa klienten här
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login"); // Skicka till login om inte inloggad
      }
    } catch (error) {
      console.error("Auth check failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!mounted) return null;
  if (loading) return <div className="p-8 text-zinc-400">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8 text-white">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-zinc-400">Manage your preferences and account</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Appearance</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme("dark")}
              className={`px-4 py-2 rounded-lg border ${
                theme === "dark" 
                  ? "bg-blue-600 border-blue-500 text-white" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
              }`}
            >
              Dark Mode
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`px-4 py-2 rounded-lg border ${
                theme === "light" 
                  ? "bg-blue-600 border-blue-500 text-white" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"
              }`}
            >
              Light Mode
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Account</h2>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-900/50 border border-red-800 text-red-200 rounded-lg hover:bg-red-900 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;