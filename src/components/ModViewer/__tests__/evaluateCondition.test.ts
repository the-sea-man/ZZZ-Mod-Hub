import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../useThreeScene';

describe('evaluateCondition', () => {
  it('returns true for null, undefined, or empty expressions', () => {
    expect(evaluateCondition(null, {})).toBe(true);
    expect(evaluateCondition(undefined, {})).toBe(true);
    expect(evaluateCondition('', {})).toBe(true);
    expect(evaluateCondition('   ', {})).toBe(true);
  });

  it('evaluates single equality condition with leading $', () => {
    expect(evaluateCondition('$cloth == 1', { $cloth: 1 })).toBe(true);
    expect(evaluateCondition('$cloth == 1', { $cloth: 0 })).toBe(false);
  });

  it('evaluates single inequality (!=) condition', () => {
    expect(evaluateCondition('$cloth != 0', { $cloth: 1 })).toBe(true);
    expect(evaluateCondition('$cloth != 1', { $cloth: 1 })).toBe(false);
  });

  it('evaluates disjunctions (|| / OR expressions)', () => {
    // Standard 3DMigoto pattern: multiple styles matching one mesh
    const expr = '$cloth == 1 || $cloth == 2';
    expect(evaluateCondition(expr, { $cloth: 1 })).toBe(true);
    expect(evaluateCondition(expr, { $cloth: 2 })).toBe(true);
    expect(evaluateCondition(expr, { $cloth: 0 })).toBe(false);
    expect(evaluateCondition(expr, { $cloth: 3 })).toBe(false);
  });

  it('evaluates conjunctions (&& / AND expressions)', () => {
    const expr = '$cloth == 1 && $jacket == 0';
    expect(evaluateCondition(expr, { $cloth: 1, $jacket: 0 })).toBe(true);
    expect(evaluateCondition(expr, { $cloth: 1, $jacket: 1 })).toBe(false);
    expect(evaluateCondition(expr, { $cloth: 0, $jacket: 0 })).toBe(false);
  });

  it('evaluates relational comparison operators (>=, <=, >, <)', () => {
    expect(evaluateCondition('$style >= 2', { $style: 2 })).toBe(true);
    expect(evaluateCondition('$style >= 2', { $style: 1 })).toBe(false);

    expect(evaluateCondition('$style <= 2', { $style: 2 })).toBe(true);
    expect(evaluateCondition('$style <= 2', { $style: 3 })).toBe(false);

    expect(evaluateCondition('$style > 2', { $style: 3 })).toBe(true);
    expect(evaluateCondition('$style > 2', { $style: 2 })).toBe(false);

    expect(evaluateCondition('$style < 2', { $style: 1 })).toBe(true);
    expect(evaluateCondition('$style < 2', { $style: 2 })).toBe(false);
  });

  it('evaluates boolean negation (!)', () => {
    expect(evaluateCondition('!$cloth', { $cloth: 0 })).toBe(true);
    expect(evaluateCondition('!$cloth', { $cloth: 1 })).toBe(false);
    expect(evaluateCondition('!cloth', { $cloth: 0 })).toBe(true);
    expect(evaluateCondition('!cloth', { cloth: 1 })).toBe(false);
  });

  it('normalizes variable names case-insensitively and with/without leading $', () => {
    // Stored without $, queried with $
    expect(evaluateCondition('$cloth == 1', { cloth: 1 })).toBe(true);
    // Stored with $, queried without $
    expect(evaluateCondition('cloth == 1', { $cloth: 1 })).toBe(true);
    // Case insensitivity
    expect(evaluateCondition('$CLOTH == 1', { $cloth: 1 })).toBe(true);
    expect(evaluateCondition('$cloth == 1', { $CLOTH: 1 })).toBe(true);
  });

  it('evaluates compound disjunctions with conjunctions', () => {
    const compound = '($cloth == 1 && $jacket == 0) || $cloth == 2';
    expect(evaluateCondition(compound, { $cloth: 1, $jacket: 0 })).toBe(true);
    expect(evaluateCondition(compound, { $cloth: 1, $jacket: 1 })).toBe(false);
    expect(evaluateCondition(compound, { $cloth: 2, $jacket: 1 })).toBe(true);
  });
});
