# Social Media API Integration - Quick Start Guide

## TL;DR - Τι χρειάζεται

### Γρήγορη Επισκόπηση:

1. **Ο Influencer** → Πατάει "Connect Instagram" → Συνδέεται με OAuth
2. **Το σύστημα** → Αποθηκεύει access token (encrypted)
3. **Background Job** → Τραβάει stats κάθε 6 ώρες
4. **Auto-update** → Ενημερώνει followers, engagement rate, κτλ.

---

## Quick Implementation Checklist

### Step 1: Database Setup (30 min)

```sql
-- Run these in Supabase SQL Editor

-- 1. Create social_connections table
CREATE TABLE social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook')),
  username TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  platform_user_id TEXT,
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(influencer_id, platform)
);

-- 2. Create snapshots table
CREATE TABLE social_stats_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  followers_count INTEGER,
  engagement_rate DECIMAL(5,2),
  avg_likes INTEGER,
  avg_comments INTEGER,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, snapshot_date)
);

-- 3. Update influencers table
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT false;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS last_sync_platform TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS auto_synced_at TIMESTAMPTZ;
```

---

### Step 2: Install Packages (5 min)

```bash
npm install axios simple-oauth2 node-cron
npm install -D @types/node-cron
```

---

### Step 3: Environment Variables

Προσθήκη στο `.env.local`:

```env
# Instagram/Facebook
INSTAGRAM_APP_ID=your_facebook_app_id
INSTAGRAM_APP_SECRET=your_facebook_app_secret
INSTAGRAM_REDIRECT_URI=http://localhost:3000/api/social/instagram/callback

# YouTube
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/social/youtube/callback

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_64_character_hex_key
```

---

### Step 4: Create Base API Structure

**File: `lib/social/encryption.ts`**
```typescript
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**File: `lib/social/instagram.ts`**
```typescript
import axios from 'axios';

export async function fetchInstagramStats(accessToken: string, userId: string) {
  try {
    // Get basic info
    const userInfo = await axios.get(
      `https://graph.instagram.com/${userId}?fields=username,account_type&access_token=${accessToken}`
    );
    
    // Get insights (requires business/creator account)
    const insights = await axios.get(
      `https://graph.instagram.com/${userId}/insights?metric=followers_count,engagement&access_token=${accessToken}`
    );
    
    return {
      username: userInfo.data.username,
      followers: insights.data.data.find((m: any) => m.name === 'followers_count')?.values[0]?.value,
      engagement: insights.data.data.find((m: any) => m.name === 'engagement')?.value,
    };
  } catch (error) {
    console.error('Instagram API Error:', error);
    throw error;
  }
}
```

---

### Step 5: OAuth Connect Route

**File: `app/api/social/instagram/connect/route.ts`**
```typescript
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const influencerId = searchParams.get('influencerId');
  
  if (!influencerId) {
    return NextResponse.json({ error: 'Missing influencerId' }, { status: 400 });
  }
  
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;
  const appId = process.env.INSTAGRAM_APP_ID!;
  
  // Instagram OAuth URL
  const authUrl = `https://api.instagram.com/oauth/authorize?` +
    `client_id=${appId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=user_profile,user_media&` +
    `response_type=code&` +
    `state=${influencerId}`;
  
  return NextResponse.redirect(authUrl);
}
```

---

### Step 6: OAuth Callback

**File: `app/api/social/instagram/callback/route.ts`**
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import axios from 'axios';
import { encryptToken } from '@/lib/social/encryption';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // influencerId
  
  if (!code || !state) {
    return NextResponse.redirect('/dashboard?error=oauth_failed');
  }
  
  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      {
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
        code,
      }
    );
    
    const { access_token, user_id } = tokenResponse.data;
    
    // Save to database
    const supabase = await createClient();
    const encryptedToken = encryptToken(access_token);
    
    await supabase.from('social_connections').upsert({
      influencer_id: state,
      platform: 'instagram',
      username: user_id, // Will update with actual username after first fetch
      access_token: encryptedToken,
      platform_user_id: user_id,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    });
    
    return NextResponse.redirect('/dashboard?connected=instagram');
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect('/dashboard?error=connection_failed');
  }
}
```

---

### Step 7: Sync Function

**File: `app/api/social/sync/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { decryptToken } from '@/lib/social/encryption';
import { fetchInstagramStats } from '@/lib/social/instagram';

export async function POST(request: NextRequest) {
  try {
    const { influencerId } = await request.json();
    const supabase = await createClient();
    
    // Get active connections
    const { data: connections } = await supabase
      .from('social_connections')
      .select('*')
      .eq('influencer_id', influencerId)
      .eq('is_active', true);
    
    if (!connections || connections.length === 0) {
      return NextResponse.json({ error: 'No active connections' }, { status: 400 });
    }
    
    // Sync each connection
    for (const connection of connections) {
      const accessToken = decryptToken(connection.access_token);
      
      if (connection.platform === 'instagram') {
        const stats = await fetchInstagramStats(accessToken, connection.platform_user_id);
        
        // Update snapshot
        await supabase.from('social_stats_snapshots').insert({
          connection_id: connection.id,
          platform: 'instagram',
          followers_count: stats.followers,
          engagement_rate: stats.engagement,
          snapshot_date: new Date().toISOString().split('T')[0],
        });
        
        // Update influencer data
        await supabase
          .from('influencers')
          .update({
            auto_synced_at: new Date().toISOString(),
            last_sync_platform: 'instagram',
          })
          .eq('id', influencerId);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

---

### Step 8: UI Component

**File: `components/SocialConnectButton.tsx`**
```tsx
'use client';

import { useState } from 'react';

export default function SocialConnectButton({ platform, influencerId }: { platform: string, influencerId: string }) {
  const [loading, setLoading] = useState(false);
  
  const handleConnect = () => {
    setLoading(true);
    window.location.href = `/api/social/${platform}/connect?influencerId=${influencerId}`;
  };
  
  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
    >
      {loading ? 'Connecting...' : `Connect ${platform}`}
    </button>
  );
}
```

---

## Next Steps

1. ✅ Test OAuth flow locally
2. ✅ Setup production credentials
3. ✅ Implement background sync job
4. ✅ Add UI to dashboard
5. ✅ Test with real accounts
6. ✅ Deploy to production

---

## Common Issues & Solutions

**Issue:** "Invalid redirect URI"
- ✅ Make sure redirect URI matches exactly in Facebook/Google console

**Issue:** "Token expired"
- ✅ Implement refresh token logic
- ✅ Auto-refresh before expiration

**Issue:** "Rate limit exceeded"
- ✅ Add retry logic with exponential backoff
- ✅ Cache responses
- ✅ Queue sync jobs

---

## Support

For detailed implementation, see: `docs/SOCIAL_MEDIA_API_INTEGRATION.md`


