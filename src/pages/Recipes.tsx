import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Star, Plus, Trash2, Heart, Sparkles, Loader2, Apple } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Recipes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [mealType, setMealType] = useState('обед');
  const [portionDialogOpen, setPortionDialogOpen] = useState(false);
  const [selectedPortion, setSelectedPortion] = useState(1.0);

  const { data: recipes } = useQuery({
    queryKey: ['recipes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_recipes')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const favoriteRecipes = recipes?.filter(r => r.is_favorite) || [];
  const allRecipes = recipes || [];

  // Запрос рекомендаций от ИИ-коуча
  const { data: recommendations, isLoading: isLoadingRecommendations } = useQuery({
    queryKey: ['recipe-recommendations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('recommend-recipes', {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Кэш на 5 минут
  });

  const mealTypeMap: Record<string, string> = {
    'завтрак': 'breakfast',
    'обед': 'lunch',
    'ужин': 'dinner',
    'перекус': 'snack',
  };

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from('saved_recipes')
        .update({ is_favorite: !isFavorite })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Избранное обновлено');
    },
  });

  const deleteRecipe = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      toast.success('Рецепт удалён');
    },
  });

  const addRecipeAsMeal = useMutation({
    mutationFn: async ({ recipe, type, portion = 1.0 }: { recipe: any; type: string; portion?: number }) => {
      // Создаём новый приём пищи
      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user?.id,
          meal_type: mealTypeMap[type] || type,
          total_calories: Math.round(recipe.total_calories * portion),
          total_protein: Number(recipe.total_protein) * portion,
          total_fat: Number(recipe.total_fat) * portion,
          total_carbs: Number(recipe.total_carbs) * portion,
          notes: `Из рецепта: ${recipe.recipe_name}${portion !== 1.0 ? ` (${Math.round(portion * 100)}% порции)` : ''}`,
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Добавляем все ингредиенты как продукты
      const ingredients = recipe.ingredients as any[];
      const foodsToInsert = ingredients.map((ing: any) => ({
        meal_id: meal.id,
        food_name: ing.name,
        quantity: Number(ing.quantity) * portion,
        unit: ing.unit,
        calories: Math.round(ing.calories * portion),
        protein: Number(ing.protein) * portion,
        fat: Number(ing.fat) * portion,
        carbs: Number(ing.carbs) * portion,
        added_via: 'recipe',
      }));

      const { error: foodsError } = await supabase
        .from('meal_foods')
        .insert(foodsToInsert);

      if (foodsError) throw foodsError;
    },
    onSuccess: () => {
      setAddDialogOpen(false);
      setSelectedRecipe(null);
      queryClient.invalidateQueries({ queryKey: ['today-meals'] });
      queryClient.invalidateQueries({ queryKey: ['today-meals-list'] });
      toast.success('Рецепт добавлен в дневник!');
    },
    onError: (error: any) => {
      toast.error('Ошибка при добавлении');
      console.error(error);
    },
  });

  const handleAddRecipe = (recipe: any, status?: string, suggestedPortion?: number) => {
    setSelectedRecipe(recipe);
    setMealType(recipe.meal_type || 'обед');
    setSelectedPortion(suggestedPortion || 1.0);

    // Если блюдо частично подходит, показываем диалог выбора порции
    if (status === 'partial' && suggestedPortion) {
      setPortionDialogOpen(true);
    } else {
      setAddDialogOpen(true);
    }
  };

  const handleAddSimpleFood = async (food: any) => {
    try {
      // Создаём meal
      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user?.id,
          meal_type: mealTypeMap['перекус'],
          total_calories: food.calories,
          total_protein: food.protein,
          total_fat: food.fat,
          total_carbs: food.carbs,
          notes: `Простой перекус: ${food.name}`,
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Добавляем продукт
      const { error: foodError } = await supabase
        .from('meal_foods')
        .insert({
          meal_id: meal.id,
          food_name: food.name,
          quantity: food.quantity,
          unit: food.unit,
          calories: food.calories,
          protein: food.protein,
          fat: food.fat,
          carbs: food.carbs,
          added_via: 'manual',
        });

      if (foodError) throw foodError;

      queryClient.invalidateQueries({ queryKey: ['today-meals'] });
      queryClient.invalidateQueries({ queryKey: ['today-meals-list'] });
      toast.success(`${food.name} добавлен в дневник!`);
    } catch (error) {
      console.error('Error adding simple food:', error);
      toast.error('Ошибка при добавлении');
    }
  };

  const RecommendedRecipeCard = ({ 
    recipe, 
    status, 
    reason, 
    suggestedPortion 
  }: { 
    recipe: any; 
    status: 'perfect' | 'partial'; 
    reason: string;
    suggestedPortion?: number;
  }) => (
    <Card className="bg-card p-4 shadow-md border-border hover:shadow-lg transition-shadow">
      <div className="flex gap-4 mb-3">
        {recipe.photo_url && (
          <img
            src={recipe.photo_url}
            alt={recipe.recipe_name}
            className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{recipe.recipe_name}</h3>
              <Badge 
                variant={status === 'perfect' ? 'default' : 'secondary'}
                className={status === 'perfect' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground'
                }
              >
                {status === 'perfect' ? '🟢 Подходит' : '🟡 Частично'}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{reason}</p>
          <div className="flex gap-3 text-sm mt-2">
            <span className="font-semibold">{recipe.total_calories} ккал</span>
            <span className="text-muted-foreground">Б: {Math.round(recipe.total_protein)}г</span>
            <span className="text-muted-foreground">Ж: {Math.round(recipe.total_fat)}г</span>
            <span className="text-muted-foreground">У: {Math.round(recipe.total_carbs)}г</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {status === 'partial' && suggestedPortion && suggestedPortion < 1.0 ? (
          <>
            <Button
              onClick={() => handleAddRecipe(recipe, status, suggestedPortion)}
              size="sm"
              className="flex-1 bg-gradient-primary hover:opacity-90 text-white border-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              Выбрать порцию
            </Button>
          </>
        ) : (
          <Button
            onClick={() => handleAddRecipe(recipe)}
            size="sm"
            className="flex-1 bg-gradient-primary hover:opacity-90 text-white border-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить
          </Button>
        )}
      </div>
    </Card>
  );

  const RecipeCard = ({ recipe }: { recipe: any }) => (
    <Card className="bg-card p-4 shadow-md border-border hover:shadow-lg transition-shadow">
      <div className="flex gap-4 mb-3">
        {recipe.photo_url && (
          <img
            src={recipe.photo_url}
            alt={recipe.recipe_name}
            className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">{recipe.recipe_name}</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleFavorite.mutate({ id: recipe.id, isFavorite: recipe.is_favorite })}
              className="flex-shrink-0"
            >
              <Heart
                className={`w-5 h-5 ${recipe.is_favorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
              />
            </Button>
          </div>
          {recipe.meal_type && (
            <p className="text-xs text-muted-foreground capitalize mb-1">{recipe.meal_type}</p>
          )}
          <div className="flex gap-3 text-sm mt-2">
            <span className="font-semibold">{recipe.total_calories} ккал</span>
            <span className="text-muted-foreground">Б: {Math.round(recipe.total_protein)}г</span>
            <span className="text-muted-foreground">Ж: {Math.round(recipe.total_fat)}г</span>
            <span className="text-muted-foreground">У: {Math.round(recipe.total_carbs)}г</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => handleAddRecipe(recipe)}
          size="sm"
          className="flex-1 bg-gradient-primary hover:opacity-90 text-white border-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Trash2 className="w-4 h-4 mr-1" />
              Удалить
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить рецепт?</AlertDialogTitle>
               <AlertDialogDescription>
                Блюдо "{recipe.recipe_name}" будет удалено.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteRecipe.mutate(recipe.id)}
                className="bg-destructive text-destructive-foreground"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );

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
          <h1 className="text-2xl font-bold text-foreground">Мои блюда</h1>
        </div>

        <Tabs defaultValue="recommendations" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-card">
            <TabsTrigger value="recommendations">
              <Sparkles className="w-4 h-4 mr-1" />
              Рекомендации
            </TabsTrigger>
            <TabsTrigger value="all">
              Все ({allRecipes.length})
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Heart className="w-4 h-4 mr-1" />
              Избранное
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="space-y-3">
            {isLoadingRecommendations ? (
              <Card className="bg-card p-8 shadow-md border-border text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-4 text-primary animate-spin" />
                <p className="text-muted-foreground">ИИ-коуч анализирует ваши блюда...</p>
              </Card>
            ) : recommendations?.fallback ? (
              <Card className="bg-card p-6 shadow-md border-border">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{recommendations.coachMessage}</p>
                  </div>
                </div>
                <div className="space-y-3 mt-4">
                  {allRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
                </div>
              </Card>
            ) : (
              <>
                {/* Сообщение коуча */}
                {recommendations?.coachMessage && (
                  <Card className="bg-gradient-primary/5 p-4 shadow-md border-primary/20">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{recommendations.coachMessage}</p>
                        {recommendations.budget && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Осталось: {Math.round(recommendations.budget.calories)} ккал
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Рекомендованные блюда */}
                {recommendations?.recommendations && recommendations.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {recommendations.recommendations.map((rec: any) => {
                      const recipe = recipes?.find(r => r.id === rec.recipeId);
                      if (!recipe) return null;
                      
                      return (
                        <RecommendedRecipeCard
                          key={rec.recipeId}
                          recipe={recipe}
                          status={rec.status}
                          reason={rec.reason}
                          suggestedPortion={rec.suggestedPortion}
                        />
                      );
                    })}
                  </div>
                ) : null}

                {/* Простые продукты если ничего не подходит */}
                {recommendations?.simpleFoodSuggestions && recommendations.simpleFoodSuggestions.length > 0 && (
                  <Card className="bg-card p-4 shadow-md border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Apple className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Или попробуйте простые продукты:</h3>
                    </div>
                    <div className="space-y-2">
                      {recommendations.simpleFoodSuggestions.map((food: any, idx: number) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{food.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {food.quantity}{food.unit}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {food.calories} ккал • {food.reason}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAddSimpleFood(food)}
                            size="sm"
                            variant="outline"
                            className="ml-2"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Если совсем ничего нет */}
                {(!recommendations?.recommendations || recommendations.recommendations.length === 0) && 
                 (!recommendations?.simpleFoodSuggestions || recommendations.simpleFoodSuggestions.length === 0) && (
                  <Card className="bg-card p-8 shadow-md border-border text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-primary/10 flex items-center justify-center">
                      <Star className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">На сегодня вы хорошо поели!</h3>
                    <p className="text-sm text-muted-foreground">
                      Все ваши блюда превышают оставшийся бюджет. Лучше выпейте воды 💧
                    </p>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-3">
            {allRecipes.length === 0 ? (
              <Card className="bg-card p-8 shadow-md border-border text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-primary/10 flex items-center justify-center">
                  <Star className="w-10 h-10 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Нет сохранённых блюд</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Создайте свои блюда через камеру или вручную, чтобы быстро добавлять их в будущем
                </p>
                <Button onClick={() => navigate('/')} className="bg-gradient-primary text-white border-0">
                  На главную
                </Button>
              </Card>
            ) : (
              allRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)
            )}
          </TabsContent>

          <TabsContent value="favorites" className="space-y-3">
            {favoriteRecipes.length === 0 ? (
              <Card className="bg-card p-8 shadow-md border-border text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-warm/10 flex items-center justify-center">
                  <Heart className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Нет избранных блюд</h3>
                <p className="text-sm text-muted-foreground">
                  Добавьте блюда в избранное нажав на ❤️ для быстрого доступа
                </p>
              </Card>
            ) : (
              favoriteRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить блюдо</DialogTitle>
            <DialogDescription>
              Выберите тип приёма пищи для добавления блюда в дневник
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="meal-type">Тип приёма пищи</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger id="meal-type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="завтрак">Завтрак</SelectItem>
                  <SelectItem value="обед">Обед</SelectItem>
                  <SelectItem value="ужин">Ужин</SelectItem>
                  <SelectItem value="перекус">Перекус</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => selectedRecipe && addRecipeAsMeal.mutate({ recipe: selectedRecipe, type: mealType })}
              disabled={addRecipeAsMeal.isPending}
              className="bg-gradient-primary hover:opacity-90 text-white border-0"
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={portionDialogOpen} onOpenChange={setPortionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выбор порции</DialogTitle>
            <DialogDescription>
              Это блюдо превышает ваш дневной бюджет. Выберите размер порции:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRecipe && (
              <>
                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-sm font-medium mb-2">{selectedRecipe.recipe_name}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Полная порция: {selectedRecipe.total_calories} ккал</div>
                    <div>Половина порции: {Math.round(selectedRecipe.total_calories * selectedPortion)} ккал</div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="meal-type-portion">Тип приёма пищи</Label>
                  <Select value={mealType} onValueChange={setMealType}>
                    <SelectTrigger id="meal-type-portion" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="завтрак">Завтрак</SelectItem>
                      <SelectItem value="обед">Обед</SelectItem>
                      <SelectItem value="ужин">Ужин</SelectItem>
                      <SelectItem value="перекус">Перекус</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button
              onClick={() => {
                setPortionDialogOpen(false);
                selectedRecipe && addRecipeAsMeal.mutate({ 
                  recipe: selectedRecipe, 
                  type: mealType, 
                  portion: selectedPortion 
                });
              }}
              disabled={addRecipeAsMeal.isPending}
              className="w-full bg-gradient-primary hover:opacity-90 text-white border-0"
            >
              Добавить {Math.round(selectedPortion * 100)}% порции
            </Button>
            <Button
              onClick={() => {
                setPortionDialogOpen(false);
                selectedRecipe && addRecipeAsMeal.mutate({ 
                  recipe: selectedRecipe, 
                  type: mealType, 
                  portion: 1.0 
                });
              }}
              disabled={addRecipeAsMeal.isPending}
              variant="outline"
              className="w-full"
            >
              Добавить полную порцию
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setPortionDialogOpen(false)}
              className="w-full"
            >
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Recipes;
