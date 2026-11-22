import { z } from 'zod'
import { ERROR_CODES, type SolveResponse } from '../model/contract'

const integer = z.number().int()
const optionalInteger = integer.optional()

const outcomeSchema = z.strictObject({
  ruleId: z.string(),
  result: z.enum(['met', 'neutral', 'notMet']),
  detail: z.strictObject({
    row: optionalInteger,
    rows: optionalInteger,
    distance: optionalInteger,
    column: optionalInteger,
    columns: optionalInteger,
  }),
})

const arrangementSchema = z.strictObject({
  rank: integer,
  scores: z.strictObject({
    front: integer,
    nearBy: integer,
    isle: integer,
    total: integer,
    weighted100: integer,
  }),
  rulesMet: integer,
  rulesTotal: integer,
  assignments: z.array(z.strictObject({ studentId: z.string(), deskId: z.string() })),
  outcomes: z.array(outcomeSchema),
})

/** Decodes a 200 response; anything else fails closed (AD-5). */
export const responseSchema = z.strictObject({ arrangements: z.array(arrangementSchema).max(3) })

export const errorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    field: z.string().optional(),
    limit: integer.optional(),
  }),
})

// Compile-time proof that the schemas and the hand-written contract types agree.
const _responseMatchesContract: z.ZodType<SolveResponse> = responseSchema
void _responseMatchesContract
