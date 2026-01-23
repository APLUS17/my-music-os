# Vercel Deployment Configuration

This plan outlines the steps and configuration required to deploy "My Music OS" (Antigravity Vibecode 01) to Vercel.

## 1. Environment Variables
The following keys must be configured in the Vercel Dashboard (Settings > Environment Variables):

| Key | Value Source | Visibility |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` | Public |
| `OPENAI_API_KEY` | User Provided | Secret |
| `NEXT_PUBLIC_APP_URL` | Vercel Deployment URL | Public |

## 2. Build Settings
Vercel's default settings for Next.js 14+ will work, but ensure the following is set:
- **Framework Preset**: `Next.js`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## 3. Production Readiness Checklist
Before triggering the deployment:
- [ ] Ensure all API routes use the correct environment variables.
- [ ] Verify Supabase RLS policies allow the production URL.
- [ ] Run `npm run build` locally to catch any build-time errors.
- [ ] Update `NEXT_PUBLIC_APP_URL` in Vercel once the domain is assigned.

## 4. Post-Deployment (Scheduled for tomorrow)
- [ ] End-to-End Functionality Testing.
- [ ] Security Audit (RLS & API keys).
- [ ] Technical Documentation handover.
