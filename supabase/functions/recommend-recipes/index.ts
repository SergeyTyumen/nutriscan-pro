import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching data for user:', user.id);

    // Получаем профиль пользователя с целями
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Получаем все приёмы пищи за сегодня
    const today = new Date().toISOString().split('T')[0];
    const { data: todayMeals } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .eq('meal_date', today);

    // Считаем что уже съедено сегодня
    const consumed = {
      calories: todayMeals?.reduce((sum, m) => sum + m.total_calories, 0) || 0,
      protein: todayMeals?.reduce((sum, m) => sum + Number(m.total_protein), 0) || 0,
      fat: todayMeals?.reduce((sum, m) => sum + Number(m.total_fat), 0) || 0,
      carbs: todayMeals?.reduce((sum, m) => sum + Number(m.total_carbs), 0) || 0,
    };

    // Считаем оставшийся бюджет
    const budget = {
      calories: (profile?.daily_calorie_goal || 2000) - consumed.calories,
      protein: (profile?.daily_protein_goal || 150) - consumed.protein,
      fat: (profile?.daily_fat_goal || 65) - consumed.fat,
      carbs: (profile?.daily_carbs_goal || 250) - consumed.carbs,
    };

    console.log('Daily budget:', budget);

    // Получаем сохранённые рецепты
    const { data: recipes } = await supabase
      .from('saved_recipes')
      .select('*')
      .eq('user_id', user.id);

    // Получаем историю за последние 7 дней для анализа
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: weekMeals } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .gte('meal_date', sevenDaysAgo.toISOString().split('T')[0]);

    // Получаем простые продукты из базы для рекомендаций
    const { data: foodDatabase } = await supabase
      .from('food_database')
      .select('*')
      .limit(50);

    if (!lovableApiKey) {
      console.log('No Lovable API key, returning fallback');
      return new Response(JSON.stringify({
        recommendations: [],
        simpleFoodSuggestions: [],
        coachMessage: 'ИИ-коуч временно недоступен. Показаны все ваши блюда.',
        budget,
        fallback: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Формируем промпт для ИИ
    const systemPrompt = `Ты — персональный диетолог-коуч. Анализируй данные пользователя и рекомендуй блюда.

ЦЕЛИ ПОЛЬЗОВАТЕЛЯ:
- Калории: ${profile?.daily_calorie_goal || 2000} ккал/день
- Белки: ${profile?.daily_protein_goal || 150} г/день
- Жиры: ${profile?.daily_fat_goal || 65} г/день
- Углеводы: ${profile?.daily_carbs_goal || 250} г/день

СЪЕДЕНО СЕГОДНЯ:
- Калории: ${consumed.calories} ккал
- Белки: ${consumed.protein} г
- Жиры: ${consumed.fat} г
- Углеводы: ${consumed.carbs} г

ОСТАВШИЙСЯ БЮДЖЕТ:
- Калории: ${budget.calories} ккал
- Белки: ${budget.protein} г
- Жиры: ${budget.fat} г
- Углеводы: ${budget.carbs} г

СОХРАНЁННЫЕ БЛЮДА:
${recipes?.map(r => `- "${r.recipe_name}": ${r.total_calories} ккал (Б: ${r.total_protein}г, Ж: ${r.total_fat}г, У: ${r.total_carbs}г)`).join('\n') || 'Нет сохранённых блюд'}

ПРОСТЫЕ ПРОДУКТЫ ИЗ БАЗЫ (для рекомендаций если блюда не подходят):
${foodDatabase?.slice(0, 20).map(f => `- ${f.name}: ${f.calories_per_100g} ккал на 100г (Б: ${f.protein_per_100g}г, Ж: ${f.fat_per_100g}г, У: ${f.carbs_per_100g}г)`).join('\n')}

ЗАДАЧА:
1. Проанализируй каждое сохранённое блюдо:
   - Если ВПИСЫВАЕТСЯ в бюджет (±10%) → status: "perfect"
   - Если НЕМНОГО ПРЕВЫШАЕТ (10-40%) → status: "partial" + предложи уменьшенную порцию
   - Если СИЛЬНО ПРЕВЫШАЕТ (>40%) → НЕ ВКЛЮЧАЙ в рекомендации

2. Если НИ ОДНО блюдо не подходит, предложи 3-5 простых продуктов из базы данных

3. Дай короткое дружеское сообщение (1-2 предложения)

ВАЖНО: Возвращай ТОЛЬКО JSON без дополнительного текста.`;

    const userPrompt = `Проанализируй и верни рекомендации в формате JSON:

{
  "recommendations": [
    {
      "recipeId": "uuid блюда",
      "name": "Название",
      "status": "perfect" или "partial",
      "reason": "Короткая причина",
      "suggestedPortion": 1.0 или 0.5 для половины,
      "calories": число,
      "priority": 1
    }
  ],
  "simpleFoodSuggestions": [
    {
      "name": "Название продукта",
      "quantity": 150,
      "unit": "г",
      "calories": число,
      "protein": число,
      "fat": число,
      "carbs": число,
      "reason": "Почему подходит"
    }
  ],
  "coachMessage": "Дружеское сообщение",
  "budget": {
    "calories": ${budget.calories},
    "protein": ${budget.protein},
    "fat": ${budget.fat},
    "carbs": ${budget.carbs}
  }
}`;

    console.log('Calling Lovable AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Превышен лимит запросов. Попробуйте позже.',
          fallback: true,
          recommendations: [],
          simpleFoodSuggestions: [],
          coachMessage: 'ИИ-коуч временно недоступен из-за лимита запросов.',
          budget,
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    console.log('AI Response:', aiContent);

    if (!aiContent) {
      throw new Error('No content from AI');
    }

    // Парсим JSON из ответа ИИ
    let result;
    try {
      // Убираем markdown code blocks если есть
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('AI content:', aiContent);
      
      return new Response(JSON.stringify({
        error: 'Ошибка парсинга ответа ИИ',
        fallback: true,
        recommendations: [],
        simpleFoodSuggestions: [],
        coachMessage: 'ИИ-коуч временно недоступен.',
        budget,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in recommend-recipes:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      fallback: true,
      recommendations: [],
      simpleFoodSuggestions: [],
      coachMessage: 'Произошла ошибка при анализе.',
      budget: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});