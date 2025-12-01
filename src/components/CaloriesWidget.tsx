import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export const CaloriesWidget = ({ selectedDate }: { selectedDate?: Date }) => {
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

  const dateStr = (selectedDate || new Date()).toISOString().split('T')[0];

  const { data: todayMeals } = useQuery({
    queryKey: ['today-meals', user?.id, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('total_calories')
        .eq('user_id', user?.id)
        .eq('meal_date', dateStr);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const totalCalories = todayMeals?.reduce((sum, meal) => sum + meal.total_calories, 0) || 0;
  const goal = profile?.daily_calorie_goal || 2000;
  const percentage = (totalCalories / goal) * 100;
  const remaining = goal - totalCalories;
  
  // Determine status and colors
  const exceeded = totalCalories > goal;
  const overAmount = exceeded ? totalCalories - goal : 0;
  const overPercent = exceeded ? Math.round((overAmount / goal) * 100) : 0;
  
  // Color coding based on overshoot
  let bgGradient = 'bg-gradient-primary'; // Default green
  let progressColor = '';
  let statusMessage = '';
  
  if (exceeded) {
    if (overPercent > 20) {
      // Significant overshoot: red
      bgGradient = 'bg-gradient-to-br from-red-500 to-red-600';
      progressColor = 'bg-red-700';
      statusMessage = `⚠️ Превышено на ${overAmount} ккал (+${overPercent}%)`;
    } else {
      // Minor overshoot: orange
      bgGradient = 'bg-gradient-to-br from-orange-500 to-orange-600';
      progressColor = 'bg-orange-700';
      statusMessage = `⚠️ Превышено на ${overAmount} ккал (+${overPercent}%)`;
    }
  } else if (remaining === 0) {
    statusMessage = 'Цель достигнута! 🎉';
  } else {
    statusMessage = `Осталось ${remaining} ккал`;
  }

  return (
    <Card className={`relative overflow-hidden ${bgGradient} p-6 text-white shadow-lg border-0`}>
      <div className="relative z-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium opacity-90">Калории</h2>
          <span className="text-xs opacity-75">{goal} цель</span>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-5xl font-bold">{totalCalories}</span>
          <span className="text-lg opacity-75">/ {goal}</span>
        </div>
        <Progress 
          value={Math.min(percentage, 100)} 
          className={`h-2 ${exceeded ? 'bg-white/30' : 'bg-white/20'}`}
          style={exceeded && progressColor ? { 
            ['--progress-background' as any]: progressColor 
          } : {}}
        />
        <p className={`text-sm mt-3 ${exceeded ? 'font-semibold' : 'opacity-90'}`}>
          {statusMessage}
        </p>
      </div>
    </Card>
  );
};
