import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to create authenticated Supabase client
function getSupabaseClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, image, analyzeFood, userContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const authHeader = req.headers.get('Authorization');
    const supabase = getSupabaseClient(authHeader);
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Get user ID from context or JWT
    let userId = userContext?.userId || null;
    
    // Try to get from JWT if not in context
    if (!userId && authHeader) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      } catch (e) {
        console.log('Failed to get user from JWT, using context userId');
      }
    }
    
    console.log('User ID resolved:', userId ? 'yes' : 'no');

    // Build context string if available
    let contextString = '';
    if (userContext) {
      contextString = `\n\nТЕКУЩИЙ СТАТУС ПОЛЬЗОВАТЕЛЯ (сегодня):
- Калории: ${userContext.calories?.consumed || 0} / ${userContext.calories?.goal || 2000} ккал
- Белки: ${userContext.protein?.consumed || 0} / ${userContext.protein?.goal || 150} г
- Жиры: ${userContext.fat?.consumed || 0} / ${userContext.fat?.goal || 65} г
- Углеводы: ${userContext.carbs?.consumed || 0} / ${userContext.carbs?.goal || 250} г
- Вода: ${userContext.water?.consumed || 0} / ${userContext.water?.goal || 2000} мл
- Приёмов пищи: ${userContext.mealsCount || 0}

Используй эту информацию для ответов. Не нужен tool get_today_stats если спрашивают про сегодня.`;
    }

    const systemPrompt = `Ты - Вита, голосовой помощник по питанию. Помогаешь пользователю следить за питанием и здоровьем.${contextString}

ВАЖНО: Отвечай ОЧЕНЬ КРАТКО (1-3 коротких предложения). БЕЗ списков, БЕЗ звездочек, БЕЗ markdown форматирования. Только простой текст для озвучки.

ИНСТРУМЕНТЫ:
- add_meal: добавить еду в дневник
- add_water: добавить воду
- get_today_stats: статистика за сегодня (используй только если нет контекста выше)
- get_week_stats: статистика за неделю
- search_food: найти продукт в базе
- ask_clarification: уточнить если не хватает данных

Используй tools когда нужно выполнить действие.`;


    const messagesWithSystem = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // If there's an image, add it to the last user message
    if (image && messagesWithSystem[messagesWithSystem.length - 1]?.role === 'user') {
      const lastMessage = messagesWithSystem[messagesWithSystem.length - 1];
      messagesWithSystem[messagesWithSystem.length - 1] = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: lastMessage.content
          },
          {
            type: 'image_url',
            image_url: {
              url: image
            }
          }
        ]
      };
    }

    // Define tools for the AI
    const tools: any[] = [
      {
        type: "function",
        function: {
          name: "add_meal",
          description: "Добавить еду в дневник питания. Используй когда пользователь просит добавить продукт.",
          parameters: {
            type: "object",
            properties: {
              food_name: { type: "string", description: "Название продукта на русском" },
              quantity: { type: "number", description: "Количество в граммах" },
              meal_type: { type: "string", enum: ["завтрак", "обед", "ужин", "перекус"], description: "Тип приёма пищи" },
              calories: { type: "number", description: "Калории на указанное количество" },
              protein: { type: "number", description: "Белки в граммах" },
              fat: { type: "number", description: "Жиры в граммах" },
              carbs: { type: "number", description: "Углеводы в граммах" }
            },
            required: ["food_name", "quantity", "meal_type", "calories", "protein", "fat", "carbs"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_water",
          description: "Добавить воду в дневник. Используй когда пользователь просит добавить воду.",
          parameters: {
            type: "object",
            properties: {
              amount_ml: { type: "number", description: "Количество воды в миллилитрах (стакан = 250мл)" }
            },
            required: ["amount_ml"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_today_stats",
          description: "Получить статистику питания за сегодня (калории, БЖУ, вода).",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_week_stats",
          description: "Получить статистику питания за последние 7 дней.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "search_food",
          description: "Найти продукт в базе данных для получения пищевой ценности.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Название продукта для поиска" }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "ask_clarification",
          description: "Задать уточняющий вопрос пользователю, если не хватает информации.",
          parameters: {
            type: "object",
            properties: {
              question: { type: "string", description: "Вопрос для пользователя" }
            },
            required: ["question"]
          }
        }
      }
    ];

    // If analyzing food, add the analyze tool
    if (analyzeFood && image) {
      tools.push({
        type: "function",
        function: {
          name: "analyze_food_items",
          description: "Извлечь структурированную информацию о продуктах на фото с калориями и БЖУ",
          parameters: {
            type: "object",
            properties: {
              foods: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Название продукта на русском" },
                    quantity: { type: "number", description: "Количество в граммах" },
                    calories: { type: "number", description: "Калории" },
                    protein: { type: "number", description: "Белки в граммах" },
                    fat: { type: "number", description: "Жиры в граммах" },
                    carbs: { type: "number", description: "Углеводы в граммах" }
                  },
                  required: ["name", "quantity", "calories", "protein", "fat", "carbs"]
                }
              },
              description: { type: "string", description: "Краткое описание блюда" }
            },
            required: ["foods", "description"]
          }
        }
      });
    }

    // Build request body
    const requestBody: any = {
      model: 'google/gemini-2.5-flash',
      messages: messagesWithSystem,
      tools: tools,
    };

    if (analyzeFood && image) {
      requestBody.tool_choice = { type: "function", function: { name: "analyze_food_items" } };
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте позже.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Требуется пополнение баланса.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('AI Gateway error');
    }

    // Handle response
    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data, null, 2));
    
    const message = data.choices?.[0]?.message;
    const toolCalls = message?.tool_calls;

    // If AI wants to use tools, execute them
    if (toolCalls && toolCalls.length > 0) {
      const toolResults = [];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${functionName}`, args);

        let result;
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0];

        try {
          switch (functionName) {
            case 'add_meal':
              if (!userId) throw new Error('User not authenticated');
              
              // Create meal entry
              const { data: meal, error: mealError } = await supabase
                .from('meals')
                .insert({
                  user_id: userId,
                  meal_type: args.meal_type,
                  meal_date: today,
                  meal_time: time,
                  total_calories: args.calories,
                  total_protein: args.protein,
                  total_fat: args.fat,
                  total_carbs: args.carbs,
                })
                .select()
                .single();

              if (mealError) throw mealError;

              // Add food to meal
              const { error: foodError } = await supabase
                .from('meal_foods')
                .insert({
                  meal_id: meal.id,
                  food_name: args.food_name,
                  quantity: args.quantity,
                  unit: 'г',
                  calories: args.calories,
                  protein: args.protein,
                  fat: args.fat,
                  carbs: args.carbs,
                  added_via: 'ai_assistant'
                });

              if (foodError) throw foodError;

              result = { 
                success: true, 
                message: `Добавлено: ${args.food_name} (${args.quantity}г) в ${args.meal_type}. ${args.calories} ккал.`,
                skipFollowUp: true // Simple action, no need for second AI call
              };
              break;

            case 'add_water':
              if (!userId) throw new Error('User not authenticated');
              
              const { error: waterError } = await supabase
                .from('water_log')
                .insert({
                  user_id: userId,
                  amount_ml: args.amount_ml,
                  log_date: today,
                  log_time: time,
                });

              if (waterError) throw waterError;

              result = { 
                success: true, 
                message: `Добавлено ${args.amount_ml} мл воды ✓`,
                skipFollowUp: true // Simple action, no need for second AI call
              };
              break;

            case 'get_today_stats':
              if (!userId) throw new Error('User not authenticated');
              
              // Get today's meals
              const { data: todayMeals } = await supabase
                .from('meals')
                .select('*')
                .eq('user_id', userId)
                .eq('meal_date', today);

              // Get today's water
              const { data: todayWater } = await supabase
                .from('water_log')
                .select('amount_ml')
                .eq('user_id', userId)
                .eq('log_date', today);

              // Get user goals
              const { data: profile } = await supabase
                .from('profiles')
                .select('daily_calorie_goal, daily_protein_goal, daily_fat_goal, daily_carbs_goal, daily_water_goal')
                .eq('id', userId)
                .single();

              const totalCalories = todayMeals?.reduce((sum, m) => sum + m.total_calories, 0) || 0;
              const totalProtein = todayMeals?.reduce((sum, m) => sum + m.total_protein, 0) || 0;
              const totalFat = todayMeals?.reduce((sum, m) => sum + m.total_fat, 0) || 0;
              const totalCarbs = todayMeals?.reduce((sum, m) => sum + m.total_carbs, 0) || 0;
              const totalWater = todayWater?.reduce((sum, w) => sum + w.amount_ml, 0) || 0;

              result = {
                success: true,
                stats: {
                  calories: { consumed: totalCalories, goal: profile?.daily_calorie_goal || 2000 },
                  protein: { consumed: Math.round(totalProtein), goal: profile?.daily_protein_goal || 150 },
                  fat: { consumed: Math.round(totalFat), goal: profile?.daily_fat_goal || 65 },
                  carbs: { consumed: Math.round(totalCarbs), goal: profile?.daily_carbs_goal || 250 },
                  water: { consumed: totalWater, goal: profile?.daily_water_goal || 2000 },
                  mealsCount: todayMeals?.length || 0
                }
              };
              break;

            case 'get_week_stats':
              if (!userId) throw new Error('User not authenticated');
              
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              const weekAgoStr = weekAgo.toISOString().split('T')[0];

              const { data: weekMeals } = await supabase
                .from('meals')
                .select('meal_date, total_calories, total_protein, total_fat, total_carbs')
                .eq('user_id', userId)
                .gte('meal_date', weekAgoStr);

              const { data: weekWater } = await supabase
                .from('water_log')
                .select('log_date, amount_ml')
                .eq('user_id', userId)
                .gte('log_date', weekAgoStr);

              // Group by date
              const dailyStats: any = {};
              weekMeals?.forEach(m => {
                if (!dailyStats[m.meal_date]) {
                  dailyStats[m.meal_date] = { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0 };
                }
                dailyStats[m.meal_date].calories += m.total_calories;
                dailyStats[m.meal_date].protein += m.total_protein;
                dailyStats[m.meal_date].fat += m.total_fat;
                dailyStats[m.meal_date].carbs += m.total_carbs;
              });

              weekWater?.forEach(w => {
                if (!dailyStats[w.log_date]) {
                  dailyStats[w.log_date] = { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0 };
                }
                dailyStats[w.log_date].water += w.amount_ml;
              });

              const avgCalories = Object.values(dailyStats).reduce((sum: number, day: any) => sum + day.calories, 0) / 7;
              const avgProtein = Object.values(dailyStats).reduce((sum: number, day: any) => sum + day.protein, 0) / 7;
              const avgWater = Object.values(dailyStats).reduce((sum: number, day: any) => sum + day.water, 0) / 7;

              result = {
                success: true,
                weekStats: {
                  avgCalories: Math.round(avgCalories),
                  avgProtein: Math.round(avgProtein),
                  avgWater: Math.round(avgWater),
                  daysLogged: Object.keys(dailyStats).length,
                  dailyBreakdown: dailyStats
                }
              };
              break;

            case 'search_food':
              const { data: foods } = await supabase
                .from('food_database')
                .select('name, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g')
                .ilike('name', `%${args.query}%`)
                .limit(5);

              result = {
                success: true,
                foods: foods || [],
                message: foods?.length ? `Найдено ${foods.length} продуктов` : 'Продукты не найдены'
              };
              break;

            case 'ask_clarification':
              result = {
                success: true,
                clarification: args.question
              };
              break;

            case 'analyze_food_items':
              result = {
                success: true,
                foodData: args
              };
              break;

            default:
              result = { success: false, message: 'Unknown tool' };
          }
        } catch (error) {
          console.error(`Error executing ${functionName}:`, error);
          result = { 
            success: false, 
            message: error instanceof Error ? error.message : 'Unknown error' 
          };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result)
        });
      }

      // If analyzing food, return the result directly
      if (analyzeFood && image) {
        const analyzeResult = toolResults.find(r => r.name === 'analyze_food_items');
        if (analyzeResult) {
          const parsed = JSON.parse(analyzeResult.content);
          return new Response(JSON.stringify(parsed.foodData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Check if all tools want to skip follow-up (simple actions)
      const allSkipFollowUp = toolResults.every(r => {
        try {
          const parsed = JSON.parse(r.content);
          return parsed.skipFollowUp === true;
        } catch {
          return false;
        }
      });

      // For simple actions (add_water, add_meal), return message directly
      if (allSkipFollowUp && toolResults.length > 0) {
        const messages = toolResults.map(r => {
          try {
            const parsed = JSON.parse(r.content);
            return parsed.message;
          } catch {
            return null;
          }
        }).filter(Boolean);

        if (messages.length > 0) {
          return new Response(JSON.stringify({ response: messages.join('\n') }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Call AI again with tool results to get final response
      const followUpMessages = [
        ...messagesWithSystem,
        message,
        ...toolResults
      ];

      const followUpResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: followUpMessages,
        }),
      });

      if (!followUpResponse.ok) {
        throw new Error('Follow-up AI call failed');
      }

      const followUpData = await followUpResponse.json();
      const finalMessage = followUpData.choices?.[0]?.message?.content || 'Готово!';

      return new Response(JSON.stringify({ response: finalMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // No tools called, return regular message
    if (message?.content) {
      return new Response(JSON.stringify({ response: message.content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('No response from AI');

  } catch (error) {
    console.error('Error in ai-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
