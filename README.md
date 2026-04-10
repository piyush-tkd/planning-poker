# PointIt — Planning Poker for Modern Teams

PointIt is a real-time, collaborative planning poker application built for agile teams. Run efficient estimation sessions with your team, leverage real-time voting and reveal mechanics, and track estimation patterns across projects. Perfect for distributed teams who need a fast, intuitive estimation tool.

**Live Demo:** https://pointit.vercel.app  
**GitHub:** https://github.com/piyush-tkd/planning-poker

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, React 18
- **Styling**: Tailwind CSS, shadcn/ui components, Lucide React icons
- **State Management**: Zustand
- **Backend/Database**: Supabase (PostgreSQL with Row-Level Security, Real-time subscriptions)
- **Authentication**: Supabase Auth with Google OAuth
- **Deployment**: Vercel
- **Stripe Integration**: Payment processing for Pro & Enterprise tiers

---

## Project Structure

```
pointit/
├── public/                      # Static assets
├── src/
│   ├── app/
│   │   ├── (auth)/             # Auth group: login, signup, OAuth callback
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── select-plan/
│   │   │   └── callback/
│   │   ├── (app)/              # Protected routes group (requires auth)
│   │   │   ├── dashboard/      # Main dashboard
│   │   │   ├── teams/          # Team management
│   │   │   ├── session/        # Planning poker session
│   │   │   ├── settings/       # Settings (billing, members, org)
│   │   │   ├── analytics/      # Analytics & insights
│   │   │   ├── audit-log/      # Activity logs
│   │   │   └── profile/        # User profile
│   │   ├── join/               # Public join endpoint ([code])
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── auth/               # Auth-related components
│   │   ├── dashboard/          # Dashboard components
│   │   ├── teams/              # Team management components
│   │   ├── session/            # Poker session components
│   │   ├── analytics/          # Analytics components
│   │   ├── settings/           # Settings components
│   │   ├── layout/             # Layout & navigation (sidebar, header)
│   │   ├── ui/                 # Reusable UI components (button, card, dialog, etc.)
│   │   └── landing/            # Landing page components
│   ├── lib/
│   │   ├── supabase/           # Supabase client initialization & utilities
│   │   └── utils.ts            # Common utilities
│   ├── store/
│   │   ├── auth-store.ts       # Zustand auth store
│   │   └── session-store.ts    # Zustand session store
│   ├── types/
│   │   └── database.ts         # Generated TypeScript types from Supabase
│   └── middleware.ts           # Next.js middleware (auth protection)
├── supabase/
│   └── schema.sql              # Database schema (tables, RLS, triggers)
├── .env.local                  # Local environment variables (not committed)
├── .eslintrc.json              # ESLint configuration
├── .gitignore                  # Git ignore rules
├── middleware.ts               # Auth middleware
├── next.config.mjs             # Next.js configuration
├── package.json                # Dependencies & scripts
├── postcss.config.mjs           # PostCSS configuration
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/piyush-tkd/planning-poker.git
cd pointit
npm install
```

### 2. Set Up Supabase

#### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up or log in
2. Click **New Project**
3. Enter project details:
   - **Name**: pointit (or your preferred name)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose closest to your location
4. Wait for the project to initialize (2-3 minutes)

#### Load the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open `supabase/schema.sql` and copy the entire contents
4. Paste into the SQL editor and click **Run**
5. Wait for all queries to complete successfully

#### Enable Google OAuth

1. In your Supabase project, go to **Authentication > Providers**
2. Find **Google** and click to expand
3. Set **Enabled** to ON
4. You'll need Google OAuth credentials (see [Google OAuth Setup](#google-oauth-setup) below)
5. After creating credentials in GCP, come back and paste:
   - **Client ID**
   - **Client Secret**
6. Add the redirect URL to your GCP OAuth consent screen (see step 3 of Google OAuth setup)

#### Get Your Credentials

