// 'use server';
// Server Actions are not supported in static exports (Capacitor).
// This must be deployed as a separate Cloud Function or API.

import type { TranslateProductInput, TranslateProductOutput } from '@/lib/types';

export async function translateProduct(input: TranslateProductInput): Promise<TranslateProductOutput> {
  console.warn("AI Translation is disabled in static export mode. Deploy a backend to enable.");
  // Mock response or throw
  return {
    productName: input.productName, // Return same name
    translatedName: input.productName + " (Telugu)", // Dummy translation
    language: 'te'
  };
}

/*
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { TranslateProductInputSchema, TranslateProductOutputSchema } from '@/lib/types';


const prompt = ai.definePrompt({
  name: 'translateProductPrompt',
  input: { schema: TranslateProductInputSchema },
  output: { schema: TranslateProductOutputSchema },
  prompt: `Translate the following English product name to Telugu.
If a common Telugu word for the item exists, provide that translation.
If there is no direct or common translation, transliterate the English name into Telugu script (e.g., "Baby Corn" becomes "బేబీ కార్న్").
Provide only the final translated or transliterated text.

Product Name: {{{productName}}}`,
});

const translateProductFlow = ai.defineFlow(
  {
    name: 'translateProductFlow',
    inputSchema: TranslateProductInputSchema,
    outputSchema: TranslateProductOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
*/
