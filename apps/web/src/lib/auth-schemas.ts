import { z } from 'zod';

export const signUpSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine((val) => /[A-Z]/.test(val), { message: 'Password must contain at least one uppercase letter' })
    .refine((val) => /[a-z]/.test(val), { message: 'Password must contain at least one lowercase letter' })
    .refine((val) => /[0-9]/.test(val), { message: 'Password must contain at least one number' }),
  accept_terms: z.boolean().refine(val => val === true, {
    message: 'You must accept the Terms of Service and Privacy Policy'
  })
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const basicProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  preferred_language: z.string().optional(),
  bio: z.string().optional()
});

export type BasicProfileInput = z.infer<typeof basicProfileSchema>;
