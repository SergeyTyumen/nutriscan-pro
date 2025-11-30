import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { imageUrl } = await req.json();
    console.log('Analyzing image:', imageUrl);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по питанию. Проанализируй фото еды и верни ТОЛЬКО JSON в таком формате:
{
  "foods": [
    {
      "name": "название продукта на русском",
      "quantity": число,
      "unit": "г/мл/шт",
      "calories": число,
      "protein": число,
      "fat": число,
      "carbs": число
    }
  ],
  "totalCalories": число,
  "totalProtein": число,
  "totalFat": число,
  "totalCarbs": число,
  "mealType": "завтрак/обед/ужин/перекус",
  "notes": "краткое описание блюда"
}

Будь точным в оценке порций и калорий. Если видишь несколько продуктов, перечисли все.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Проанализируй это блюдо и верни данные в формате JSON'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log('GPT response:', content);

    // Парсим JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from GPT response');
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log('Parsed result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-food function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});