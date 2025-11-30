"use client";

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { GitBranch, Sparkles, Play, Github } from 'lucide-react';

export default function PipelineCreator() {
  const supabase = createClientComponentClient();
  const [mode, setMode] = useState<'new' | 'update'>('new');
  const [prompt, setPrompt] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Bestäm start-fas och typ baserat på läge
      const pipelineData = {
        name: mode === 'new' ? 'New Project' : 'Repo Update',
        initial_prompt: prompt,
        status: 'pending',
        type: mode, // 'new' eller 'update'
        // Om update -> starta med 'cloner', annars 'research'
        current_phase: mode === 'update' ? 'cloner' : 'research', 
        source_repo: mode === 'update' ? repoUrl : null,
      };

      // 2. Skicka till Supabase
      const { error } = await supabase
        .from('pipelines')
        .insert([pipelineData]);

      if (error) throw error;

      alert('🚀 Job started! The factory is running.');
      setPrompt('');
      setRepoUrl('');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl backdrop-blur-sm">
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setMode('new')}
          className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${
            mode === 'new' 
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          <Sparkles size={18} />
          <span>New Project</span>
        </button>
        
        <button
          onClick={() => setMode('update')}
          className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition-all ${
            mode === 'update' 
              ? 'bg-blue-500/20 border-blue-500 text-blue-400' 
              : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
          }`}
        >
          <GitBranch size={18} />
          <span>Update Repo</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'update' && (
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Target Repository URL</label>
            <div className="relative">
              <Github className="absolute left-3 top-3 text-zinc-500" size={18} />
              <input
                type="url"
                placeholder="https://github.com/username/repo-name"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 pl-10 pr-4 text-zinc-100 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
            {mode === 'new' ? 'App Vision' : 'Change Request'}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === 'new' ? "Build a cyberpunk todo app..." : "Change the button color to pink and add a delete feature..."}
            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
          } ${
            mode === 'new' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {loading ? 'Initializing...' : (
            <>
              <Play size={20} fill="currentColor" />
              {mode === 'new' ? 'Ignite Factory' : 'Deploy Updates'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

