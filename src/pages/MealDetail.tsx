import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const MealDetail = () => {
  const navigate = useNavigate();
  const { mealId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: meal, isLoading: mealLoading } = useQuery({
    queryKey: ['meal', mealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('id', mealId)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!mealId && !!user?.id,
  });

  const { data: foods, isLoading: foodsLoading } = useQuery({
    queryKey: ['meal-foods', mealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_foods')
        .select('*')
        .eq('meal_id', mealId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!mealId,
  });

  const deleteMeal = useMutation({
    mutationFn: async () => {
      // Сначала удаляем все продукты
      const { error: foodsError } = await supabase
        .from('meal_foods')
        .delete()
        .eq('meal_id', mealId);

      if (foodsError) throw foodsError;

      // Затем удаляем сам приём пищи
      const { error: mealError } = await supabase
        .from('meals')
        .delete()
        .eq('id', mealId)
        .eq('user_id', user?.id);

      if (mealError) throw mealError;
    },
    onSuccess: () => {
      toast.success('Приём пищи удалён');
      queryClient.invalidateQueries({ queryKey: ['today-meals'] });
      queryClient.invalidateQueries({ queryKey: ['today-meals-list'] });
      queryClient.invalidateQueries({ queryKey: ['today-meals-macros'] });
      queryClient.invalidateQueries({ queryKey: ['meals-streak'] });
      navigate('/');
    },
    onError: (error: any) => {
      toast.error('Ошибка при удалении');
      console.error(error);
    },
  });

  const deleteFood = useMutation({
    mutationFn: async (foodId: string) => {
      const { error } = await supabase
        .from('meal_foods')
        .delete()
        .eq('id', foodId);

      if (error) throw error;

      // Пересчитываем итоги приёма пищи
      const remainingFoods = foods?.filter(f => f.id !== foodId) || [];
      const totals = remainingFoods.reduce(
        (acc, food) => ({
          calories: acc.calories + food.calories,
          protein: acc.protein + Number(food.protein),
          fat: acc.fat + Number(food.fat),
          carbs: acc.carbs + Number(food.carbs),
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      const { error: updateError } = await supabase
        .from('meals')
        .update({
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_fat: totals.fat,
          total_carbs: totals.carbs,
        })
        .eq('id', mealId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Продукт удалён');
      queryClient.invalidateQueries({ queryKey: ['meal', mealId] });
      queryClient.invalidateQueries({ queryKey: ['meal-foods', mealId] });
      queryClient.invalidateQueries({ queryKey: ['today-meals'] });
      queryClient.invalidateQueries({ queryKey: ['today-meals-list'] });
      queryClient.invalidateQueries({ queryKey: ['today-meals-macros'] });
    },
    onError: (error: any) => {
      toast.error('Ошибка при удалении продукта');
      console.error(error);
    },
  });

  if (mealLoading || foodsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted flex items-center justify-center pb-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-muted-foreground">Приём пищи не найден</p>
        </div>
      </div>
    );
  }

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
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground capitalize">{meal.meal_type}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(meal.meal_date).toLocaleDateString('ru-RU')} • {meal.meal_time}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" className="rounded-2xl">
                <Trash2 className="h-5 w-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить приём пищи?</AlertDialogTitle>
                <AlertDialogDescription>
                  Это действие нельзя отменить. Весь приём пищи и все продукты в нём будут удалены.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMeal.mutate()}
                  className="bg-destructive text-destructive-foreground"
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="space-y-4">
          <Card className="bg-card p-6 shadow-md border-border">
            <h3 className="font-semibold mb-3">Итого</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gradient-primary text-white rounded-2xl p-4">
                <p className="text-sm opacity-90 mb-1">Калории</p>
                <p className="text-3xl font-bold">{meal.total_calories}</p>
                <p className="text-xs opacity-75">ккал</p>
              </div>
              <div className="bg-muted rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-2">БЖУ</p>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="font-semibold">Б:</span> {Math.round(Number(meal.total_protein))}г
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Ж:</span> {Math.round(Number(meal.total_fat))}г
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">У:</span> {Math.round(Number(meal.total_carbs))}г
                  </p>
                </div>
              </div>
            </div>
            {meal.notes && (
              <div className="bg-muted rounded-2xl p-3">
                <p className="text-sm text-muted-foreground">{meal.notes}</p>
              </div>
            )}
          </Card>

          <div>
            <h3 className="font-semibold mb-3 text-foreground">Продукты ({foods?.length || 0})</h3>
            <div className="space-y-3">
              {foods?.map((food) => (
                <Card
                  key={food.id}
                  className="bg-card p-4 shadow-md border-border hover:shadow-lg transition-shadow"
                >
                  <div className="flex gap-4">
                    {food.photo_url && (
                      <img
                        src={food.photo_url}
                        alt={food.food_name}
                        className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground">{food.food_name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {food.quantity} {food.unit}
                        {food.added_via && ` • ${food.added_via === 'camera' ? '📸 Камера' : '✍️ Вручную'}`}
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span className="font-semibold">{food.calories} ккал</span>
                        <span className="text-muted-foreground">
                          Б: {food.protein}г
                        </span>
                        <span className="text-muted-foreground">
                          Ж: {food.fat}г
                        </span>
                        <span className="text-muted-foreground">
                          У: {food.carbs}г
                        </span>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить продукт?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Продукт "{food.food_name}" будет удалён из приёма пищи.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteFood.mutate(food.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MealDetail;
