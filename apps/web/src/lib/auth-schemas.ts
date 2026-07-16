import { z } from 'zod';

export const signUpSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Valid phone number required').refine((val) => {
    // Basic check to see if it starts with + or has country code
    return /^\+?[0-9\s-]{10,15}$/.test(val);
  }, { message: 'Phone number must include country code (e.g. +91 or +1)' }),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .refine((val) => /[A-Z]/.test(val), { message: 'Password must contain at least one uppercase letter' })
    .refine((val) => /[a-z]/.test(val), { message: 'Password must contain at least one lowercase letter' })
    .refine((val) => /[0-9]/.test(val), { message: 'Password must contain at least one number' }),
  confirm_password: z.string().min(8, 'Confirm password is required'),
  accept_terms: z.boolean().refine(val => val === true, {
    message: 'You must accept the Terms of Service and Privacy Policy'
  })
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"]
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const basicProfileSchema = z.object({
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'District or State is required'),
  country: z.string().min(1, 'Country is required'),
  preferred_language: z.string().min(1, 'Preferred language is required'),
  bio: z.string().optional()
});

export type BasicProfileInput = z.infer<typeof basicProfileSchema>;
