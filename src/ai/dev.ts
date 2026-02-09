'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/automatic-order-creation';
import '@/ai/flows/translate-product-flow';
import '@/ai/flows/generate-order-id-flow';
