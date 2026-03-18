# Job Board - Setup Guide & Features

##  Getting Started

### 1. **User Registration (Role-Based)**

When signing up, users must select their role:

#### **Job Seeker / Candidate**
- Browse all available jobs
- Save jobs to favorites
- View favorite jobs in one place
- Track job applications (coming soon)

#### **Recruiter / Company**
- Post new job listings
- Manage posted jobs
- View applications received
- Track hiring progress

### 2. **Authentication Flow**

```
Landing Page (/) 
    ↓
    ├─→ Login Page (/login)
    ├─→ Signup Page (/signup)
            ↓
        Role Selection (Candidate / Company)
            ↓
            ├─→ Candidate Dashboard (/candidate)
            ├─→ Company Dashboard (/company)
```

### 3. **User Dashboard Redirect**

After login or signup, users are automatically routed to their role-specific dashboard:

- **Dashboard Page** (`/dashboard`) acts as a smart router
- Fetches user role from Firestore
- Redirects to `/candidate` or `/company` based on role
- No manual routing needed!

---

## 📋 Features

### **Candidate Dashboard** (`/app/candidate/page.tsx`)

✅ **Browse All Jobs**
- View all active job postings
- See job details (title, company, location, salary, type, tags)
- Professional glassmorphic card design

✅ **Save Jobs to Favorites**
- Click heart icon to favorite a job
- Favorites are stored in Firestore
- View count of saved jobs

✅ **View Favorite Jobs**
- Dedicated section showing all saved jobs
- Quick access to your curated list
- Remove from favorites anytime

✅ **User Profile**
- See your email and UID
- Logout button
- Profile avatar with initial

### **Company Dashboard** (`/app/company/page.tsx`)

✅ **Post New Jobs**
- Click "Post New Job" button
- Opens JobPostingForm modal
- Fill in job details:
  - Job Title (required)
  - Company Name (required)
  - Description (required)
  - Tags (comma-separated)
  - Location
  - Job Type (Full-time, Part-time, Contract, etc.)
  - Salary Range
  - Application URL

✅ **Manage Posted Jobs**
- View all your posted jobs
- Shows job count
- Edit job details (coming soon)
- Delete jobs with confirmation

✅ **Track Applications** (coming soon)
- See who applied for your jobs
- Review applicant profiles
- Accept/reject candidates

---

## 🗄️ Database Schema

### Firestore Collections

#### **users** (Firebase Auth)
- Managed by Firebase Authentication
- Email/password stored securely

#### **user_profiles**
```typescript
{
  userId: string,
  email: string,
  role: "candidate" | "company",
  company_name: string | null,
  created_at: Timestamp
}
```

