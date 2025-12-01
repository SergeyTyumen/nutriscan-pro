import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';

const mealTypeConfig: Record<string, { label: string; short: string; color: string }> = {
  breakfast: { label: 'Завтрак', short: 'З', color: 'bg-emerald-500' },
  lunch: { label: 'Обед', short: 'О', color: 'bg-blue-500' },
  dinner: { label: 'Ужин', short: 'У', color: 'bg-purple-500' },
  snack: { label: 'Перекус', short: 'П', color: 'bg-orange-500' },
};

export const PlanWidget = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  const today = new Date().toISOString().split('T')[0];

  const { data: plans, isLoading } = useQuery({
    queryKey: ['meal-plans', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select(`
          *,
          meal_plan_items (*)
        `)
        .eq('user_id', user!.id)
        .eq('plan_date', today)
        .eq('status', 'planned');

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const markAsEatenMutation = useMutation({
    mutationFn: async ({ planId, selectedItemIds }: { planId: string; selectedItemIds: string[] }) => {
      const plan = plans?.find(p => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      const itemsToAdd = plan.meal_plan_items.filter((item: any) => 
        selectedItemIds.includes(item.id)
      );

      if (itemsToAdd.length === 0) {
        throw new Error('No items selected');
      }

      const now = new Date();
      const mealTime = now.toTimeString().split(' ')[0];

      // Calculate totals for selected items only
      const totals = itemsToAdd.reduce(
        (acc: any, item: any) => ({
          calories: acc.calories + item.calories,
          protein: acc.protein + item.protein,
          fat: acc.fat + item.fat,
          carbs: acc.carbs + item.carbs,
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user!.id,
          meal_type: plan.meal_type,
          meal_date: today,
          meal_time: mealTime,
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_fat: totals.fat,
          total_carbs: totals.carbs,
          notes: 'Из плана питания',
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Add selected foods to meal
      const foods = itemsToAdd.map((item: any) => ({
        meal_id: meal.id,
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        added_via: 'plan',
      }));

      const { error: foodsError } = await supabase
        .from('meal_foods')
        .insert(foods);

      if (foodsError) throw foodsError;

      // Delete selected items from plan
      const { error: deleteError } = await supabase
        .from('meal_plan_items')
        .delete()
        .in('id', selectedItemIds);

      if (deleteError) throw deleteError;

      // Check if plan has any items left
      const remainingItems = plan.meal_plan_items.filter((item: any) => 
        !selectedItemIds.includes(item.id)
      );

      // If no items left, mark plan as eaten
      if (remainingItems.length === 0) {
        const { error: updateError } = await supabase
          .from('meal_plans')
          .update({ status: 'eaten' })
          .eq('id', planId);

        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['meals'] });
      setSelectedPlan(null);
      setSelectedItems({});
      toast.success('Добавлено в дневник!');
    },
    onError: (error) => {
      console.error('Error marking as eaten:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка при добавлении');
    },
  });

  const handleOpenDialog = (plan: any) => {
    setSelectedPlan(plan);
    // By default, select all items
    const allSelected: Record<string, boolean> = {};
    plan.meal_plan_items.forEach((item: any) => {
      allSelected[item.id] = true;
    });
    setSelectedItems(allSelected);
  };

  const handleConfirmEaten = () => {
    if (!selectedPlan) return;
    
    const selectedIds = Object.keys(selectedItems).filter(id => selectedItems[id]);
    if (selectedIds.length === 0) {
      toast.error('Выберите хотя бы один продукт');
      return;
    }

    markAsEatenMutation.mutate({
      planId: selectedPlan.id,
      selectedItemIds: selectedIds,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            План на сегодня
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        </CardContent>
      </Card>
    );
  }

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
  const plannedTypes = new Set(plans?.map(p => p.meal_type) || []);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarDays className="w-4 h-4" />
          План на сегодня
        </CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate('/planner')}
          className="h-8 w-8 p-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {mealTypes.map((type) => {
          const plan = plans?.find(p => p.meal_type === type);
          const hasPlanned = plannedTypes.has(type);
          const config = mealTypeConfig[type];

          if (!hasPlanned) {
            return (
              <div
                key={type}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className={`h-9 w-9 ${config.color}`}>
                    <AvatarFallback className="bg-transparent text-white font-semibold text-sm">
                      {config.short}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">
                    {config.label}: нет плана
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/planner?mealType=${type}`)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            );
          }

          if (plan) {
            const totals = plan.meal_plan_items.reduce(
              (acc: any, item: any) => ({
                calories: acc.calories + item.calories,
              }),
              { calories: 0 }
            );

            return (
              <div
                key={type}
                className="flex items-center justify-between p-3 rounded-xl bg-card border hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className={`h-9 w-9 ${config.color}`}>
                    <AvatarFallback className="bg-transparent text-white font-semibold text-sm">
                      {config.short}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {config.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {plan.meal_plan_items.length} продуктов • {totals.calories} ккал
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleOpenDialog(plan)}
                  className="h-9 rounded-full"
                >
                  Записать
                </Button>
              </div>
            );
          }

          return null;
        })}
      </CardContent>

      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Выберите что съели</DialogTitle>
            <DialogDescription>
              Отметьте продукты, которые вы съели из плана
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="space-y-3">
              {selectedPlan.meal_plan_items.map((item: any) => {
                const isChecked = selectedItems[item.id] || false;
                
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      isChecked ? 'bg-primary/5 border-primary' : 'bg-card'
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        setSelectedItems(prev => ({
                          ...prev,
                          [item.id]: checked as boolean,
                        }));
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{item.food_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity}{item.unit}
                      </div>
                      <div className="text-sm mt-1">
                        <span className="font-semibold">{item.calories} ккал</span>
                        {' | '}
                        <span className="text-muted-foreground">
                          Б: {item.protein}г Ж: {item.fat}г У: {item.carbs}г
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="border-t pt-3">
                <div className="text-sm font-semibold mb-2">Итого:</div>
                <div className="text-sm">
                  {(() => {
                    const selectedItemsList = selectedPlan.meal_plan_items.filter((item: any) => 
                      selectedItems[item.id]
                    );
                    const totals = selectedItemsList.reduce(
                      (acc: any, item: any) => ({
                        calories: acc.calories + item.calories,
                        protein: acc.protein + item.protein,
                        fat: acc.fat + item.fat,
                        carbs: acc.carbs + item.carbs,
                      }),
                      { calories: 0, protein: 0, fat: 0, carbs: 0 }
                    );
                    
                    return (
                      <>
                        <span className="font-bold">{totals.calories} ккал</span>
                        {' | '}
                        <span className="text-muted-foreground">
                          Б: {totals.protein.toFixed(1)}г Ж: {totals.fat.toFixed(1)}г У: {totals.carbs.toFixed(1)}г
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedPlan(null)}
                >
                  Отмена
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirmEaten}
                  disabled={markAsEatenMutation.isPending}
                >
                  {markAsEatenMutation.isPending ? 'Добавление...' : 'Добавить'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
