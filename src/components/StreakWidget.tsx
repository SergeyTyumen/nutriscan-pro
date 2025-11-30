import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Flame } from 'lucide-react';

export const StreakWidget = () => {
  const { user } = useAuth();

  const { data: meals } = useQuery({
    queryKey: ['meals-streak', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('meal_date')
        .eq('user_id', user?.id)
        .order('meal_date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const calculateStreak = () => {
    if (!meals || meals.length === 0) return 0;

    const uniqueDates = [...new Set(meals.map(m => m.meal_date))].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let currentDate = new Date(today);

    for (const date of uniqueDates) {
      const checkDate = currentDate.toISOString().split('T')[0];
      if (date === checkDate) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  const streak = calculateStreak();

  return (
    <Card className="bg-gradient-warm p-6 shadow-lg border-0 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-90 mb-1">Стрик</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{streak}</span>
            <span className="text-lg opacity-75">дней</span>
          </div>
          <p className="text-xs mt-2 opacity-75">
            {streak > 0 ? 'Отличная работа! 💪' : 'Начни свой стрик сегодня!'}
          </p>
        </div>
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <Flame className="w-8 h-8" fill="white" />
        </div>
      </div>
    </Card>
  );
};
