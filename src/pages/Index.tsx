import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Search, Camera, ChevronLeft, ChevronRight, TrendingUp, Settings, BookMarked } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CaloriesWidget } from '@/components/CaloriesWidget';
import { MacrosWidget } from '@/components/MacrosWidget';
import { WaterWidget } from '@/components/WaterWidget';
import { StreakWidget } from '@/components/StreakWidget';
import { MealsList } from '@/components/MealsList';
import { FoodSearchDialog } from '@/components/FoodSearchDialog';
import { VitaButton } from '@/components/VitaButton';
import { PlanWidget } from '@/components/PlanWidget';

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    }
    
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      weekday: 'short'
    });
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md">
              <span className="text-2xl">{profile?.avatar_url || '🍎'}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Привет!</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0]}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <VitaButton />
            <Button
              onClick={signOut}
              variant="ghost"
              size="icon"
              className="rounded-2xl"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-4 bg-card rounded-2xl p-3 shadow-sm border border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => changeDate(-1)}
            className="rounded-xl"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">{formatDate(currentDate)}</h2>
            <p className="text-xs text-muted-foreground">
              {currentDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => changeDate(1)}
            disabled={isToday}
            className="rounded-xl"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Quick Links */}
        <div className="flex gap-2 mb-4">
          <Link to="/profile" className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Settings className="w-4 h-4" />
              Настроить цель
            </Button>
          </Link>
          <Link to="/stats" className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <TrendingUp className="w-4 h-4" />
              Смотреть прогресс
            </Button>
          </Link>
        </div>

        <div className="space-y-4">
          <CaloriesWidget selectedDate={currentDate} />
          
          <MacrosWidget selectedDate={currentDate} />
          
          {isToday && <PlanWidget />}
          
          <div className="grid grid-cols-1 gap-4">
            <WaterWidget selectedDate={currentDate} />
            <StreakWidget />
          </div>

          <div className="pt-2">
            <h2 className="text-lg font-semibold text-foreground mb-3">Приёмы пищи</h2>
            
            {/* Three ways to add food */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Button
                onClick={() => setSearchDialogOpen(true)}
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 hover:bg-accent hover:border-primary transition-all"
              >
                <Search className="w-5 h-5 text-primary" />
                <div className="text-center">
                  <div className="font-semibold text-xs">Ввести</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">Поиск продуктов</div>
                </div>
              </Button>
              
              <Button
                onClick={() => navigate('/camera')}
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 hover:bg-accent hover:border-primary transition-all"
              >
                <Camera className="w-5 h-5 text-primary" />
                <div className="text-center">
                  <div className="font-semibold text-xs">Сканировать</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">ИИ по фото</div>
                </div>
              </Button>

              <Button
                onClick={() => navigate('/recipes')}
                variant="outline"
                className="h-auto py-3 flex-col gap-1.5 hover:bg-accent hover:border-primary transition-all"
              >
                <BookMarked className="w-5 h-5 text-primary" />
                <div className="text-center">
                  <div className="font-semibold text-xs">Мои блюда</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">Из сохранённых</div>
                </div>
              </Button>
            </div>
            
            <MealsList selectedDate={currentDate} />
          </div>
        </div>
      </div>

      <FoodSearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} />
    </div>
  );
};

export default Index;
