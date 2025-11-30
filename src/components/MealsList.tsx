import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Coffee, Sunrise, Sun, Moon } from 'lucide-react';

export const MealsList = () => {
  const { user } = useAuth();

  const { data: todayMeals } = useQuery({
    queryKey: ['today-meals-list', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user?.id)
        .eq('meal_date', today)
        .order('meal_time', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'завтрак':
        return <Sunrise className="w-5 h-5" />;
      case 'обед':
        return <Sun className="w-5 h-5" />;
      case 'ужин':
        return <Moon className="w-5 h-5" />;
      default:
        return <Coffee className="w-5 h-5" />;
    }
  };

  const getMealGradient = (type: string) => {
    switch (type) {
      case 'завтрак':
        return 'bg-gradient-gold';
      case 'обед':
        return 'bg-gradient-warm';
      case 'ужин':
        return 'bg-gradient-cool';
      default:
        return 'bg-gradient-primary';
    }
  };

  if (!todayMeals || todayMeals.length === 0) {
    return (
      <Card className="bg-card p-6 text-center shadow-md border-border">
        <p className="text-muted-foreground">Приёмов пищи пока нет</p>
        <p className="text-sm text-muted-foreground mt-1">Добавьте первый приём через камеру</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {todayMeals.map((meal) => (
        <Card
          key={meal.id}
          className="bg-card p-4 shadow-md border-border hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${getMealGradient(meal.meal_type)} flex items-center justify-center text-white`}>
              {getMealIcon(meal.meal_type)}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground capitalize">{meal.meal_type}</h4>
              <p className="text-sm text-muted-foreground">{meal.meal_time}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{meal.total_calories}</p>
              <p className="text-xs text-muted-foreground">ккал</p>
            </div>
          </div>
          {meal.notes && (
            <p className="text-sm text-muted-foreground mt-2 pl-16">{meal.notes}</p>
          )}
        </Card>
      ))}
    </div>
  );
};
