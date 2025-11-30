import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplet, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const WaterWidget = () => {
  const { user, loading } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
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

  const { data: todayWater, refetch } = useQuery({
    queryKey: ['today-water', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('water_log')
        .select('amount_ml')
        .eq('user_id', user?.id)
        .eq('log_date', today);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const totalWater = todayWater?.reduce((sum, log) => sum + log.amount_ml, 0) || 0;
  const goal = profile?.daily_water_goal || 2000;
  const glasses = Math.floor(totalWater / 250);
  const percentage = Math.min((totalWater / goal) * 100, 100);

  const addWater = async (amount: number) => {
    if (!user?.id) {
      toast.error('Необходима авторизация');
      return;
    }
    
    const { error } = await supabase.from('water_log').insert({
      user_id: user.id,
      amount_ml: amount,
    });

    if (error) {
      toast.error('Ошибка добавления воды');
    } else {
      toast.success(`+${amount}мл воды`);
      refetch();
    }
  };

  if (loading || profileLoading) {
    return (
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="text-center text-muted-foreground p-4">
          Войдите для отслеживания воды
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card p-6 shadow-md border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-cool flex items-center justify-center">
            <Droplet className="w-5 h-5 text-white" fill="white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Вода</h3>
            <p className="text-sm text-muted-foreground">{glasses} стаканов</p>
          </div>
        </div>
        <span className="text-2xl font-bold text-foreground">{totalWater}мл</span>
      </div>
      
      <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-4">
        <div 
          className="absolute h-full bg-gradient-cool transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => addWater(250)}
          size="sm"
          className="flex-1 bg-gradient-cool hover:opacity-90 text-white border-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          250мл
        </Button>
        <Button
          onClick={() => addWater(500)}
          size="sm"
          className="flex-1 bg-gradient-cool hover:opacity-90 text-white border-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          500мл
        </Button>
      </div>
    </Card>
  );
};
