import React from 'react';

export interface Tool {
  name: string;
  description: string;
  icon?: React.ReactNode;
}

export interface ToolShowcaseProps {
  title?: string;
  tools: Tool[];
}

export function ToolShowcase({ title, tools }: ToolShowcaseProps) {
  return (
    <div className="tool-showcase">
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      <div className="grid md:grid-cols-2 gap-4">
        {tools.map((tool, i) => (
          <div key={i} className="border rounded p-4">
            {tool.icon && <div className="mb-2">{tool.icon}</div>}
            <h3 className="font-semibold mb-1">{tool.name}</h3>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
