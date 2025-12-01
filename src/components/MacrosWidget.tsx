import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';

export const MacrosWidget = ({ selectedDate }: { selectedDate?: Date }) => {
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
    queryKey: ['today-meals-macros', user?.id, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('total_protein, total_fat, total_carbs')
        .eq('user_id', user?.id)
        .eq('meal_date', dateStr);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const protein = todayMeals?.reduce((sum, meal) => sum + meal.total_protein, 0) || 0;
  const fat = todayMeals?.reduce((sum, meal) => sum + meal.total_fat, 0) || 0;
  const carbs = todayMeals?.reduce((sum, meal) => sum + meal.total_carbs, 0) || 0;

  const proteinGoal = profile?.daily_protein_goal || 150;
  const fatGoal = profile?.daily_fat_goal || 70;
  const carbsGoal = profile?.daily_carbs_goal || 250;

  const macros = [
    { name: 'Белки', value: protein, goal: proteinGoal, color: 'bg-gradient-warm', unit: 'г' },
    { name: 'Жиры', value: fat, goal: fatGoal, color: 'bg-gradient-gold', unit: 'г' },
    { name: 'Углеводы', value: carbs, goal: carbsGoal, color: 'bg-gradient-cool', unit: 'г' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {macros.map((macro) => (
        <Card
          key={macro.name}
          className={`${macro.color} p-4 text-white shadow-md border-0 relative overflow-hidden`}
        >
          <div className="relative z-10">
            <p className="text-xs font-medium opacity-90 mb-2">{macro.name}</p>
            <p className="text-2xl font-bold mb-1">
              {Math.round(macro.value)}
              <span className="text-sm opacity-75 ml-1">{macro.unit}</span>
            </p>
            <p className="text-xs opacity-75 leading-tight">
              Рекомендуется: {macro.goal}{macro.unit}
              <br />
              Съедено: {Math.round(macro.value)}{macro.unit}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
};
