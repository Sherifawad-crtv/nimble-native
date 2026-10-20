import { describe, expect, it } from 'vitest';
import { columnPath, compact, linear, nearest, niceAxis, smoothPath } from './chart';

describe('chart helpers', () => {
  it('niceAxis covers the data with round ticks', () => {
    const a = niceAxis([42, 97], { fromZero: false });
    expect(a.min).toBeLessThanOrEqual(42);
    expect(a.max).toBeGreaterThanOrEqual(97);
    expect(a.ticks[0]).toBe(a.min);
    expect(a.ticks[a.ticks.length - 1]).toBe(a.max);
  });
  it('niceAxis starts at zero for bars', () => {
    expect(niceAxis([30, 80], { fromZero: true }).min).toBe(0);
  });
  it('niceAxis handles a flat series', () => {
    const a = niceAxis([5, 5], { fromZero: false });
    expect(a.max).toBeGreaterThan(a.min);
  });
  it('linear maps domain to range', () => {
    const f = linear([0, 10], [100, 0]);
    expect(f(0)).toBe(100);
    expect(f(10)).toBe(0);
    expect(f(5)).toBe(50);
  });
  it('smoothPath starts at the first point and ends at the last', () => {
    const d = smoothPath([{ x: 0, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 5 }]);
    expect(d.startsWith('M0')).toBe(true);
    expect(d).toMatch(/20[ ,]5$/);
  });
  it('columnPath is a closed shape', () => {
    expect(columnPath(0, 20, 10, 50)).toMatch(/Z$/);
  });
  it('nearest picks the closest index', () => {
    expect(nearest([0, 10, 20], 14)).toBe(1);
    expect(nearest([0, 10, 20], 16)).toBe(2);
  });
  it('compact abbreviates large numbers', () => {
    expect(compact(950)).toBe('950');
    expect(compact(1300)).toBe('1.3K');
    expect(compact(2_000_000)).toBe('2M');
  });
});
