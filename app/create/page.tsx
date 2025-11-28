"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Database, Play, Rocket, Code2, Zap } from "lucide-react";

export default function CreateProject() {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("app");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      alert("Please enter a description!");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/pipelines/from-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          name: title || `Project ${new Date().toLocaleDateString()}`,
          ideaPrompt: prompt,
        }),
      });
      
      const data = await res.json();

      if (res.ok) {
        router.push("/");
      } else {
        alert(`Error: ${data.error || "Failed to start pipeline"}`);
      }
    } catch (error: any) {
      console.error("Error creating pipeline:", error);
      alert(`Error: ${error.message || "Failed to start pipeline"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-900 text-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">Frost Night Factory</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent">
            Create New Project
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Describe your vision and let our AI agents build, test, and ship it for you
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl p-8 sm:p-10 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Project Name */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-300">
                Project Name <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input 
                type="text"
                className="w-full bg-slate-800/50 border border-slate-700/50 px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
                placeholder="e.g. Spotify Clone, Todo App, Social Network"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-300">
                What do you want to build?
              </label>
              <textarea 
                className="w-full h-40 bg-slate-800/50 border border-slate-700/50 px-4 py-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all resize-none backdrop-blur-sm"
                placeholder="Describe your project idea in detail...&#10;&#10;Example: A modern music streaming app with dark mode, playlist creation, and real-time sync. Should include user authentication, search functionality, and a beautiful UI."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                required
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <select 
                value={type} 
                onChange={e => setType(e.target.value)} 
                className="flex-1 bg-slate-800/50 border border-slate-700/50 px-4 py-3 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all backdrop-blur-sm"
              >
                <option value="app">New App (New Repository)</option>
                <option value="feature">Feature (Existing Repo - Coming Soon)</option>
              </select>
              
              <button 
                type="submit"
                disabled={loading || !prompt}
                className="group relative px-8 py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:from-cyan-500 hover:via-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Starting Factory...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    <span>Start Factory</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Process Steps */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-xl p-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            What happens next?
          </h3>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <StepItem icon={<Sparkles className="w-5 h-5 text-blue-400" />} title="Research" desc="Perplexity AI analyzes requirements & tech stack" />
            <StepItem icon={<Code2 className="w-5 h-5 text-green-400" />} title="Coding" desc="Gemini generates complete Next.js application code" />
            <StepItem icon={<Database className="w-5 h-5 text-purple-400" />} title="SQL" desc="Database migrations are created and executed automatically" />
            <StepItem icon={<Play className="w-5 h-5 text-cyan-400" />} title="Testing" desc="Automated tests ensure the build is stable" />
          </div>
        </div>

      </div>
    </div>
  );
}

// Step Item Component
function StepItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 hover:border-cyan-500/30 transition-all group">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex-1 pt-1.5">
        <h4 className="font-semibold text-slate-200 mb-1">{title}</h4>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}