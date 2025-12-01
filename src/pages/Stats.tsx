import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CaloriesChart } from '@/components/stats/CaloriesChart';
import { MacrosChart } from '@/components/stats/MacrosChart';
import { WeightTrend } from '@/components/stats/WeightTrend';
import { AchievementsList } from '@/components/stats/AchievementsList';

const Stats = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<'month' | '3months' | '6months' | 'all'>('month');

  // Calculate days based on period
  const getDaysAgo = () => {
    switch (period) {
      case 'month': return 30;
      case '3months': return 90;
      case '6months': return 180;
      case 'all': return 365 * 10; // 10 years as "all time"
      default: return 30;
    }
  };

  const { data: mealsData } = useQuery({
    queryKey: ['stats-meals', user?.id, period],
    queryFn: async () => {
      const daysAgo = getDaysAgo();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data, error } = await supabase
        .from('meals')
        .select('meal_date, total_calories, total_protein, total_fat, total_carbs')
        .eq('user_id', user?.id)
        .gte('meal_date', startDate.toISOString().split('T')[0])
        .order('meal_date', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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

  const { data: achievements } = useQuery({
    queryKey: ['achievements', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user?.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate progress summary
  const currentWeight = profile?.current_weight;
  const targetWeight = profile?.target_weight;
  const totalMeals = mealsData?.length || 0;
  const avgCalories = mealsData?.length 
    ? Math.round(mealsData.reduce((sum, m) => sum + m.total_calories, 0) / mealsData.length)
    : 0;

  const weightDiff = currentWeight && targetWeight ? currentWeight - targetWeight : null;
  const weightStatus = weightDiff 
    ? weightDiff > 0 
      ? 'losing' 
      : weightDiff < 0 
        ? 'gaining' 
        : 'stable'
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-2xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Мой прогресс</h1>
        </div>

        {/* Progress Summary */}
        <Card className="bg-card p-5 shadow-md border-border mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">За период</p>
              <p className="text-2xl font-bold text-foreground">{totalMeals}</p>
              <p className="text-xs text-muted-foreground">приёмов пищи</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Средние калории</p>
              <p className="text-2xl font-bold text-foreground">{avgCalories}</p>
              <p className="text-xs text-muted-foreground">ккал/день</p>
            </div>
          </div>
          
          {weightStatus && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {weightStatus === 'losing' && (
                  <>
                    <TrendingDown className="w-5 h-5 text-green-500" />
                    <p className="text-sm">
                      <span className="font-semibold text-green-500">На пути к цели!</span>
                      {' '}До целевого веса {Math.abs(weightDiff!).toFixed(1)} кг
                    </p>
                  </>
                )}
                {weightStatus === 'gaining' && (
                  <>
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                    <p className="text-sm">
                      <span className="font-semibold text-orange-500">Набор массы</span>
                      {' '}Ещё {Math.abs(weightDiff!).toFixed(1)} кг до цели
                    </p>
                  </>
                )}
                {weightStatus === 'stable' && (
                  <>
                    <Minus className="w-5 h-5 text-blue-500" />
                    <p className="text-sm">
                      <span className="font-semibold text-blue-500">Цель достигнута!</span>
                      {' '}Вес стабилен
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Period Selection */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            onClick={() => setPeriod('month')}
            variant={period === 'month' ? 'default' : 'outline'}
            size="sm"
            className={period === 'month' ? 'bg-gradient-primary text-white border-0' : ''}
          >
            Месяц
          </Button>
          <Button
            onClick={() => setPeriod('3months')}
            variant={period === '3months' ? 'default' : 'outline'}
            size="sm"
            className={period === '3months' ? 'bg-gradient-primary text-white border-0' : ''}
          >
            3 месяца
          </Button>
          <Button
            onClick={() => setPeriod('6months')}
            variant={period === '6months' ? 'default' : 'outline'}
            size="sm"
            className={period === '6months' ? 'bg-gradient-primary text-white border-0' : ''}
          >
            6 месяцев
          </Button>
          <Button
            onClick={() => setPeriod('all')}
            variant={period === 'all' ? 'default' : 'outline'}
            size="sm"
            className={period === 'all' ? 'bg-gradient-primary text-white border-0' : ''}
          >
            Всё время
          </Button>
        </div>

        <Tabs defaultValue="calories" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-card">
            <TabsTrigger value="calories">Калории</TabsTrigger>
            <TabsTrigger value="macros">БЖУ</TabsTrigger>
            <TabsTrigger value="achievements">Достижения</TabsTrigger>
          </TabsList>

          <TabsContent value="calories" className="space-y-4">
            <CaloriesChart 
              data={mealsData || []} 
              period={period === 'month' ? 'month' : 'month'} 
              dailyGoal={profile?.daily_calorie_goal || 2000}
            />
            <WeightTrend />
          </TabsContent>

          <TabsContent value="macros">
            <MacrosChart data={mealsData || []} period={period === 'month' ? 'month' : 'month'} />
          </TabsContent>

          <TabsContent value="achievements">
            <AchievementsList achievements={achievements || []} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Stats;