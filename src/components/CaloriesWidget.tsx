import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export const CaloriesWidget = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: todayMeals } = useQuery({
    queryKey: ['today-meals', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('meals')
        .select('total_calories')
        .eq('user_id', user?.id)
        .eq('meal_date', today);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const totalCalories = todayMeals?.reduce((sum, meal) => sum + meal.total_calories, 0) || 0;
  const goal = profile?.daily_calorie_goal || 2000;
  const percentage = Math.min((totalCalories / goal) * 100, 100);
  const remaining = Math.max(goal - totalCalories, 0);

  return (
    <Card className="relative overflow-hidden bg-gradient-primary p-6 text-primary-foreground shadow-lg border-0">
      <div className="relative z-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium opacity-90">Калории</h2>
          <span className="text-xs opacity-75">{goal} цель</span>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-5xl font-bold">{totalCalories}</span>
          <span className="text-lg opacity-75">/ {goal}</span>
        </div>
        <Progress value={percentage} className="h-2 bg-white/20" />
        <p className="text-sm mt-3 opacity-90">
          {remaining > 0 ? `Осталось ${remaining} ккал` : 'Цель достигнута! 🎉'}
        </p>
      </div>
    </Card>
  );
};
