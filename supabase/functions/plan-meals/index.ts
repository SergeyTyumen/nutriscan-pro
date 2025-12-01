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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    console.log("Authenticated request to plan-meals");

    const { step, selected, mealType } = await req.json();
    console.log(`Step: ${step}, Meal Type: ${mealType}, Selected items: ${selected?.length || 0}`);

    // Fetch user profile and goals
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .single();

    if (!profile) throw new Error("Profile not found");

    // Calculate consumed today
    const today = new Date().toISOString().split("T")[0];
    const { data: todayMeals } = await supabase
      .from("meals")
      .select("total_calories, total_protein, total_fat, total_carbs")
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

    // Meal budget percentages
    const mealBudgetPercents: Record<string, number> = {
      breakfast: 0.25,  // 25% of daily goal
      lunch: 0.35,      // 35% of daily goal
      dinner: 0.30,     // 30% of daily goal
      snack: 0.10,      // 10% of daily goal
    };

    const mealPercent = mealBudgetPercents[mealType] || 0.25;

    // Calculate meal-specific budget
    const mealBudget = {
      calories: Math.round(profile.daily_calorie_goal * mealPercent),
      protein: Math.round(profile.daily_protein_goal * mealPercent),
      fat: Math.round(profile.daily_fat_goal * mealPercent),
      carbs: Math.round(profile.daily_carbs_goal * mealPercent),
    };

    // Subtract already selected items from meal budget
    const budget = {
      calories: mealBudget.calories - selectedTotals.calories,
      protein: mealBudget.protein - selectedTotals.protein,
      fat: mealBudget.fat - selectedTotals.fat,
      carbs: mealBudget.carbs - selectedTotals.carbs,
    };

    console.log(`Meal type: ${mealType}, Budget percent: ${mealPercent * 100}%`);
    console.log("Meal budget:", mealBudget);
    console.log("Remaining budget:", budget);

    // Get ALL food database items
    const { data: foodItems } = await supabase
      .from("food_database")
      .select("*");

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

    // Meal type allowed categories mapping
    const mealTypeAllowedCategories: Record<string, string[]> = {
      breakfast: ["Крупы", "Молочные продукты", "Яйца", "Фрукты", "Орехи"],
      lunch: ["Мясо", "Рыба", "Крупы", "Овощи", "Хлеб", "Бобовые"],
      dinner: ["Мясо", "Рыба", "Овощи", "Молочные продукты", "Яйца"],
      snack: ["Орехи", "Фрукты", "Молочные продукы"],
    };

    const allowedCategories = mealTypeAllowedCategories[mealType] || [];
    const selectedNames = (selected || []).map((s: any) => s.food_name);

    // PREPROCESSING: Filter and calculate portions algorithmically
    const preprocessedFoods = (foodItems || [])
      // 1. Filter by allowed categories for this meal type
      .filter((f) => allowedCategories.includes(f.category || ""))
      // 2. Exclude already selected foods
      .filter((f) => !selectedNames.includes(f.name))
      // 3. Calculate optimal portion mathematically
      .map((f) => {
        // Calculate max quantity by calories (don't exceed 40% of remaining budget per item)
        const maxByCalories = Math.round((budget.calories * 0.4 / f.calories_per_100g) * 100);
        // Cap at reasonable maximum (200g for most foods)
        const optimalQuantity = Math.min(maxByCalories, 200);
        
        const calories = Math.round((f.calories_per_100g * optimalQuantity) / 100);
        const protein = Math.round((f.protein_per_100g * optimalQuantity) / 100);
        const fat = Math.round((f.fat_per_100g * optimalQuantity) / 100);
        const carbs = Math.round((f.carbs_per_100g * optimalQuantity) / 100);

        return {
          name: f.name,
          category: f.category,
          quantity: optimalQuantity,
          unit: "г",
          calories,
          protein,
          fat,
          carbs,
          caloriesPer100g: f.calories_per_100g,
          proteinPer100g: f.protein_per_100g,
          fatPer100g: f.fat_per_100g,
          carbsPer100g: f.carbs_per_100g,
        };
      })
      // 4. Filter out items that don't fit the budget or are too small
      .filter((f) => f.calories <= budget.calories && f.calories >= 20)
      // 5. Sort by priority based on meal type
      .sort((a, b) => {
        if (mealType === "dinner") return b.protein - a.protein; // Prioritize protein for dinner
        if (mealType === "breakfast") return b.carbs - a.carbs; // Prioritize carbs for breakfast
        return b.calories - a.calories; // Default: by calories
      })
      // 6. Take top 8 candidates
      .slice(0, 8);

    console.log(`Preprocessed ${preprocessedFoods.length} foods from ${foodItems?.length || 0} total`);

    const categoryMap: Record<string, string> = {
      protein: "Белок (мясо, рыба, яйца)",
      carbs: "Гарнир (крупы, хлеб)",
      vegetables: "Овощи",
      dairy: "Молочные продукты",
      fruits: "Фрукты и перекусы",
    };

    const systemPrompt = `Ты — персональный нутрициолог. 

КОНТЕКСТ:
- Приём пищи: ${mealType}
- Бюджет приёма: ${mealBudget.calories} ккал (${Math.round(mealPercent * 100)}% от дневной нормы)
- Осталось добрать: ${budget.calories} ккал

УЖЕ ВЫБРАНО:
${selected?.length > 0 ? selected.map((s: any) => `- ${s.food_name} ${s.quantity}${s.unit}: ${s.calories} ккал`).join("\n") : "Ничего не выбрано"}

ОТФИЛЬТРОВАННЫЕ ПРОДУКТЫ (уже рассчитаны порции, подходят по категории и бюджету):
${preprocessedFoods.map((f, idx) => `${idx + 1}. ${f.name} ${f.quantity}г: ${f.calories} ккал (Б: ${f.protein}г, Ж: ${f.fat}г, У: ${f.carbs}г)`).join("\n")}`;

    const userPrompt = `Из предложенного списка выбери 3-5 ЛУЧШИХ продуктов для пользователя. Верни JSON:

{
  "items": [
    {
      "food_name": "название из списка",
      "quantity": порция из списка,
      "unit": "г",
      "calories": калории из списка,
      "protein": белки из списка,
      "fat": жиры из списка,
      "carbs": углеводы из списка,
      "category": "${categoryMap[step]}",
      "reason": "1 короткое предложение почему подходит",
      "priority": 1-5
    }
  ],
  "message": "короткое сообщение (1 предложение)",
  "nextStep": "${step === "protein" ? "carbs" : step === "carbs" ? "vegetables" : step === "vegetables" ? "dairy" : step === "dairy" ? "fruits" : "review"}",
  "budget": ${JSON.stringify(budget)}
}

ВАЖНО:
- Выбирай ТОЛЬКО из предложенных ${preprocessedFoods.length} продуктов
- Используй ТОЧНЫЕ значения quantity, calories, protein, fat, carbs из списка
- НЕ придумывай свои порции - они уже рассчитаны
- Причина должна быть короткой (макс 10 слов)
- Если продуктов мало или нет - верни пустой items и объясни почему в message`;

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
