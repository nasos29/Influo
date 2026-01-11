import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Language mapping - matches the LANGUAGES array in components
const LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" }
];

// Function to parse and convert language strings to standardized format
function parseAndConvertLanguages(langString: string | null): string {
  if (!langString) return "";
  
  const langArray = langString.split(',').map(l => l.trim());
  const convertedLanguages: string[] = [];
  
  langArray.forEach(lang => {
    const normalizedLang = lang.toLowerCase().trim();
    
    // Try to find exact match by code
    let foundLang = LANGUAGES.find(l => l.code === normalizedLang);
    
    // Try to find by Greek name
    if (!foundLang) {
      foundLang = LANGUAGES.find(l => 
        l.el.toLowerCase() === normalizedLang ||
        l.el.toLowerCase().includes(normalizedLang) ||
        normalizedLang.includes(l.el.toLowerCase())
      );
    }
    
    // Try to find by English name
    if (!foundLang) {
      foundLang = LANGUAGES.find(l => 
        l.en.toLowerCase() === normalizedLang ||
        l.en.toLowerCase().includes(normalizedLang) ||
        normalizedLang.includes(l.en.toLowerCase())
      );
    }
    
    // If found, use Greek name; otherwise keep original (for manual review)
    if (foundLang) {
      convertedLanguages.push(foundLang.el);
    } else {
      // Keep original if no match found (might need manual review)
      convertedLanguages.push(lang.trim());
    }
  });
  
  // Remove duplicates
  const uniqueLanguages = Array.from(new Set(convertedLanguages));
  return uniqueLanguages.join(", ");
}

export async function POST(request: Request) {
  try {
    // Fetch all influencers with languages
    const { data: influencers, error } = await supabase
      .from('influencers')
      .select('id, display_name, languages')
      .not('languages', 'is', null);
    
    if (error) {
      console.error('Error fetching influencers:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    if (!influencers || influencers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No influencers with languages found',
        updated: 0
      });
    }
    
    const updates: Array<{ id: string; oldLanguages: string | null; newLanguages: string }> = [];
    
    // Process each influencer
    for (const influencer of influencers) {
      const oldLanguages = influencer.languages;
      const newLanguages = parseAndConvertLanguages(oldLanguages);
      
      if (newLanguages !== oldLanguages) {
        updates.push({
          id: influencer.id,
          oldLanguages: oldLanguages,
          newLanguages: newLanguages
        });
      }
    }
    
    // Apply updates
    let updatedCount = 0;
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('influencers')
        .update({ languages: update.newLanguages })
        .eq('id', update.id);
      
      if (updateError) {
        console.error(`Error updating influencer ${update.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Migration completed`,
      total: influencers.length,
      updated: updatedCount,
      updates: updates.slice(0, 10) // Return first 10 for review
    });
    
  } catch (err: any) {
    console.error('Migration error:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
