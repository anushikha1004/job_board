'use client';

import { useState } from 'react';
import { postJob } from '@/lib/favorites';
import { useAuth } from '@/lib/auth-context';
import { Briefcase, X, Loader, MapPin, Globe, PoundSterling } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Job, JobInput } from '@/types/job';
import { FirebaseError } from 'firebase/app';
import { z } from 'zod';
import { getZodErrorMessage, jobInputSchema } from '@/lib/validation';
import { updateJob } from '@/lib/firestore';

interface JobPostingFormProps {
  onClose: () => void;
  onSuccess?: (job?: Job) => void;
  initialJob?: Job | null;
}

export function JobPostingForm({ onClose, onSuccess, initialJob = null }: JobPostingFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitMode, setSubmitMode] = useState<'publish' | 'draft'>('publish');

  const [formData, setFormData] = useState(() => ({
    title: initialJob?.title || '',
    company_name: initialJob?.company_name || '',
    description: initialJob?.description || '',
    tags: initialJob?.tags?.join(', ') || '',
    location: initialJob?.location || '',
    type: initialJob?.type || 'Full-time',
    salary_min: initialJob?.salary_range?.min ? String(Math.floor(initialJob.salary_range.min / 1000)) : '',
    salary_max: initialJob?.salary_range?.max ? String(Math.floor(initialJob.salary_range.max / 1000)) : '',
    apply_url: initialJob?.apply_url || '',
  }));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('You must be logged in to post a job. Redirecting to login...');
      router.replace('/login/recruiter');
      onClose();
      return;
    }

    // Validation
    if (!formData.title || !formData.company_name || !formData.description || !formData.apply_url) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsLoading(true);

    try {
      const minSalary = (parseInt(formData.salary_min, 10) || 0) * 1000;
      const maxSalary = (parseInt(formData.salary_max, 10) || 0) * 1000;

      // Prepare the payload to match your Firestore schema
      const jobData: JobInput = {
        title: formData.title,
        company_name: formData.company_name,
        description: formData.description,
        location: formData.location || 'Remote',
        type: formData.type,
        apply_url: formData.apply_url,
        status: submitMode === 'draft' ? 'archived' : (initialJob?.status || 'open'),
        pipeline_state: initialJob?.pipeline_state || 'new',
        // Formatting tags as an array for JobCard mapping
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
        // Salary inputs are in thousands (£k), so store full currency values
        salary_range: {
          min: minSalary,
          max: maxSalary,
          currency: 'GBP'
        }
      };

      const validatedJob = jobInputSchema.parse(jobData) as JobInput;
      let resultJob: Job;
      if (initialJob?.id) {
        await updateJob(initialJob.id, validatedJob);
        resultJob = {
          ...initialJob,
          ...validatedJob,
          updated_at: new Date().toISOString(),
        };
      } else {
        resultJob = await postJob(user.uid, validatedJob);
      }
      
      if (onSuccess) {
        onSuccess(resultJob);
      }
      onClose();
    } catch (err: unknown) {
      console.error('Submission error:', err);
      let message = err instanceof Error ? err.message : 'Failed to post job. Please try again.';
      if (err instanceof z.ZodError) {
        message = getZodErrorMessage(err);
      }
      if (err instanceof FirebaseError && err.code === 'permission-denied') {
        message = 'Permission denied in Firestore. Allow authenticated company users to write jobs.';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass glass-heavy w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyber-purple/20 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-cyber-purple" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{initialJob ? 'Edit Job Posting' : 'Post a New Position'}</h2>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground-light">Job Title *</label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Senior Frontend Developer"
                className="glass-input w-full px-4 py-2.5 rounded-lg"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground-light">Company Name *</label>
              <input
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="Your Company"
                className="glass-input w-full px-4 py-2.5 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground-light">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Tell us about the role..."
              className="glass-input w-full px-4 py-2.5 rounded-lg resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground-light flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Location
              </label>
              <input
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. London or Remote"
                className="glass-input w-full px-4 py-2.5 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground-light">Job Type</label>
              <select 
                name="type" 
                value={formData.type} 
                onChange={handleChange}
                className="glass-input w-full px-4 py-2.5 rounded-lg bg-background"
              >
                <option value="Full-time">Full-time</option>
                <option value="Contract">Contract</option>
                <option value="Part-time">Part-time</option>
                <option value="Freelance">Freelance</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground-light flex items-center gap-2">
              <PoundSterling className="w-4 h-4" /> Salary Range (£k)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                name="salary_min"
                value={formData.salary_min}
                onChange={handleChange}
                placeholder="Min (e.g. 60)"
                className="glass-input w-full px-4 py-2.5 rounded-lg"
              />
              <span className="text-foreground-muted">to</span>
              <input
                type="number"
                name="salary_max"
                value={formData.salary_max}
                onChange={handleChange}
                placeholder="Max (e.g. 90)"
                className="glass-input w-full px-4 py-2.5 rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground-light">Tags (Comma separated)</label>
            <input
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="React, TypeScript, Node.js"
              className="glass-input w-full px-4 py-2.5 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground-light flex items-center gap-2">
              <Globe className="w-4 h-4" /> Application URL *
            </label>
            <input
              type="url"
              name="apply_url"
              value={formData.apply_url}
              onChange={handleChange}
              placeholder="https://company.com/jobs/apply"
              className="glass-input w-full px-4 py-2.5 rounded-lg"
              required
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2 text-lg"
              onClick={() => setSubmitMode('publish')}
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                initialJob ? 'Save Changes' : 'Publish Listing'
              )}
            </button>
            {!initialJob && (
              <button
                type="submit"
                disabled={isLoading}
                onClick={() => setSubmitMode('draft')}
                className="btn-secondary flex-1 py-3"
              >
                Save as Draft
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-3 px-6"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
