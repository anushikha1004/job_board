# Post-Deploy Checklist

Run this checklist immediately after each production deploy.

## Application Health
- [ ] Open home page and verify it loads without console errors
- [ ] Open `/health` and verify checks pass
- [ ] Confirm no major error spikes in logs/monitoring

## Authentication and Roles
- [ ] Candidate login works and redirects to `/candidate`
- [ ] Recruiter login works and redirects to `/company`
- [ ] Admin user can access `/admin`
- [ ] Logout works for all roles

## Core Product Flows
- [ ] Recruiter can create a draft job and publish it
- [ ] Candidate can browse jobs, open job detail, and apply
- [ ] Applied state is correct on cards and job detail
- [ ] Candidate can save and unsave jobs
- [ ] Recruiter can view applicant pipeline updates

## Resume and Storage
- [ ] Candidate can upload a resume
- [ ] Resume download/view link works
- [ ] Replace and delete resume actions work

## Notifications
- [ ] New application creates recruiter notification
- [ ] Notification badge count updates correctly
- [ ] Opening a notification marks it as read

## Security and Config
- [ ] Firebase auth domain includes production domain
- [ ] Firestore rules are deployed and active
- [ ] Required environment variables are present in host

## UX and Performance
- [ ] Main pages are responsive on mobile and desktop
- [ ] Search and filters return expected results
- [ ] No layout breaks on candidate/company/admin pages

## Final Sign-Off
- [ ] Record deploy version (commit SHA / tag)
- [ ] Record deploy time and owner
- [ ] Mark release status: `healthy` or `rollback needed`
