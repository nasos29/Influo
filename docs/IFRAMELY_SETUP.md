# Iframely API Setup

## API Key Configuration

Πρόσθεσε το Iframely API key στο `.env.local`:

```env
IFRAMELY_API_KEY=4355c593a3b2439820d35f
```

## API Key Details

- **Server API key**: `4355c593a3b2439820d35f`
- **Client key hash**: `818191d61c6bc0d2f80e8bc246041377` (για browser use)
- **Usage**: Server-side API calls για Instagram thumbnail fetching

## How It Works

Το `/api/video-thumbnail` endpoint:
1. Προσπαθεί πρώτα με Iframely API (χρησιμοποιώντας το API key)
2. Αν αποτύχει, προσπαθεί με Instagram oEmbed API
3. Αν αποτύχει, προσπαθεί να πάρει og:image από HTML
4. Αν όλα αποτύχουν, επιστρέφει null (frontend shows placeholder)

## Testing

Δοκίμασε ένα Instagram post URL:
```
GET /api/video-thumbnail?url=https://www.instagram.com/p/DO5vVgLDIYI/
```

## Documentation

- Iframely API: https://iframely.com/docs/api
- Rate Limits: Check your Iframely dashboard

