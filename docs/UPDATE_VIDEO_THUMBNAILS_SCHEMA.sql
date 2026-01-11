-- Update video_thumbnails to store metadata instead of just URLs
-- New structure: {"video_url": {"url": "thumbnail_url", "width": 640, "height": 480, "type": "image/jpeg"}}

-- Note: Existing data will remain compatible (strings are still valid)
-- New structure allows for metadata storage

-- Example structure:
-- {
--   "https://instagram.com/p/ABC123/": {
--     "url": "https://cdn.instagram.com/...",
--     "width": 640,
--     "height": 640,
--     "type": "image/jpeg"
--   }
-- }

-- No migration needed - JSONB is flexible and can store both strings and objects