In Supabase **Settings > API**, copy:
- **Project URL** (e.g., `https://edmetiwcbzduhtezchox.supabase.co`)
- **anon (public)** key

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory (never commit this):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://edmetiwcbzduhtezchox.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Stripe (for billing features)
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_SECRET_KEY=sk_test_...
```

Replace:
- `NEXT_PUBLIC_SUPABASE_URL` with your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your public anon key
- `NEXT_PUBLIC_APP_URL` with your app's URL (localhost in dev, production URL in prod)

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see the landing page.

---

## Google OAuth Setup

### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown and select **NEW PROJECT**
3. Name it "PointIt" and click **CREATE**
4. Wait for the project to initialize

### Enable the Google+ API

1. In the left sidebar, go to **APIs & Services > Library**
2. Search for "Google+ API"
3. Click the result and click **ENABLE**

### Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **CREATE CREDENTIALS > OAuth 2.0 Client ID**
3. If prompted to configure the OAuth consent screen first:
   - Select **External**
   - Click **CREATE**
   - Fill in app info (App name: "PointIt", Support email: your email)
   - Under **Scopes**, add `userinfo.email` and `userinfo.profile`
   - Under **Test users**, add your test email addresses
   - Click **SAVE AND CONTINUE** through all sections
4. Back to credentials, click **CREATE CREDENTIALS > OAuth 2.0 Client ID** again
5. Select **Web application**
6. Under **Authorized redirect URIs**, add:
   ```
   https://edmetiwcbzduhtezchox.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback  (for local dev)
   https://your-production-domain.com/auth/callback  (for production)
   ```
7. Click **CREATE**
8. Copy your **Client ID** and **Client Secret**

### Add Credentials to Supabase

1. In Supabase, go to **Authentication > Providers > Google**
2. Paste your **Client ID** and **Client Secret**
3. Click **Save**
4. You'll see your Supabase Redirect URL displayed—copy it
5. Go back to Google Cloud Console > **Credentials** > your OAuth app
6. Click the pencil icon to edit
7. Add this URL to **Authorized redirect URIs**:
   ```
   https://edmetiwcbzduhtezchox.supabase.co/auth/v1/callback
   ```
8. Click **SAVE**

---

## Database Schema

PointIt uses a multi-tenant architecture with the following core tables:

### Organizations
- **organizations**: Workspace/account with plan details (free, pro, enterprise)
- **org_members**: Users in an organization with roles (admin, scrum_master, member, observer)

### Teams & Sessions
- **teams**: Team within an organization with card deck configuration
- **team_members**: Team membership with roles
- **sessions**: Planning poker session with join code
- **votes**: Individual votes cast during a session

### Supporting Tables
- **audit_logs**: Activity log for compliance
- **feature_flags**: Dynamic feature toggles per organization

### Key Enums
- **plan_type**: `free`, `pro`, `enterprise`
- **org_member_role**: `admin`, `scrum_master`, `member`, `observer`
- **session_status**: `active`, `completed`, `cancelled`

All tables have Row-Level Security (RLS) enabled to ensure users can only access their organization's data.

For the complete schema, see `supabase/schema.sql`.

---

## Deploy to Vercel

### 1. Push to GitHub

Ensure your repository is up to date:

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New > Project**
3. Select your GitHub repo (`piyush-tkd/planning-poker`)
4. Click **Import**

### 3. Set Environment Variables

On the environment variables page, add:

```
NEXT_PUBLIC_SUPABASE_URL = https://edmetiwcbzduhtezchox.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
NEXT_PUBLIC_APP_URL = https://pointit.vercel.app  (your production domain)
```

If using Stripe for billing:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
STRIPE_SECRET_KEY = sk_live_...
```

### 4. Update Supabase & Google OAuth

#### Supabase Redirect URLs
1. In Supabase, go to **Authentication > Redirect URLs**
2. Add your Vercel domain:
   ```
   https://pointit.vercel.app/auth/callback
   ```

#### Google OAuth Credentials
1. In Google Cloud Console, edit your OAuth app credentials
2. Add to **Authorized redirect URIs**:
   ```
   https://pointit.vercel.app/auth/callback
   ```

### 5. Deploy

Click **Deploy** on Vercel. Your app will build and deploy automatically. After deployment, click **Visit** to see your live app.

---

## Features

### Core Features
- **Real-time Voting**: Live vote updates powered by Supabase Realtime
- **Multiple Card Decks**: Fibonacci, T-Shirt Sizes, and custom cards
- **Team Management**: Invite members, manage roles, and permissions
- **Session History**: Track all past sessions and voting patterns
- **Join by Code**: Simple one-click join links for participants

