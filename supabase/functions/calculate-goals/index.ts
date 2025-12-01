import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { age, gender, height, currentWeight, targetWeight, activityLevel, goal } = await req.json();

    console.log('[calculate-goals] Request:', { age, gender, height, currentWeight, targetWeight, activityLevel, goal });

    // Validate inputs
    if (!age || !gender || !height || !currentWeight || !activityLevel || !goal) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Ты диетолог-эксперт. Рассчитай персональные цели по питанию на основе данных пользователя.

ВАЖНО: Отвечай ТОЛЬКО в формате JSON, без дополнительного текста.

Формат ответа:
{
  "dailyCalories": число,
  "protein": число,
  "fat": число,
  "carbs": число,
  "water": число,
  "explanation": "краткое объяснение расчётов (1-2 предложения)"
}

Учитывай:
- BMR (базовый метаболизм) и уровень активности
- Цель пользователя (похудение/набор/поддержание)
- Здоровое соотношение БЖУ
- Безопасный темп изменения веса (не более 0.5-1 кг в неделю для похудения)`;

    const userPrompt = `Пол: ${gender === 'male' ? 'мужской' : 'женский'}
Возраст: ${age} лет
Рост: ${height} см
Текущий вес: ${currentWeight} кг
${targetWeight ? `Целевой вес: ${targetWeight} кг` : ''}
Уровень активности: ${activityLevel}
Цель: ${goal}

Рассчитай персональные цели по питанию.`;

    console.log('[calculate-goals] Calling AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[calculate-goals] AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте позже.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Необходимо пополнить баланс AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('[calculate-goals] AI response:', aiResponse);

    const content = aiResponse.choices[0].message.content;
    const goals = JSON.parse(content);

    console.log('[calculate-goals] Parsed goals:', goals);

    return new Response(
      JSON.stringify(goals),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[calculate-goals] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
