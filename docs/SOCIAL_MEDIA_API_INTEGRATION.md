# Social Media API Integration - Σχέδιο Υλοποίησης

## Επισκόπηση

Αυτοματοποιημένη συλλογή στατιστικών από τα social media accounts των influencers (Instagram, TikTok, YouTube, Facebook) για:
- ✅ Αυτόματη επικύρωση followers
- ✅ Υπολογισμός engagement rate
- ✅ Real-time στατιστικά
- ✅ Ανίχνευση fake followers
- ✅ Ενημέρωση τιμών με βάση τα πραγματικά δεδομένα

---

## Αρχιτεκτονική Λύσης

### 1. OAuth Flow για Σύνδεση Social Accounts

```
Influencer → Clicks "Connect Instagram" → OAuth Redirect → 
Platform Auth → Callback → Save Access Token → Fetch Stats
```

### 2. Data Flow

```
Social Media Platform API
    ↓
Next.js API Routes (/api/social/connect, /api/social/sync)
    ↓
Supabase Database (social_connections table)
    ↓
Background Jobs (cron/scheduled)
    ↓
Auto-update influencers table
```

---

## Database Schema

### Νέα Table: `social_connections`

```sql
CREATE TABLE social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'instagram', 'tiktok', 'youtube', 'facebook'
  username TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted
  refresh_token TEXT, -- For platforms that support it
  token_expires_at TIMESTAMPTZ,
  platform_user_id TEXT, -- Platform's internal user ID
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(influencer_id, platform)
);

-- Index για γρήγορη αναζήτηση
CREATE INDEX idx_social_connections_influencer ON social_connections(influencer_id);
CREATE INDEX idx_social_connections_platform ON social_connections(platform);
```

### Νέα Table: `social_stats_snapshots`

```sql
CREATE TABLE social_stats_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  followers_count INTEGER,
  following_count INTEGER,
  posts_count INTEGER,
  engagement_rate DECIMAL(5,2), -- e.g., 5.25%
  avg_likes INTEGER,
  avg_comments INTEGER,
  avg_views INTEGER, -- For YouTube/TikTok
  audience_gender_male INTEGER DEFAULT 0,
  audience_gender_female INTEGER DEFAULT 0,
  audience_top_age_range TEXT, -- e.g., "18-24"
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, snapshot_date)
);

CREATE INDEX idx_snapshots_date ON social_stats_snapshots(snapshot_date);
CREATE INDEX idx_snapshots_connection ON social_stats_snapshots(connection_id);
```

### Ενημέρωση `influencers` Table

```sql
-- Προσθήκη columns για auto-synced data
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS auto_synced_at TIMESTAMPTZ;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS last_sync_platform TEXT;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT false;
```

---

## Platform APIs - Requirements & Setup

### 1. Instagram Graph API

**Requirements:**
- Instagram Business ή Creator Account
- Facebook Page connected
- Facebook App με Instagram permissions

