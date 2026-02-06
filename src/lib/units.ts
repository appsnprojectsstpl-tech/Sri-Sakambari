
/**
 * Utility functions for unit parsing and conversion.
 * Supports: Kg, Grms, Ltr, ML, Pcs, Pkts
 */

type UnitType = 'weight' | 'volume' | 'count' | 'unknown';

interface ParsedUnit {
    value: number;
    unit: string;
    type: UnitType;
}

const UNIT_Standardization: Record<string, string> = {
    'kg': 'Kg', 'kgs': 'Kg', 'g': 'Grms', 'gm': 'Grms', 'gms': 'Grms', 'gram': 'Grms', 'grams': 'Grms',
    'l': 'Ltr', 'ltr': 'Ltr', 'ml': 'ML',
    'pc': 'Pcs', 'pcs': 'Pcs', 'pkt': 'Pkts', 'pkts': 'Pkts'
};

const UNIT_TYPES: Record<string, UnitType> = {
    'Kg': 'weight', 'Grms': 'weight',
    'Ltr': 'volume', 'ML': 'volume',
    'Pcs': 'count', 'Pkts': 'count'
};

/**
 * Standardizes unit string (e.g. "kgs" -> "Kg")
 */
export function standardizeUnit(unit: string): string {
    if (!unit) return '';
    const lower = unit.toLowerCase().replace(/[^a-z]/g, '');
    return UNIT_Standardization[lower] || unit;
}

/**
 * Parses a string like "500g" or just returns value and unit if provided separately.
 */
export function parseUnit(unitString: string): ParsedUnit {
    const clean = unitString.trim();
    // Regex to match "500 grms", "0.5kg", etc.
    const match = clean.match(/^([\d.]+)\s*([a-zA-Z]+)$/);

    if (match) {
        const val = parseFloat(match[1]);
        const u = standardizeUnit(match[2]);
        return { value: val, unit: u, type: UNIT_TYPES[u] || 'unknown' };
    }

    // If no number found, assume it's just a unit label implying "1 unit"? 
    // Or just return unknown. For our use case, we usually expect "Value Unit".
    return { value: 0, unit: standardizeUnit(unitString), type: 'unknown' };
}

/**
 * Checks if two units are compatible for conversion (e.g. Kg compatible with Grms)
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
    const u1 = standardizeUnit(unit1);
    const u2 = standardizeUnit(unit2);
    return UNIT_TYPES[u1] && UNIT_TYPES[u2] && UNIT_TYPES[u1] === UNIT_TYPES[u2];
}

/**
 * Converts a value from one unit to another.
 * Returns null if incompatible.
 */
export function convertUnit(value: number, fromUnit: string, toUnit: string): number | null {
    const u1 = standardizeUnit(fromUnit);
    const u2 = standardizeUnit(toUnit);

    if (!areUnitsCompatible(u1, u2)) return null;
    if (u1 === u2) return value;

    // Weight
    if (u1 === 'Kg' && u2 === 'Grms') return value * 1000;
    if (u1 === 'Grms' && u2 === 'Kg') return value / 1000;

    // Volume
    if (u1 === 'Ltr' && u2 === 'ML') return value * 1000;
    if (u1 === 'ML' && u2 === 'Ltr') return value / 1000;

    return null; // Should not happen if compatible check passed
}

/**
 * Calculates the quantity to deduct from Master Stock.
 * e.g. Buying 2 qty of "500 Grms" variant => Deduct 1 Kg from Master Stock.
 */
export function getDeductionAmount(variantUnitString: string, masterUnit: string, qty: number): number {
    // 1. Parse the variant unit string "500 Grms" -> 500, Grms
    // Note: Our UI for loose items splits this into "Value" and "Unit", but effectively we might store "500 Grms" string or separate fields.
    // Assuming the variant.unit string is like "500 Grms" or we parse it manually.

    // Check if variantUnitString is just "Grms" (meaning 1 Grms?) or "500 Grms".
    // For the UI we will build, we will likely enforce "500 Grms" format or store them.

    // Let's support the format "500 Grms".
    const { value: variantSize, unit: variantUnit } = parseUnit(variantUnitString);

    if (variantSize === 0) {
        // Fallback: If parsing failed (maybe just "Pcs"), assume 1:1 if units match, else error
        if (standardizeUnit(variantUnitString) === standardizeUnit(masterUnit)) return qty;
        return 0; // Can't convert
    }

    const convertedSize = convertUnit(variantSize, variantUnit, masterUnit);

    if (convertedSize !== null) {
        return convertedSize * qty;
    }

    return 0; // Incompatible
}
