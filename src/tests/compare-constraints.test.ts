
import { describe, it, expect } from 'vitest';
import { compareConstraints, type Constraint } from '../firebase/firestore/utils';

describe('compareConstraints', () => {
  it('should handle identical simple constraints', () => {
    const c1: Constraint[] = [['where', 'status', '==', 'active']];
    const c1Clone: Constraint[] = [['where', 'status', '==', 'active']];
    const c2: Constraint[] = [['where', 'status', '==', 'inactive']];

    expect(compareConstraints(c1, c1Clone)).toBe(true);
    expect(compareConstraints(c1, c2)).toBe(false);
  });

  it('should handle object constraints', () => {
    const c3: Constraint[] = [['where', 'meta', '==', { a: 1, b: 2 }]];
    const c3Clone: Constraint[] = [['where', 'meta', '==', { a: 1, b: 2 }]];
    const c4: Constraint[] = [['where', 'meta', '==', { a: 1, b: 3 }]];

    expect(compareConstraints(c3, c3Clone)).toBe(true);
    expect(compareConstraints(c3, c4)).toBe(false);
  });

  it('should handle timestamp constraints', () => {
    const ts1 = { seconds: 100, nanoseconds: 0 };
    const ts2 = { seconds: 100, nanoseconds: 0 };
    const ts3 = { seconds: 200, nanoseconds: 0 };

    const cTS1: Constraint[] = [['where', 'time', '>', ts1]];
    const cTS2: Constraint[] = [['where', 'time', '>', ts2]];
    const cTS3: Constraint[] = [['where', 'time', '>', ts3]];

    expect(compareConstraints(cTS1, cTS2)).toBe(true);
    expect(compareConstraints(cTS1, cTS3)).toBe(false);
  });

  it('should handle array constraints', () => {
    const arr1: Constraint[] = [['where', 'tags', 'in', ['a', 'b']]];
    const arr2: Constraint[] = [['where', 'tags', 'in', ['a', 'b']]];
    const arr3: Constraint[] = [['where', 'tags', 'in', ['a', 'c']]];

    expect(compareConstraints(arr1, arr2)).toBe(true);
    expect(compareConstraints(arr1, arr3)).toBe(false);
  });

  it('should handle different length constraints', () => {
    const len1: Constraint[] = [['limit', 10]];
    const len2: Constraint[] = [['limit', 10], ['orderBy', 'date']];

    expect(compareConstraints(len1, len2)).toBe(false);
  });
});
