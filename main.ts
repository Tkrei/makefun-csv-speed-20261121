import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Use the same GC tuning as the published baseline, before loading the parser.
setFlagsFromString('--no-incremental-marking --no-opt');
const { run } = await import('./solve.js');

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const parts = cases.map(({ input }) => JSON.stringify(run(input)));
writeFileSync(join(outputDir, 'answers.json'), '[' + parts.join(',') + ']');
