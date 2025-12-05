'use client';

import type { StackConfig } from '@/lib/types';

interface StackSelectorProps {
  value: StackConfig;
  onChange: (config: StackConfig) => void;
}

export function StackSelector({ value, onChange }: StackSelectorProps) {
  const updateConfig = (key: keyof StackConfig, val: any) => {
    onChange({ ...value, [key]: val });
  };

  const toggleFeature = (feature: string) => {
    const newFeatures = value.features.includes(feature)
      ? value.features.filter(f => f !== feature)
      : [...value.features, feature];
    
    updateConfig('features', newFeatures);
  };

  function calculateEstimatedCost(config: StackConfig): number {
    let cost = 0.50; // Base cost
    
    // Frontend costs
    if (config.frontend === 'nextjs-15') cost += 0.05;
    if (config.frontend === 'nextjs-14') cost += 0.10;
    
    // Backend costs
    if (config.backend === 'fastapi') cost += 0.10;
    if (config.backend === 'nextjs-api') cost += 0.05;
    
    // Feature costs
    if (config.features.includes('auth')) cost += 0.05;
    if (config.features.includes('database')) cost += 0.10;
    if (config.features.includes('payments')) cost += 0.15;
    if (config.features.includes('analytics')) cost += 0.05;
    
    return cost;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">
        Configure Your Stack
      </h2>
      
      {/* Frontend Framework */}
      <div>
        <label className="block text-cyan-400 text-sm font-mono mb-2">
          FRONTEND FRAMEWORK
        </label>
        <select 
          value={value.frontend}
          onChange={(e) => updateConfig('frontend', e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="nextjs-16">
            Next.js 16 (Turbopack, React 19) - Fastest ⚡
          </option>
          <option value="nextjs-15">
            Next.js 15 (Webpack, React 19 RC)
          </option>
          <option value="nextjs-14">
            Next.js 14 (LTS, React 18) - Most Stable
          </option>
        </select>
        <p className="text-slate-500 text-sm mt-1">
          {value.frontend === 'nextjs-16' && '4x faster builds, React 19 stable'}
          {value.frontend === 'nextjs-15' && 'Slower builds, React 19 RC'}
          {value.frontend === 'nextjs-14' && 'LTS support, React 18 only'}
        </p>
      </div>
      
      {/* Backend */}
      <div>
        <label className="block text-purple-400 text-sm font-mono mb-2">
          BACKEND
        </label>
        <select 
          value={value.backend}
          onChange={(e) => updateConfig('backend', e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-purple-500 focus:outline-none"
        >
          <option value="fastapi">
            FastAPI (Python) - Full Backend
          </option>
          <option value="none">
            Frontend Only - No Backend
          </option>
          <option value="nextjs-api">
            Next.js API Routes - Lightweight
          </option>
        </select>
        <p className="text-slate-500 text-sm mt-1">
          {value.backend === 'fastapi' && 'Full REST API with Python'}
          {value.backend === 'none' && 'Static site or external API'}
          {value.backend === 'nextjs-api' && 'Serverless functions only'}
        </p>
      </div>
      
      {/* UI Components */}
      <div>
        <label className="block text-pink-400 text-sm font-mono mb-2">
          UI COMPONENT LIBRARY
        </label>
        <select 
          value={value.ui}
          onChange={(e) => updateConfig('ui', e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white focus:border-pink-500 focus:outline-none"
        >
          <option value="shadcn">
            Shadcn/ui - Premium & Customizable ⭐
          </option>
          <option value="daisyui">
            DaisyUI - Fast Prototyping
          </option>
          <option value="nextui">
            NextUI - Modern SaaS
          </option>
        </select>
        <p className="text-slate-500 text-sm mt-1">
          {value.ui === 'shadcn' && 'Best for production apps, full code ownership'}
          {value.ui === 'daisyui' && 'Fastest setup, 63 components'}
          {value.ui === 'nextui' && 'Beautiful defaults, modern animations'}
        </p>
      </div>
      
      {/* Features */}
      <div>
        <label className="block text-green-400 text-sm font-mono mb-2">
          FEATURES (OPTIONAL)
        </label>
        <div className="space-y-2">
          {[
            { id: 'auth', label: 'Authentication (Supabase Auth)', cost: '+$0.05' },
            { id: 'database', label: 'Database (PostgreSQL)', cost: '+$0.10' },
            { id: 'payments', label: 'Payments (Stripe)', cost: '+$0.15' },
            { id: 'analytics', label: 'Analytics (Plausible)', cost: '+$0.05' },
          ].map(feature => (
            <label 
              key={feature.id}
              className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-700 rounded hover:border-green-500/50 cursor-pointer transition-colors"
            >
              <input 
                type="checkbox"
                checked={value.features.includes(feature.id)}
                onChange={() => toggleFeature(feature.id)}
                className="w-4 h-4 accent-green-500"
              />
              <span className="flex-1 text-white">{feature.label}</span>
              <span className="text-slate-500 text-sm">{feature.cost}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Cost Estimate */}
      <div className="bg-slate-950 border border-cyan-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-cyan-400 font-mono text-sm">ESTIMATED COST</span>
          <span className="text-2xl font-bold text-white">
            ${calculateEstimatedCost(value).toFixed(2)}
          </span>
        </div>
        <p className="text-slate-500 text-sm mt-2">
          Base: $0.50 | Features: ${(calculateEstimatedCost(value) - 0.50).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

