// Minimal Node.js type declarations for school environment
// This file provides basic type definitions when @types/node is not available

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: string, data: string, encoding?: string): void;
  export function readFileSync(path: string, encoding?: string): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isFile(): boolean; isDirectory(): boolean };
}

declare module 'path' {
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string): string;
  export function resolve(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module 'child_process' {
  export function execSync(command: string, options?: any): Buffer;
  export function spawn(command: string, args?: string[], options?: any): any;
}

declare namespace NodeJS {
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  
  interface Process {
    env: ProcessEnv;
    cwd(): string;
    exit(code?: number): never;
  }
  
  var process: Process;
}

declare var process: NodeJS.Process;
declare var Buffer: {
  from(data: string | ArrayBuffer, encoding?: string): Buffer;
  isBuffer(obj: any): obj is Buffer;
  new (data: string | ArrayBuffer, encoding?: string): Buffer;
};

declare var global: typeof globalThis & {
  [key: string]: any;
};

declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
};

declare function setTimeout(callback: () => void, ms: number): number;
declare function clearTimeout(id: number): void;

declare module 'crypto' {
  export function createHash(algorithm: string): {
    update(data: string): any;
    digest(encoding: string): string;
  };
}

