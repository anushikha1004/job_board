export interface CompanyProfile {
  id: string;
  userId: string;
  company_name: string;
  website?: string;
  about?: string;
  size?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export type CompanyProfileInput = Omit<CompanyProfile, 'id' | 'created_at' | 'updated_at'>;
