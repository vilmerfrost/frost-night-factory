// ✅ Bug 5: Fixed test file syntax
import { stripCodeFences } from './pipeline-runner';
const testCases = [
    {
        name: 'Code fence',
        input: '```typescript\nconst x = 5;\n```',
        expected: 'const x = 5;'
    },
    {
        name: 'FILE marker',
        input: '[FILE: src/app/page.tsx]\nconst x = 5;',
        expected: 'const x = 5;'
    },
    {
        name: 'GOAL marker',
        input: 'const x = 5;\n\n[GOAL]\nFixed the bug by...',
        expected: 'const x = 5;'
    },
    {
        name: 'All combined',
        input: '```typescript\n[FILE: test.ts]\nconst x = 5;\n```',
        expected: 'const x = 5;'
    }
];
testCases.forEach(test => {
    const result = stripCodeFences(test.input);
    const pass = result.trim() === test.expected.trim();
    console.log(`${pass ? '✅' : '❌'} ${test.name}`);
    if (!pass) {
        console.log(`   Expected: "${test.expected}"`);
        console.log(`   Got: "${result}"`);
    }
});
