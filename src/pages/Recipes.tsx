import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Star, Plus, Trash2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    mutationFn: async ({ recipe, type }: { recipe: any; type: string }) => {
      // Создаём новый приём пищи
      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user?.id,
          meal_type: type,
          total_calories: recipe.total_calories,
          total_protein: recipe.total_protein,
          total_fat: recipe.total_fat,
          total_carbs: recipe.total_carbs,
          notes: `Из рецепта: ${recipe.recipe_name}`,
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Добавляем все ингредиенты как продукты
      const ingredients = recipe.ingredients as any[];
      const foodsToInsert = ingredients.map((ing: any) => ({
        meal_id: meal.id,
        food_name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        calories: ing.calories,
        protein: ing.protein,
        fat: ing.fat,
        carbs: ing.carbs,
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

  const handleAddRecipe = (recipe: any) => {
    setSelectedRecipe(recipe);
    setMealType(recipe.meal_type || 'обед');
    setAddDialogOpen(true);
  };

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

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-card">
            <TabsTrigger value="all">
              Мои блюда ({allRecipes.length})
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Heart className="w-4 h-4 mr-1" />
              Избранное ({favoriteRecipes.length})
            </TabsTrigger>
          </TabsList>

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
    </div>
  );
};

export default Recipes;
