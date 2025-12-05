"use client";

import { useState, useRef } from "react";
import { X, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { StackSelector } from "./StackSelector";
import type { StackConfig } from "@/lib/types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ isOpen, onClose, onCreated }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [stackConfig, setStackConfig] = useState<StackConfig>({
    frontend: 'nextjs-16',
    backend: 'none',
    ui: 'shadcn',
    features: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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

  const handleSubmit = async () => {
    if (!title || !prompt) return;
    setLoading(true);

    try {
      // Use vision-based API if prompt is provided, otherwise use task API
      const apiEndpoint = prompt ? "/api/tickets" : "/api/tasks/new";
      const payload = prompt 
        ? {
            vision: prompt,  // ✅ Use 'vision' not 'description'
            stack_config: stackConfig,
            priority: 'medium',
          }
        : {
            title, 
            prompt, 
            reference_images: images,
          };

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create ticket');
      }

      const result = await response.json();
      onCreated();
      onClose();
      
      // Reset form
      setTitle("");
      setPrompt("");
      setImages([]);
      setStackConfig({
        frontend: 'nextjs-16',
        backend: 'none',
        ui: 'shadcn',
        features: [],
      });
    } catch (error) {
      console.error("Failed to create task", error);
      alert('Failed to create ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"/>
            Initialize New Operation
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          
          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Project Codename</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Project Phoenix"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mission Parameters (Prompt)</label>
            <textarea
              rows={6}
              placeholder="Describe the application architecture, tech stack, and design requirements..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none font-mono text-sm"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Tech Stack Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Tech Stack Configuration
            </label>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <StackSelector value={stackConfig} onChange={setStackConfig} />
            </div>
          </div>

          {/* Image Upload (Vision) */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between">
              <span>Reference Intelligence (Screenshots)</span>
              <span className="text-cyan-500 text-[10px]">SUPPORTED FOR VISION CLONING</span>
            </label>
            
            <div className="grid grid-cols-4 gap-3">
              {/* Upload Button */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 flex flex-col items-center justify-center cursor-pointer transition-all group"
              >
                <Upload className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 mb-2" />
                <span className="text-[10px] text-slate-500 font-medium">UPLOAD</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple 
                  onChange={handleImageUpload}
                />
              </div>

              {/* Previews */}
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 group">
                  <img src={img} alt="Preview" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                  <button 
                    onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-black/60 p-1 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading || !title || !prompt}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm px-6 py-2 rounded-md shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Initialize Pipeline"}
          </button>
        </div>

      </div>
    </div>
  );
}

