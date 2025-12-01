import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2, ChevronRight, Check, Minus, Plus, RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

type PlanItem = {
  food_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  category: string;
  reason?: string;
  priority?: number;
};

const steps = [
  { key: 'protein', label: 'Белок', emoji: '🥩' },
  { key: 'carbs', label: 'Гарнир', emoji: '🍚' },
  { key: 'vegetables', label: 'Овощи', emoji: '🥗' },
  { key: 'dairy', label: 'Молочное', emoji: '🥛' },
  { key: 'fruits', label: 'Фрукты', emoji: '🍎' },
  { key: 'review', label: 'Обзор', emoji: '✅' },
];

const mealTypeConfig: Record<string, { label: string; short: string; color: string }> = {
  breakfast: { label: 'Завтрак', short: 'З', color: 'bg-emerald-500' },
  lunch: { label: 'Обед', short: 'О', color: 'bg-blue-500' },
  dinner: { label: 'Ужин', short: 'У', color: 'bg-purple-500' },
  snack: { label: 'Перекус', short: 'П', color: 'bg-orange-500' },
};

const MealPlanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState<PlanItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [mealType, setMealType] = useState<string>('');
  const [showMealTypeSelection, setShowMealTypeSelection] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if mealType is passed via URL
  useEffect(() => {
    const urlMealType = searchParams.get('mealType');
    if (urlMealType) {
      setMealType(urlMealType);
      setShowMealTypeSelection(false);
    }
  }, [searchParams]);

  const currentStep = steps[currentStepIndex];

  // Meal budget percentages
  const mealBudgetPercents: Record<string, number> = {
    breakfast: 0.25,
    lunch: 0.35,
    dinner: 0.30,
    snack: 0.10,
  };

  // Fetch profile
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

  // Fetch AI recommendations for current step
  const { data: recommendations, isLoading, refetch } = useQuery({
    queryKey: ['plan-meals', currentStep.key, selectedItems.length, mealType, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('plan-meals', {
        body: { 
          step: currentStep.key, 
          selected: selectedItems,
          mealType 
        },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !showMealTypeSelection && currentStep.key !== 'review',
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (!mealType) throw new Error('Meal type required');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Create meal plan
      const { data: plan, error: planError } = await supabase
        .from('meal_plans')
        .insert({
          user_id: user!.id,
          plan_date: today,
          meal_type: mealType,
          status: 'planned',
        })
        .select()
        .single();

      if (planError) throw planError;

      // Add plan items
      const items = selectedItems.map(item => ({
        plan_id: plan.id,
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        category: item.category,
        source: 'food_database',
      }));

      const { error: itemsError } = await supabase
        .from('meal_plan_items')
        .insert(items);

      if (itemsError) throw itemsError;

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      toast.success('План питания сохранён!');
      navigate('/');
    },
    onError: (error) => {
      console.error('Error saving plan:', error);
      toast.error('Ошибка сохранения плана');
    },
  });

  const handleItemToggle = (item: any) => {
    const key = item.food_name;
    const isChecked = !checkedItems[key];
    
    setCheckedItems(prev => ({ ...prev, [key]: isChecked }));
    
    if (isChecked) {
      if (!itemQuantities[key]) {
        setItemQuantities(prev => ({ ...prev, [key]: item.quantity }));
      }
    }
  };

  const updateQuantity = (itemName: string, delta: number) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemName]: Math.max(10, (prev[itemName] || 0) + delta),
    }));
  };

  const handleNext = () => {
    // Add checked items to selected
    const newSelected = recommendations?.items
      ?.filter((item: any) => checkedItems[item.food_name])
      .map((item: any) => ({
        ...item,
        quantity: itemQuantities[item.food_name] || item.quantity,
        calories: Math.round((item.calories / item.quantity) * (itemQuantities[item.food_name] || item.quantity)),
        protein: Number(((item.protein / item.quantity) * (itemQuantities[item.food_name] || item.quantity)).toFixed(1)),
        fat: Number(((item.fat / item.quantity) * (itemQuantities[item.food_name] || item.quantity)).toFixed(1)),
        carbs: Number(((item.carbs / item.quantity) * (itemQuantities[item.food_name] || item.quantity)).toFixed(1)),
      })) || [];

    setSelectedItems(prev => [...prev, ...newSelected]);
    setCheckedItems({});
    setItemQuantities({});

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    } else {
      navigate('/');
    }
  };

  const calculateTotals = () => {
    return selectedItems.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        fat: acc.fat + item.fat,
        carbs: acc.carbs + item.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
  };

  if (showMealTypeSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
        <div className="container mx-auto px-4 py-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Планировщик питания</CardTitle>
              <CardDescription>Выберите тип приёма пищи</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'breakfast', ...mealTypeConfig.breakfast },
                { key: 'lunch', ...mealTypeConfig.lunch },
                { key: 'dinner', ...mealTypeConfig.dinner },
                { key: 'snack', ...mealTypeConfig.snack },
              ].map((type) => (
                <Button
                  key={type.key}
                  variant="outline"
                  className="w-full justify-start text-base h-auto py-4 hover:shadow-sm transition-all"
                  onClick={() => {
                    setMealType(type.key);
                    setShowMealTypeSelection(false);
                  }}
                >
                  <Avatar className={`h-9 w-9 ${type.color} mr-3`}>
                    <AvatarFallback className="bg-transparent text-white font-semibold">
                      {type.short}
                    </AvatarFallback>
                  </Avatar>
                  {type.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep.key === 'review') {
    const totals = calculateTotals();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" onClick={handleBack} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🎉</span>
                План готов!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {selectedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-semibold">{item.food_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity}{item.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{item.calories} ккал</div>
                      <div className="text-xs text-muted-foreground">
                        Б: {item.protein}г Ж: {item.fat}г У: {item.carbs}г
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>ИТОГО:</span>
                  <span>{totals.calories} ккал</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Б: {totals.protein.toFixed(1)}г | Ж: {totals.fat.toFixed(1)}г | У: {totals.carbs.toFixed(1)}г
                </div>
              </div>

              {recommendations?.message && (
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm">{recommendations.message}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleBack}>
                  ✏️ Изменить
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => savePlanMutation.mutate()}
                  disabled={savePlanMutation.isPending}
                >
                  {savePlanMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    '✅ Сохранить план'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const budget = recommendations?.budget || { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  
  // Calculate meal budget for display
  const mealPercent = mealBudgetPercents[mealType] || 0.25;
  const mealBudget = profile ? {
    calories: Math.round(profile.daily_calorie_goal * mealPercent),
    protein: Math.round(profile.daily_protein_goal * mealPercent),
    fat: Math.round(profile.daily_fat_goal * mealPercent),
    carbs: Math.round(profile.daily_carbs_goal * mealPercent),
  } : null;

  const selectedTotals = calculateTotals();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted pb-20">
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Шаг {currentStepIndex + 1} из {steps.length}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">{currentStep.emoji}</span>
              {currentStep.label}
            </CardTitle>
            {recommendations?.message && (
              <CardDescription>{recommendations.message}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {mealBudget && (
              <div className="mb-4 p-3 bg-primary/10 rounded-lg">
                <div className="text-sm font-semibold mb-2">
                  Бюджет для {mealTypeConfig[mealType]?.label.toLowerCase()}а:
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Выбрано: </span>
                    <span className={selectedTotals.calories > mealBudget.calories ? 'text-destructive font-semibold' : 'font-semibold'}>
                      {selectedTotals.calories}
                    </span>
                    <span className="text-muted-foreground"> / {mealBudget.calories} ккал</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Осталось: </span>
                    <span className="font-semibold">{budget.calories} ккал</span>
                  </div>
                </div>
                {selectedTotals.calories > mealBudget.calories && (
                  <div className="text-xs text-destructive mt-2">
                    ⚠️ Превышен бюджет приёма пищи
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg mb-4">
              <div>
                <div className="text-xs text-muted-foreground">Осталось калорий</div>
                <div className="font-semibold">{budget.calories} ккал</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Белки</div>
                <div className="font-semibold">{budget.protein.toFixed(1)}г</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Жиры</div>
                <div className="font-semibold">{budget.fat.toFixed(1)}г</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Углеводы</div>
                <div className="font-semibold">{budget.carbs.toFixed(1)}г</div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {recommendations?.items?.map((item: any, idx: number) => {
                  const isChecked = checkedItems[item.food_name];
                  const quantity = itemQuantities[item.food_name] || item.quantity;
                  
                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 transition-all ${
                        isChecked ? 'bg-primary/5 border-primary' : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleItemToggle(item)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-semibold">{item.food_name}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {item.reason}
                          </div>
                          
                          {isChecked && (
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.food_name, -10)}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="font-semibold min-w-[80px] text-center">
                                {quantity}{item.unit}
                              </span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => updateQuantity(item.food_name, 10)}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          
                          <div className="text-sm mt-2">
                            <span className="font-semibold">{Math.round((item.calories / item.quantity) * quantity)} ккал</span>
                            {' | '}
                            <span className="text-muted-foreground">
                              Б: {((item.protein / item.quantity) * quantity).toFixed(1)}г
                              {' '}Ж: {((item.fat / item.quantity) * quantity).toFixed(1)}г
                              {' '}У: {((item.carbs / item.quantity) * quantity).toFixed(1)}г
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Предложить другие продукты
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBack} className="flex-1">
            Назад
          </Button>
          <Button onClick={handleNext} className="flex-1">
            {currentStepIndex === steps.length - 2 ? 'К обзору' : 'Далее'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MealPlanner;
