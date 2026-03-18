import { z } from 'zod';

export const userRoleSchema = z.enum(['candidate', 'company', 'admin']);

export const userProfileInputSchema = z
  .object({
    email: z.email('Enter a valid email address'),
    role: userRoleSchema,
    company_name: z.string().trim().nullable(),
    created_at: z.date(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'company' && (!data.company_name || data.company_name.length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['company_name'],
        message: 'Company name must be at least 2 characters for recruiter accounts',
      });
    }
  });

export const companyProfileInputSchema = z.object({
  userId: z.string().min(1),
  company_name: z.string().trim().min(2),
  website: z.union([z.url(), z.literal('')]).optional(),
  about: z.string().trim().max(2000).optional(),
  size: z.string().trim().max(100).optional(),
  location: z.string().trim().max(120).optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

const salaryRangeSchema = z
  .object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    currency: z.enum(['GBP', 'USD']).optional(),
  })
  .refine((range) => range.max >= range.min, {
    message: 'Maximum salary must be greater than or equal to minimum salary',
    path: ['max'],
  });

export const jobInputSchema = z.object({
  title: z.string().trim().min(2, 'Job title must be at least 2 characters'),
  company_name: z.string().trim().min(2, 'Company name must be at least 2 characters'),
  tags: z.array(z.string().trim().min(1)).max(20),
  salary_range: salaryRangeSchema,
  apply_url: z.url('Enter a valid application URL'),
  location: z.string().trim().min(2).optional(),
  type: z.enum(['Full-time', 'Part-time', 'Contract', 'Freelance']).optional(),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').optional(),
  status: z.enum(['open', 'archived']).optional(),
  pipeline_state: z.enum(['new', 'reviewed', 'shortlisted', 'interviewing', 'offer', 'hired', 'rejected']).optional(),
});

export type JobInputValidated = z.infer<typeof jobInputSchema>;
export type UserProfileInputValidated = z.infer<typeof userProfileInputSchema>;

export function getZodErrorMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  return firstIssue?.message || 'Validation failed';
}
