import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Check, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const mealTypeEmoji: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍪',
};

const mealTypeLabel: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

export const PlanWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split('T')[0];

  const { data: plans, isLoading } = useQuery({
    queryKey: ['meal-plans', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select(`
          *,
          meal_plan_items (*)
        `)
        .eq('user_id', user!.id)
        .eq('plan_date', today)
        .eq('status', 'planned');

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const markAsEatenMutation = useMutation({
    mutationFn: async (planId: string) => {
      const plan = plans?.find(p => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      const now = new Date();
      const mealTime = now.toTimeString().split(' ')[0];

      // Create meal entry
      const totals = plan.meal_plan_items.reduce(
        (acc: any, item: any) => ({
          calories: acc.calories + item.calories,
          protein: acc.protein + item.protein,
          fat: acc.fat + item.fat,
          carbs: acc.carbs + item.carbs,
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user!.id,
          meal_type: plan.meal_type,
          meal_date: today,
          meal_time: mealTime,
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_fat: totals.fat,
          total_carbs: totals.carbs,
          notes: 'Из плана питания',
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Add foods to meal
      const foods = plan.meal_plan_items.map((item: any) => ({
        meal_id: meal.id,
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        added_via: 'plan',
      }));

      const { error: foodsError } = await supabase
        .from('meal_foods')
        .insert(foods);

      if (foodsError) throw foodsError;

      // Mark plan as eaten
      const { error: updateError } = await supabase
        .from('meal_plans')
        .update({ status: 'eaten' })
        .eq('id', planId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      toast.success('Добавлено в дневник!');
    },
    onError: (error) => {
      console.error('Error marking as eaten:', error);
      toast.error('Ошибка при добавлении');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            План на сегодня
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const plannedTypes = new Set(plans?.map(p => p.meal_type) || []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="w-5 h-5" />
          План на сегодня
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate('/planner')}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {mealTypes.map((type) => {
          const plan = plans?.find(p => p.meal_type === type);
          const hasPlanned = plannedTypes.has(type);

          if (!hasPlanned) {
            return (
              <div
                key={type}
                className="flex items-center justify-between p-2 rounded-lg border border-dashed"
              >
                <div className="flex items-center gap-2">
                  <span>{mealTypeEmoji[type]}</span>
                  <span className="text-sm text-muted-foreground">
                    {mealTypeLabel[type]}: нет плана
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate('/planner')}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            );
          }

          if (plan) {
            const totals = plan.meal_plan_items.reduce(
              (acc: any, item: any) => ({
                calories: acc.calories + item.calories,
              }),
              { calories: 0 }
            );

            return (
              <div
                key={type}
                className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{mealTypeEmoji[type]}</span>
                    <span className="text-sm font-semibold">
                      {mealTypeLabel[type]}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {plan.meal_plan_items.length} продуктов • {totals.calories} ккал
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => markAsEatenMutation.mutate(plan.id)}
                  disabled={markAsEatenMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Съел
                </Button>
              </div>
            );
          }

          return null;
        })}
      </CardContent>
    </Card>
  );
};