#### **jobs**
```typescript
{
  id: string,
  title: string,
  company_name: string,
  description: string,
  tags: string[],
  location: string,
  type: string,
  salary_range: {
    min: number,
    max: number,
    currency: string
  },
  apply_url: string,
  postedBy: string (userId),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### **favorites**
```typescript
{
  id: string,
  userId: string,
  jobId: string,
  savedAt: Timestamp
}
```

#### **applications** (planned)
```typescript
{
  id: string,
  jobId: string,
  userId: string,
  appliedAt: Timestamp,
  status: "applied" | "viewed" | "shortlisted" | "rejected"
}
```

---

## 🔧 Key Components

### **Authentication**
- `lib/auth-context.tsx` - Global auth state & functions
- `components/LoginForm.tsx` - Login UI
- `components/SignupForm.tsx` - Signup UI with role selection
- `components/UserProfile.tsx` - User info & logout

### **Job Management**
- `components/JobCard.tsx` - Job listing display
- `components/JobPostingForm.tsx` - Modal form for posting jobs
- `lib/firestore.ts` - Database operations
- `lib/favorites.ts` - Favorite & job posting functions
- `lib/hooks.ts` - Custom React hooks

### **Pages**
- `/app/page.tsx` - Landing page
- `/app/login/page.tsx` - Login page
- `/app/signup/page.tsx` - Signup page
- `/app/dashboard/page.tsx` - Smart router (redirects based on role)
- `/app/candidate/page.tsx` - Candidate dashboard
- `/app/company/page.tsx` - Company/recruiter dashboard

---

## 📱 User Workflows

### **Candidate User Flow**

1. **First Time**
   - Click "Sign Up"
   - Select "Job Seeker" role
   - Enter email, password, confirm
   - Redirected to Candidate Dashboard

2. **Browse & Save Jobs**
   - Candidate Dashboard shows "All Jobs" section
   - Click heart icon to save jobs to favorites
   - View favorite count in "Saved Jobs" section

3. **Manage Favorites**
   - Click "Saved Jobs" to see all favorites
   - Click heart again to remove from favorites
   - Each favorite is stored in Firestore

4. **Login Next Time**
   - Go to /login
   - Enter credentials
   - Auto-routed to Candidate Dashboard

### **Company/Recruiter Flow**

1. **First Time**
   - Click "Sign Up"
   - Select "Recruiter/Hiring" role
   - Enter email, password, company name
   - Redirected to Company Dashboard

2. **Post a Job**
   - Click "Post New Job" button
   - Fill JobPostingForm modal
   - Submit job
   - Job appears in "Your Job Postings"

3. **Manage Jobs**
   - View all posted jobs
   - Delete job with confirmation
   - (Coming: Edit job details, view applications)

4. **Login Next Time**
   - Go to /login
   - Enter credentials
   - Auto-routed to Company Dashboard

---

## 🔐 Security Features

✅ Firebase Authentication (Email/Password)
✅ User session persistence
✅ Protected routes (redirect to login if not authenticated)
✅ Role-based access control
✅ Firestore security rules (user data isolation)

---

## 🎨 Design System

### Colors
- **Primary**: Cyber Purple (`#a78bfa`)
- **Secondary**: Electric Blue (`#06b6d4`)
- **Background**: Dark (`#0f172a`)
- **Glass Effect**: 10-20px backdrop blur + transparency

### Components
- Glassmorphic cards
- Gradient borders
- Smooth transitions
- Responsive grid layouts
- Icons from Lucide React

---

## 📦 Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser
# http://localhost:3000
```

---

## 📝 Testing Checklist

- [ ] Sign up as Candidate, verify redirect to `/candidate`
- [ ] Sign up as Company, verify redirect to `/company`
- [ ] Login with existing account, verify role-based redirect
- [ ] Candidate: Browse jobs, save/remove favorites
- [ ] Company: Post a job, view in posted jobs list
- [ ] Company: Delete a job
- [ ] Logout and login again, verify data persists
- [ ] Check Firestore database for stored data

---

## 🔄 Future Features

- [ ] Edit posted jobs
- [ ] View job applications
- [ ] Accept/reject candidates
- [ ] Job search & advanced filters
- [ ] Email notifications
- [ ] User profile customization
- [ ] Company profile pages
- [ ] Resume upload
- [ ] Candidate reviews/ratings
- [ ] Admin dashboard

---

## 📚 API Reference

### Authentication Functions
```typescript
// lib/auth-context.tsx
signUp(email, password) → Promise<UserCredential>
signIn(email, password) → Promise<UserCredential>
signOut() → Promise<void>
```

### Firestore Functions
```typescript
// lib/firestore.ts
getAllJobs() → Promise<Job[]>
getJobById(jobId) → Promise<Job>
searchJobs(query) → Promise<Job[]>
createJob(jobData) → Promise<string>
updateJob(jobId, updates) → Promise<void>
deleteJobById(jobId) → Promise<void>

// lib/favorites.ts
addFavorite(userId, jobId) → Promise<void>
removeFavorite(userId, jobId) → Promise<void>
getUserFavorites(userId) → Promise<string[]>
isFavorited(userId, jobId) → Promise<boolean>
postJob(userId, jobData) → Promise<string>
getUserPostedJobs(userId) → Promise<Job[]>
```

---

**Last Updated**: Feb 20, 2026  
**Status**: ✅ Fully Functional  
**Version**: 1.0.0
