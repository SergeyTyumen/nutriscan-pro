import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    console.log(`Planning meals for user: ${user.id}`);

    const { step, selected, mealType } = await req.json();
    console.log(`Step: ${step}, Meal Type: ${mealType}, Selected items: ${selected?.length || 0}`);

    // Fetch user profile and goals
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    // Calculate consumed today
    const today = new Date().toISOString().split("T")[0];
    const { data: todayMeals } = await supabase
      .from("meals")
      .select("total_calories, total_protein, total_fat, total_carbs")
      .eq("user_id", user.id)
      .eq("meal_date", today);

    const consumed = todayMeals?.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.total_calories,
        protein: acc.protein + meal.total_protein,
        fat: acc.fat + meal.total_fat,
        carbs: acc.carbs + meal.total_carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    ) || { calories: 0, protein: 0, fat: 0, carbs: 0 };

    // Calculate selected totals
    const selectedTotals = (selected || []).reduce(
      (acc: any, item: any) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        fat: acc.fat + item.fat,
        carbs: acc.carbs + item.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    const budget = {
      calories: profile.daily_calorie_goal - consumed.calories - selectedTotals.calories,
      protein: profile.daily_protein_goal - consumed.protein - selectedTotals.protein,
      fat: profile.daily_fat_goal - consumed.fat - selectedTotals.fat,
      carbs: profile.daily_carbs_goal - consumed.carbs - selectedTotals.carbs,
    };

    console.log("Remaining budget:", budget);

    // Get food database items for recommendations
    const { data: foodItems } = await supabase
      .from("food_database")
      .select("*")
      .limit(100);

    if (!lovableApiKey) {
      console.warn("LOVABLE_API_KEY not found, returning fallback");
      return new Response(
        JSON.stringify({
          items: [],
          message: "AI recommendations unavailable",
          budget,
          completed: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categoryMap: Record<string, string> = {
      protein: "Белок (мясо, рыба, яйца)",
      carbs: "Гарнир (крупы, хлеб)",
      vegetables: "Овощи",
      dairy: "Молочные продукты",
      fruits: "Фрукты и перекусы",
    };

    const systemPrompt = `Ты — персональный нутрициолог. Помогаешь пользователю подобрать продукты для ${mealType || "приёма пищи"}.

ЦЕЛИ пользователя на день:
- Калории: ${profile.daily_calorie_goal} ккал
- Белки: ${profile.daily_protein_goal}г
- Жиры: ${profile.daily_fat_goal}г
- Углеводы: ${profile.daily_carbs_goal}г

УЖЕ СЪЕДЕНО сегодня:
- Калории: ${consumed.calories} ккал
- Белки: ${consumed.protein}г
- Жиры: ${consumed.fat}г
- Углеводы: ${consumed.carbs}г

УЖЕ ВЫБРАНО в планировщике:
${selected?.length > 0 ? selected.map((s: any) => `- ${s.food_name} ${s.quantity}${s.unit}: ${s.calories} ккал (Б: ${s.protein}г, Ж: ${s.fat}г, У: ${s.carbs}г)`).join("\n") : "Ничего не выбрано"}

ОСТАВШИЙСЯ БЮДЖЕТ:
- Калории: ${budget.calories} ккал
- Белки: ${budget.protein}г
- Жиры: ${budget.fat}г
- Углеводы: ${budget.carbs}г

ТЕКУЩАЯ КАТЕГОРИЯ: ${categoryMap[step] || "Финальный обзор"}

ДОСТУПНЫЕ ПРОДУКТЫ из базы (${foodItems?.length || 0}):
${foodItems?.slice(0, 50).map((f) => `${f.name}: ${f.calories_per_100g} ккал/100г, Б: ${f.protein_per_100g}г, Ж: ${f.fat_per_100g}г, У: ${f.carbs_per_100g}г`).join("\n")}`;

    const userPrompt = `Верни JSON с рекомендациями для категории "${categoryMap[step]}":

{
  "items": [
    {
      "food_name": "название продукта",
      "quantity": число (граммы/мл),
      "unit": "г" или "мл",
      "calories": число,
      "protein": число,
      "fat": число,
      "carbs": число,
      "category": "${categoryMap[step]}",
      "reason": "почему рекомендуешь (учитывая оставшийся бюджет)",
      "priority": 1-5 (приоритет)
    }
  ],
  "message": "короткое сообщение пользователю о текущем шаге",
  "nextStep": "${step === "protein" ? "carbs" : step === "carbs" ? "vegetables" : step === "vegetables" ? "dairy" : step === "dairy" ? "fruits" : "review"}",
  "budget": ${JSON.stringify(budget)}
}

ВАЖНО:
- Подбери 3-5 КОНКРЕТНЫХ продуктов из базы данных для текущей категории
- Рассчитай оптимальное количество, чтобы попасть в бюджет
- Учитывай уже выбранные продукты
- Если бюджет мал (< 100 ккал), предложи легкие продукты
- НЕ превышай оставшийся бюджет`;

    console.log("Calling Lovable AI for meal planning...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    console.log("AI Response:", content);

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Invalid AI response format");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in plan-meals function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
