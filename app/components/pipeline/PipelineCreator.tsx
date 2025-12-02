"use client";

import { useState, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { GitBranch, Sparkles, Play, Github, Upload, X, Image as ImageIcon } from 'lucide-react';

export default function PipelineCreator() {
  const supabase = createClientComponentClient();
  const [mode, setMode] = useState<'new' | 'update'>('new');
  const [prompt, setPrompt] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

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
        attachment_url: images.length > 0 ? images[0] : null, // Första bilden som primary
        reference_images: images, // Alla bilder som array
      };

      // 2. Skicka till Supabase
      const { error } = await supabase
        .from('pipelines')
        .insert([pipelineData]);

      if (error) throw error;

      alert('🚀 Job started! The factory is running.');
      setPrompt('');
      setRepoUrl('');
      setImages([]);
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

        {/* Image Upload Section */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between">
            <span>Reference Images (Vision Cloning)</span>
            <span className="text-cyan-500 text-[10px] font-normal">OPTIONAL</span>
          </label>
          
          <div className="grid grid-cols-4 gap-3">
            {/* Upload Button */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-zinc-800 hover:border-cyan-500/50 hover:bg-zinc-800/30 flex flex-col items-center justify-center cursor-pointer transition-all group"
            >
              <Upload className="w-5 h-5 text-zinc-500 group-hover:text-cyan-400 mb-1" />
              <span className="text-[10px] text-zinc-500 group-hover:text-cyan-400 font-medium">UPLOAD</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                multiple 
                onChange={handleImageUpload}
              />
            </div>

            {/* Image Previews */}
            {images.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-800 group">
                <img src={img} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <button 
                  type="button"
                  onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-black/70 p-1 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          
          {images.length > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              {images.length} image{images.length > 1 ? 's' : ''} ready for Vision Cloning
            </p>
          )}
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

