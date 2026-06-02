import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const tratamientos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tratamientos' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    heroImage: z.string(),
    heroAlt: z.string(),
    subtitle: z.string(),
    about: z.string(),
    benefits: z.array(z.string()),
    category: z.string(),
    cardTitle: z.string(),
    cardDescription: z.string(),
    cardImage: z.string(),
    cardImageAlt: z.string(),
    cartName: z.string(),
    cardLoading: z.enum(['eager', 'lazy']).default('lazy'),
    prices: z.array(z.object({
      label: z.string(),
      price: z.string(),
      note: z.string().optional(),
    })).optional(),
  }),
});

export const collections = { tratamientos };
