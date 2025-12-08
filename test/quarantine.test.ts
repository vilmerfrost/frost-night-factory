// =============================================================================
// QUARANTINE ZONE TESTS
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { quarantine, QuarantineZone } from '../lib/quarantine/quarantine-zone';

describe('QuarantineZone', () => {
  beforeEach(() => {
    // Clear quarantine buffer before each test
    quarantine.clear();
  });

  describe('receive', () => {
    it('should quarantine code and return ID', async () => {
      const code = 'const x = 1;';
      const qId = await quarantine.receive(code);
      
      expect(qId).toMatch(/^quar_\d+_[a-z0-9]+$/);
      expect(quarantine.getStatus(qId)).toBeDefined();
    });

    it('should store code in quarantine buffer', async () => {
      const code = 'export const test = "hello";';
      const qId = await quarantine.receive(code);
      
      const status = quarantine.getStatus(qId);
      expect(status?.raw).toBe(code);
      expect(status?.status).toBe('quarantined');
    });
  });

  describe('validate', () => {
    it('should reject code with syntax errors', async () => {
      const badCode = 'interface X = string;'; // Invalid syntax
      const qId = await quarantine.receive(badCode);
      const validation = await quarantine.validate(qId, 'test.ts');
      
      expect(validation.passed).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should accept valid TypeScript', async () => {
      const goodCode = 'type X = string;\nexport const test: X = "hello";';
      const qId = await quarantine.receive(goodCode);
      const validation = await quarantine.validate(qId, 'test.ts');
      
      expect(validation.passed).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect security violations', async () => {
      const maliciousCode = 'eval(userInput);';
      const qId = await quarantine.receive(maliciousCode);
      const validation = await quarantine.validate(qId, 'test.ts');
      
      expect(validation.passed).toBe(false);
      expect(validation.errors.some(e => e.includes('CRITICAL'))).toBe(true);
    });

    it('should detect hardcoded secrets', async () => {
      const codeWithSecret = 'const apiKey = "sk-12345678901234567890123456789012";';
      const qId = await quarantine.receive(codeWithSecret);
      const validation = await quarantine.validate(qId, 'test.ts');
      
      expect(validation.passed).toBe(false);
      expect(validation.errors.some(e => e.includes('Hardcoded'))).toBe(true);
    });

    it('should detect unbalanced brackets', async () => {
      const badCode = 'function test() { return "hello";'; // Missing closing brace
      const qId = await quarantine.receive(badCode);
      const validation = await quarantine.validate(qId, 'test.ts');
      
      expect(validation.passed).toBe(false);
      expect(validation.errors.some(e => e.includes('Unbalanced'))).toBe(true);
    });

    it('should detect incomplete template literals', async () => {
      const badCode = 'const str = `hello world';'; // Missing closing backtick
      const qId = await quarantine.receive(badCode);
      const validation = await quarantine.validate(qId, 'test.ts');
      
      expect(validation.passed).toBe(false);
      expect(validation.errors.some(e => e.includes('template literal'))).toBe(true);
    });
  });

  describe('release', () => {
    it('should not release unvalidated artifacts', async () => {
      const code = 'const x: any = 1;';
      const qId = await quarantine.receive(code);
      // Don't validate
      
      const artifact = await quarantine.release(qId);
      expect(artifact).toBeNull();
    });

    it('should release validated artifacts', async () => {
      const code = 'export const test = "hello";';
      const qId = await quarantine.receive(code);
      const validation = await quarantine.validate(qId, 'test.ts');
      
      expect(validation.passed).toBe(true);
      
      const artifact = await quarantine.release(qId);
      expect(artifact).not.toBeNull();
      expect(artifact?.source).toBe(code);
      expect(artifact?.syntax).toBe('valid');
    });

    it('should extract imports from released artifact', async () => {
      const code = 'import { useState } from "react";\nexport const Test = () => null;';
      const qId = await quarantine.receive(code);
      await quarantine.validate(qId, 'test.ts');
      
      const artifact = await quarantine.release(qId);
      expect(artifact?.imports).toContain('react');
    });

    it('should extract exports from released artifact', async () => {
      const code = 'export const Test = "hello";\nexport function helper() {}';
      const qId = await quarantine.receive(code);
      await quarantine.validate(qId, 'test.ts');
      
      const artifact = await quarantine.release(qId);
      expect(artifact?.exports.length).toBeGreaterThan(0);
    });
  });

  describe('reject', () => {
    it('should mark artifact as rejected', async () => {
      const code = 'const x = 1;';
      const qId = await quarantine.receive(code);
      const errors = ['Test error'];
      
      await quarantine.reject(qId, errors);
      
      const status = quarantine.getStatus(qId);
      expect(status?.status).toBe('rejected');
      expect(status?.errors).toEqual(errors);
    });
  });

  describe('generateCodeWithQuarantine', () => {
    it('should return code on successful validation', async () => {
      const goodCode = 'export const test = "hello";';
      
      const result = await quarantine.generateCodeWithQuarantine(
        async () => goodCode,
        'test.ts',
        0
      );
      
      expect(result).toBe(goodCode);
    });

    it('should return null on failed validation', async () => {
      const badCode = 'interface X = string;';
      
      const result = await quarantine.generateCodeWithQuarantine(
        async () => badCode,
        'test.ts',
        0
      );
      
      expect(result).toBeNull();
    });

    it('should retry on failure', async () => {
      let attempt = 0;
      const codes = [
        'interface X = string;', // Bad
        'type X = string;', // Good
      ];
      
      const result = await quarantine.generateCodeWithQuarantine(
        async () => codes[attempt++],
        'test.ts',
        1
      );
      
      expect(result).toBe(codes[1]);
      expect(attempt).toBe(2);
    });
  });
});

