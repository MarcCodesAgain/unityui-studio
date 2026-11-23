// Prints a Zod schema as a compact TypeScript-like type, for the prompt:
//   { variant: "primary" | "secondary"; text: string; hint: string | null }
// It covers exactly the Zod features the catalog uses.

import type { z } from 'zod';

export function signature(schema: z.ZodType): string {
  const def = (schema as unknown as { def: { type: string } }).def;
  const s = schema as unknown as Record<string, unknown>;

  switch (def.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'literal':
      return JSON.stringify(s.value);
    case 'enum':
      return (s.options as string[]).map((o) => JSON.stringify(o)).join(' | ');
    case 'nullable':
      return `${signature((schema as z.ZodNullable<z.ZodType>).unwrap())} | null`;
    case 'array': {
      const inner = signature((schema as z.ZodArray<z.ZodType>).element);
      return /[|{]/.test(inner) && !inner.startsWith('{') ? `(${inner})[]` : `${inner}[]`;
    }
    case 'union':
      return (s.options as z.ZodType[]).map(signature).join(' | ');
    case 'object': {
      const shape = (schema as z.ZodObject).shape as Record<string, z.ZodType>;
      const fields = Object.entries(shape).map(([key, value]) => `${key}: ${signature(value)}`);
      return fields.length ? `{ ${fields.join('; ')} }` : '{}';
    }
    default:
      throw new Error(`signature(): unsupported Zod type "${def.type}"`);
  }
}
