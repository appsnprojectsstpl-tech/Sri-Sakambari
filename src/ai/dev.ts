'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/automatic-order-creation.ts';
import '@/ai/flows/translate-product-flow.ts';
import '@/ai/flows/generate-order-id-flow.ts';
