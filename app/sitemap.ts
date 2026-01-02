import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

// Revalidate sitemap every day (24 hours)
export const revalidate = 86400

// Create Supabase client for server-side fetching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.influo.gr'
  const currentDate = new Date()
  
  // Static pages with priorities and change frequencies
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/directory`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/brands`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/for-brands`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for-influencers`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Fetch verified influencers from database
  let influencerPages: MetadataRoute.Sitemap = []
  try {
    const { data: influencers, error } = await supabase
      .from('influencers')
      .select('id, updated_at, created_at')
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(10000) // Limit to avoid too large sitemap

    if (error) {
      console.error('Sitemap: Error fetching influencers:', error.message)
    } else if (influencers && influencers.length > 0) {
      influencerPages = influencers.map((influencer) => ({
        url: `${baseUrl}/influencer/${influencer.id}`,
        lastModified: influencer.updated_at 
          ? new Date(influencer.updated_at) 
          : influencer.created_at 
            ? new Date(influencer.created_at) 
            : currentDate,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
      console.log(`Sitemap: Added ${influencerPages.length} influencer pages`)
    }
  } catch (error: any) {
    console.error('Sitemap: Exception fetching influencers:', error?.message || error)
    // Continue without influencer pages if there's an error
  }

  // Combine all pages
  const allPages = [...staticPages, ...influencerPages]
  console.log(`Sitemap: Returning ${allPages.length} total pages (${staticPages.length} static + ${influencerPages.length} dynamic)`)
  
  return allPages
}
