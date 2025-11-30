import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export const WeightTrend = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile-weight', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('current_weight, target_weight')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (!profile?.current_weight) {
    return (
      <Card className="bg-card p-6 shadow-md border-border text-center">
        <p className="text-muted-foreground">
          Укажите текущий вес в профиле для отслеживания тренда
        </p>
      </Card>
    );
  }

  const currentWeight = profile.current_weight;
  const targetWeight = profile.target_weight || currentWeight;
  const difference = currentWeight - targetWeight;
  const isGoalReached = Math.abs(difference) < 0.5;
  const trend = difference > 0 ? 'losing' : difference < 0 ? 'gaining' : 'maintaining';

  return (
    <Card className="bg-card p-6 shadow-md border-border">
      <h3 className="font-semibold mb-4 text-foreground">Тренд веса</h3>
      
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Текущий вес</p>
          <p className="text-3xl font-bold text-foreground">{currentWeight} кг</p>
        </div>
        <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
          {trend === 'losing' && <TrendingDown className="w-8 h-8 text-white" />}
          {trend === 'gaining' && <TrendingUp className="w-8 h-8 text-white" />}
          {trend === 'maintaining' && <Minus className="w-8 h-8 text-white" />}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Целевой вес</span>
          <span className="font-semibold text-foreground">{targetWeight} кг</span>
        </div>
        
        {!isGoalReached && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">До цели</span>
            <span className="font-semibold text-foreground">
              {Math.abs(difference).toFixed(1)} кг
            </span>
          </div>
        )}

        {isGoalReached && (
          <div className="bg-gradient-primary text-white p-3 rounded-2xl text-center">
            <p className="font-semibold">🎉 Цель достигнута!</p>
          </div>
        )}
      </div>
    </Card>
  );
};