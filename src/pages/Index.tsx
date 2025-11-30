import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { CaloriesWidget } from '@/components/CaloriesWidget';
import { MacrosWidget } from '@/components/MacrosWidget';
import { WaterWidget } from '@/components/WaterWidget';
import { StreakWidget } from '@/components/StreakWidget';
import { MealsList } from '@/components/MealsList';

const Index = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md">
              <span className="text-2xl">🍎</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Привет!</h1>
              <p className="text-sm text-muted-foreground">
                {user?.user_metadata?.display_name || user?.email?.split('@')[0]}
              </p>
            </div>
          </div>
          <Button
            onClick={signOut}
            variant="ghost"
            size="icon"
            className="rounded-2xl"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <CaloriesWidget />
          
          <MacrosWidget />
          
          <div className="grid grid-cols-1 gap-4">
            <WaterWidget />
            <StreakWidget />
          </div>

          <div className="pt-2">
            <h2 className="text-lg font-semibold text-foreground mb-3">Сегодня</h2>
            <MealsList />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