**Setup:**
1. Δημιουργία Facebook App στο [developers.facebook.com](https://developers.facebook.com)
2. Προσθήκη Instagram Graph API product
3. Request permissions: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`
4. OAuth Redirect URI: `https://yourdomain.com/api/social/instagram/callback`

**Endpoints:**
- `GET /{ig-user-id}` - Basic user info
- `GET /{ig-user-id}/insights` - Engagement metrics
- `GET /{ig-user-id}/media` - Posts data

**Rate Limits:**
- 200 requests/hour per user

**Pricing:** Free

---

### 2. TikTok Business API

**Requirements:**
- TikTok Business Account
- TikTok for Business Developer Account

**Setup:**
1. Εγγραφή στο [developers.tiktok.com](https://developers.tiktok.com)
2. Δημιουργία App
3. Request scopes: `user.info.basic`, `video.list`, `video.insights.basic`
4. OAuth Redirect URI: `https://yourdomain.com/api/social/tiktok/callback`

**Endpoints:**
- `GET /user/info/` - User info & followers
- `GET /video/list/` - Video metrics
- `GET /video/query/` - Video insights

**Rate Limits:**
- Varies by plan (Free tier: Limited)

**Pricing:** Free tier available, paid plans for higher limits

---

### 3. YouTube Data API v3

**Requirements:**
- Google Cloud Project
- YouTube Data API enabled

**Setup:**
1. Google Cloud Console → Enable YouTube Data API v3
2. Create OAuth 2.0 credentials
3. Request scopes: `https://www.googleapis.com/auth/youtube.readonly`
4. OAuth Redirect URI: `https://yourdomain.com/api/social/youtube/callback`

**Endpoints:**
- `GET /channels` - Channel stats (subscribers, views)
- `GET /playlistItems` - Video data
- Analytics API for detailed metrics (requires separate setup)

**Rate Limits:**
- 10,000 units/day (free quota)
- 1 unit per request typically

**Pricing:** Free (with daily quota)

---

### 4. Facebook Graph API

**Requirements:**
- Facebook Page
- Facebook App

**Setup:**
1. Similar to Instagram (same platform)
2. Permissions: `pages_read_engagement`, `pages_show_list`
3. OAuth Redirect URI: `https://yourdomain.com/api/social/facebook/callback`

**Endpoints:**
- `GET /{page-id}` - Page stats
- `GET /{page-id}/insights` - Detailed metrics

---

## Implementation Phases

### Phase 1: Infrastructure Setup (Week 1)

**Tasks:**
1. ✅ Create database tables (`social_connections`, `social_stats_snapshots`)
2. ✅ Setup environment variables for API credentials
3. ✅ Install required npm packages
4. ✅ Create base API route structure

**Environment Variables:**
```env
# Instagram/Facebook
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_REDIRECT_URI=https://yourdomain.com/api/social/instagram/callback

# TikTok
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_REDIRECT_URI=https://yourdomain.com/api/social/tiktok/callback

# YouTube
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=https://yourdomain.com/api/social/youtube/callback

# Encryption key for tokens
ENCRYPTION_KEY=your_32_char_encryption_key
```

**NPM Packages:**
```json
{
  "axios": "^1.6.0",
  "crypto": "built-in",
  "node-cron": "^3.0.3",
  "simple-oauth2": "^5.0.0"
}
```

---

### Phase 2: OAuth Implementation (Week 2)

**API Routes to Create:**

1. **`app/api/social/[platform]/connect/route.ts`**
   - Initiates OAuth flow
   - Redirects to platform login

2. **`app/api/social/[platform]/callback/route.ts`**
   - Handles OAuth callback
   - Exchanges code for access token
   - Saves to `social_connections` table
   - Initial stats fetch

3. **`app/api/social/disconnect/route.ts`**
   - Removes connection
   - Revokes tokens

**Security:**
- Encrypt access tokens before storing (use `crypto` module)
- Store refresh tokens securely
- Implement token refresh logic

---

### Phase 3: Stats Fetching (Week 3)

**API Routes:**

1. **`app/api/social/sync/route.ts`**
   - Fetches latest stats from all platforms
   - Updates `social_stats_snapshots`
   - Updates `influencers` table with latest data

2. **`app/api/social/stats/[influencerId]/route.ts`**
   - Returns current stats for an influencer
   - Can include historical data

**Functions to Implement:**

```typescript
// lib/social/instagram.ts
export async function fetchInstagramStats(accessToken: string, userId: string) {
  // Fetch followers, engagement rate, etc.
}

// lib/social/tiktok.ts
export async function fetchTikTokStats(accessToken: string, userId: string) {
  // Fetch followers, views, engagement
}

// lib/social/youtube.ts
export async function fetchYouTubeStats(accessToken: string, channelId: string) {
  // Fetch subscribers, views, etc.
}
```

---

### Phase 4: Background Jobs (Week 4)

**Cron Jobs Setup:**

```typescript
// lib/cron/syncSocialStats.ts
import cron from 'node-cron';

// Run every 6 hours
cron.schedule('0 */6 * * *', async () => {
  await syncAllActiveConnections();
});

// Run daily at 2 AM for detailed analytics
cron.schedule('0 2 * * *', async () => {
  await generateDailySnapshots();
});
```

**Jobs:**
1. **Auto-sync active connections** (every 6 hours)
2. **Token refresh** (before expiration)
3. **Daily snapshots** (for historical tracking)
4. **Cleanup expired tokens**

---

### Phase 5: UI Components (Week 5)

**Dashboard Components:**

1. **`components/SocialConnectButton.tsx`**
   ```tsx
   - "Connect Instagram" button
   - Shows connection status
   - Disconnect option
   ```

2. **`components/SocialStatsDisplay.tsx`**
   ```tsx
   - Real-time stats display
   - Last sync timestamp
   - Manual refresh button
   ```

3. **`components/SyncStatusBadge.tsx`**
   ```tsx
   - Green: Synced recently
   - Yellow: Synced > 24h ago
   - Red: Never synced or error
   ```

**Pages:**
- Update `components/DashboardContent.tsx` to show connection options
- Add sync status indicators in profile pages

---

### Phase 6: Auto-Update Logic (Week 6)

**Automatic Updates:**

1. **Followers Count** → Auto-update `followers` object in `influencers.accounts`
2. **Engagement Rate** → Auto-calculate and update `engagement_rate`
3. **Avg Likes/Comments** → Update `avg_likes`
4. **Verification Boost** → Auto-verify if stats match reported numbers

**Logic:**
```typescript
// lib/social/updateInfluencer.ts
export async function updateInfluencerFromSocialStats(influencerId: string) {
  // 1. Get latest snapshot
  // 2. Compare with current data
  // 3. Update if significant change (>10%)
  // 4. Log changes for audit
}
```

---

## Security Considerations

1. **Token Encryption:**
   ```typescript
   import crypto from 'crypto';
   
   const algorithm = 'aes-256-gcm';
   const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
   
   function encryptToken(token: string): string {
     // Implementation
   }
   
   function decryptToken(encrypted: string): string {
     // Implementation
   }
   ```

2. **Rate Limiting:**
   - Implement rate limits per user
   - Use queue system for bulk syncs

3. **Error Handling:**
   - Graceful degradation if API fails
   - Fallback to manual input
   - Notify admin of API issues

4. **Privacy:**
   - Store minimal data
   - Allow users to disconnect anytime
   - GDPR compliance (right to deletion)

---

## Cost Estimation

### API Costs:
- **Instagram/Facebook:** Free
- **TikTok:** Free tier (limited), Paid plans from $99/month
- **YouTube:** Free (10,000 units/day)
- **Server:** Minimal (background jobs run on existing server)

### Estimated Monthly Cost:
- **Free Tier:** $0-50 (basic usage)
- **Production:** $50-200 (higher limits, better reliability)

---

## Testing Strategy

1. **Unit Tests:**
   - Token encryption/decryption
   - API response parsing
   - Stats calculation logic

2. **Integration Tests:**
   - OAuth flows
   - API calls (with mock responses)
   - Database updates

3. **E2E Tests:**
   - Complete connection flow
   - Stats sync process
   - UI updates

---

## Migration Plan

### For Existing Influencers:

1. **Phase 1:** Optional connection (opt-in)
2. **Phase 2:** Encourage connection with benefits:
   - "Auto-verified" badge
   - Real-time stats display
   - Better brand visibility
3. **Phase 3:** Eventually make it mandatory for new signups

---

## Success Metrics

- **Adoption Rate:** % of influencers connecting accounts
- **Sync Success Rate:** % of successful syncs
- **Data Accuracy:** Reduction in manual edits
- **User Satisfaction:** Feedback on automation

---

## Rollout Plan

1. **Beta:** 10-20 influencers (Week 7)
2. **Soft Launch:** All influencers (Week 8)
3. **Full Launch:** With marketing push (Week 9)
4. **Optimization:** Based on feedback (Week 10+)

---

## Future Enhancements

- 📊 Historical charts (follower growth over time)
- 🤖 AI-powered fake follower detection
- 📈 Performance predictions
- 🎯 Audience insights dashboard
- 🔔 Notifications for significant changes

---

## Resources & Documentation

- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [TikTok for Developers](https://developers.tiktok.com)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)

---

## Notes

⚠️ **Important:**
- Each platform has different approval processes
- Some APIs require business verification
- Rate limits vary and need monitoring
- Token refresh logic is critical for long-term operation

✅ **Recommendation:**
- Start with Instagram (most common platform)
- Add YouTube second (easier API)
- TikTok last (most complex setup)


