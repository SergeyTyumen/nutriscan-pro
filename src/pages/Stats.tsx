import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CaloriesChart } from '@/components/stats/CaloriesChart';
import { MacrosChart } from '@/components/stats/MacrosChart';
import { WeightTrend } from '@/components/stats/WeightTrend';
import { AchievementsList } from '@/components/stats/AchievementsList';

const Stats = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  const { data: mealsData } = useQuery({
    queryKey: ['stats-meals', user?.id, period],
    queryFn: async () => {
      const daysAgo = period === 'week' ? 7 : 30;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-2xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Статистика</h1>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setPeriod('week')}
            variant={period === 'week' ? 'default' : 'outline'}
            className={period === 'week' ? 'bg-gradient-primary text-white border-0' : ''}
          >
            Неделя
          </Button>
          <Button
            onClick={() => setPeriod('month')}
            variant={period === 'month' ? 'default' : 'outline'}
            className={period === 'month' ? 'bg-gradient-primary text-white border-0' : ''}
          >
            Месяц
          </Button>
        </div>

        <Tabs defaultValue="calories" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-card">
            <TabsTrigger value="calories">Калории</TabsTrigger>
            <TabsTrigger value="macros">БЖУ</TabsTrigger>
            <TabsTrigger value="achievements">Достижения</TabsTrigger>
          </TabsList>

          <TabsContent value="calories" className="space-y-4">
            <CaloriesChart data={mealsData || []} period={period} />
            <WeightTrend />
          </TabsContent>

          <TabsContent value="macros">
            <MacrosChart data={mealsData || []} period={period} />
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