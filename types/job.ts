/**
 * Job structure for the IT Job Board
 */
export interface Job {
  id: string;
  title: string;
  company_name: string;
  tags: string[];
  salary_range: {
    min: number;
    max: number;
    currency?: string;
  };
  apply_url: string;
  location?: string;
  type?: string;
  description?: string;
  postedBy?: string;
  status?: 'open' | 'archived';
  pipeline_state?: 'new' | 'reviewed' | 'shortlisted' | 'interviewing' | 'offer' | 'hired' | 'rejected';
  created_at: string;
  updated_at: string;
}

/**
 * Job creation payload (without system fields)
 */
export type JobInput = Omit<Job, 'id' | 'created_at' | 'updated_at'>;
