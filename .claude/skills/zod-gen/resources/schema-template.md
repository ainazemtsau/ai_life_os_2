# Schema Template

Use this template when generating new Zod schemas:

```typescript
import { z } from 'zod';

// [Entity description from README.md]
// Fields derived from: [source README.md path]
export const [EntityName]Schema = z.object({
  id: z.string().uuid(),
  // [field description]
  [fieldName]: [zodType],
  // z.string().datetime() validates strict ISO 8601 format for API string serialization
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type [EntityName] = z.infer<typeof [EntityName]Schema>;
```

## Zod Type Mapping

| Documentation Type | Zod Type |
|-------------------|----------|
| string | z.string() |
| number | z.number() |
| boolean | z.boolean() |
| UUID / ID | z.string().uuid() |
| timestamp / datetime | z.string().datetime() |
| enum / one of | z.enum(['value1', 'value2']) |
| array of X | z.array(XSchema) |
| optional | .optional() |
| nullable | .nullable() |
| min length | .min(n) |
| max length | .max(n) |
