import { type DocumentData, type Timestamp } from 'firebase/firestore';

// Function to recursively convert Firestore Timestamps to JS Dates in an object
export const convertTimestamps = (data: DocumentData): DocumentData => {
    const newData: DocumentData = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];
            if (value instanceof Object && 'seconds' in value && 'nanoseconds' in value && !(value instanceof Date)) {
                newData[key] = (value as Timestamp).toDate();
            } else if (Array.isArray(value)) {
                newData[key] = value.map(item => (item instanceof Object ? convertTimestamps(item) : item));
            } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
                newData[key] = convertTimestamps(value);
            } else {
                newData[key] = value;
            }
        }
    }
    return newData;
};

export function deepCompare(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return a === b;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepCompare(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !deepCompare(a[key], b[key])) return false;
  }
  return true;
}