### Estimation
- **Blind Voting**: Hide votes until reveal
- **Moderation Tools**: Reopen voting, skip issues, clear votes
- **Cards Customization**: Define custom card values per team
- **Jira Integration Ready**: Import stories and sync estimates (Pro+)

### Analytics & Insights
- **Voting Statistics**: See patterns in team estimates
- **Estimation Velocity**: Track team estimation confidence
- **Participant Analytics**: Know who's estimating accurately

### Organization & Billing
- **Multi-team Organizations**: Scale from one team to hundreds
- **Role-based Access Control**: Admin, Scrum Master, Member, Observer roles
- **Audit Logs**: Track all member actions for compliance
- **Stripe Billing**: Manage subscriptions directly in-app

### Authentication
- **Google OAuth**: One-click sign-up with Google
- **Session Management**: Automatic logout, remember me, SSO-ready

---

## Roles & Permissions

### Admin
- Full access to organization settings
- Manage billing and subscriptions
- Add/remove members, manage roles
- Create and delete teams
- View all audit logs

### Scrum Master
- Create and manage planning poker sessions
- Moderate sessions (reveal votes, reopen voting, skip issues)
- Manage team members
- View team analytics
- Cannot change billing

### Member
- Participate in sessions (vote and see estimates)
- Create sessions (if permitted by Scrum Master)
- View team analytics
- Cannot manage members or settings

### Observer
- View-only access to sessions
- See votes and estimates
- Cannot vote or modify sessions

---

## Pricing Tiers

### Free
- **1 Team** per organization
- **10 Members** per team
- **100 Planning Poker sessions** per month
- Basic features (voting, teams, roles)
- Community support

### Pro
- **Unlimited Teams**
- **50 Members** per team
- **Unlimited Sessions**
- All Free features plus:
  - Custom card decks
  - Jira integration
  - Advanced analytics
  - Priority support
- **$12/month** or **$120/year**

### Enterprise
- Everything in Pro plus:
  - Unlimited members per team
  - Advanced security (SSO, audit logs)
  - Custom integrations
  - Dedicated support
  - SLA guarantee
- **Custom pricing** — Contact sales

---

## Development

### Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm lint
```

### Project Layout

- **App Router**: All routes in `src/app` using Next.js 14 conventions
- **Protected Routes**: `(app)` group routes require authentication via middleware
- **Public Routes**: Landing and auth routes in `(auth)` group
- **Components**: Reusable components organized by feature in `src/components`
- **State Management**: Zustand stores in `src/store` for auth and session state
- **UI Library**: shadcn/ui-style components in `src/components/ui`

### Adding New Features

1. **New Route**: Add folder in `src/app/(app)/feature-name`
2. **New Component**: Add to `src/components/feature-name`
3. **New Store**: Add to `src/store/feature-store.ts`
4. **New Database Table**: Add to `supabase/schema.sql`, then run in Supabase SQL Editor

### Supabase Real-time Subscriptions

Sessions use Supabase real-time to broadcast vote updates:

```typescript
const channel = supabase
  .channel(`session:${sessionId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, (payload) => {
    // Handle vote updates
  })
  .subscribe();
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key |
| `NEXT_PUBLIC_APP_URL` | Yes | App's public URL (for OAuth redirect) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Stripe public key (for billing) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (server-side only) |

---

## Troubleshooting

### "Invalid Login Credentials" Error
- Check that Google OAuth is enabled in Supabase
- Verify Client ID and Client Secret are correct in Supabase
- Ensure redirect URLs match exactly in Google Cloud Console and Supabase

### "Database Connection Failed"
- Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Check that Supabase project is running (not paused)
- Run `supabase/schema.sql` in Supabase SQL Editor

### "CORS Error" in Development
- Make sure `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`
- Restart the dev server after changing env vars

### Real-time Updates Not Working
- Verify Realtime is enabled in Supabase project settings
- Check that you're subscribed to the correct channel name
- Look for RLS policy issues (should allow your auth user)

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: See docs in this README
- **GitHub Issues**: Report bugs at [github.com/piyush-tkd/planning-poker/issues](https://github.com/piyush-tkd/planning-poker/issues)
- **Email**: contact@pointit.dev (Enterprise support)

---

**Built with ❤️ for agile teams. Happy estimating!**
