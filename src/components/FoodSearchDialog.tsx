import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

interface FoodSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FoodSearchDialog({ open, onOpenChange }: FoodSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [quantity, setQuantity] = useState("100");
  const [mealType, setMealType] = useState("breakfast");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: foods, isLoading } = useQuery({
    queryKey: ["food-database", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("food_database")
        .select("*")
        .order("name");

      if (searchQuery.trim()) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const addFoodMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedFood) return;

      const multiplier = parseFloat(quantity) / 100;
      const totalCalories = Math.round(selectedFood.calories_per_100g * multiplier);
      const totalProtein = (selectedFood.protein_per_100g * multiplier).toFixed(1);
      const totalFat = (selectedFood.fat_per_100g * multiplier).toFixed(1);
      const totalCarbs = (selectedFood.carbs_per_100g * multiplier).toFixed(1);

      // Create new meal
      const { data: meal, error: mealError } = await supabase
        .from("meals")
        .insert({
          user_id: user.id,
          meal_type: mealType,
          meal_date: new Date().toISOString().split("T")[0],
          meal_time: new Date().toTimeString().split(" ")[0],
          total_calories: totalCalories,
          total_protein: parseFloat(totalProtein),
          total_fat: parseFloat(totalFat),
          total_carbs: parseFloat(totalCarbs),
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Add food to meal
      const { error: foodError } = await supabase.from("meal_foods").insert({
        meal_id: meal.id,
        food_name: selectedFood.name,
        quantity: parseFloat(quantity),
        unit: "г",
        calories: totalCalories,
        protein: parseFloat(totalProtein),
        fat: parseFloat(totalFat),
        carbs: parseFloat(totalCarbs),
        added_via: "manual",
      });

      if (foodError) throw foodError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      toast.success("Продукт добавлен в дневник питания");
      setSelectedFood(null);
      setQuantity("100");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error adding food:", error);
      toast.error("Не удалось добавить продукт");
    },
  });

  const handleSelectFood = (food: any) => {
    setSelectedFood(food);
  };

  const handleAddFood = () => {
    if (!selectedFood || !quantity) return;
    addFoodMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Поиск продуктов</DialogTitle>
        </DialogHeader>

        {!selectedFood ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Введите название продукта..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {foods?.map((food) => (
                  <Card
                    key={food.id}
                    className="p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleSelectFood(food)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{food.name}</h3>
                        <p className="text-sm text-muted-foreground">{food.category}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold text-primary">{food.calories_per_100g} ккал</p>
                        <p className="text-xs text-muted-foreground">
                          Б: {food.protein_per_100g}г Ж: {food.fat_per_100g}г У: {food.carbs_per_100g}г
                        </p>
                        <p className="text-xs text-muted-foreground">на 100г</p>
                      </div>
                    </div>
                  </Card>
                ))}
                {foods?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Продукты не найдены
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">{selectedFood.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{selectedFood.category}</p>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Калории</p>
                  <p className="font-semibold">{selectedFood.calories_per_100g}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Белки</p>
                  <p className="font-semibold">{selectedFood.protein_per_100g}г</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Жиры</p>
                  <p className="font-semibold">{selectedFood.fat_per_100g}г</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Углеводы</p>
                  <p className="font-semibold">{selectedFood.carbs_per_100g}г</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">на 100г продукта</p>
            </Card>

            <div className="space-y-4">
              <div>
                <Label htmlFor="quantity">Количество (граммы)</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="1"
                  step="1"
                />
              </div>

              <div>
                <Label htmlFor="mealType">Тип приёма пищи</Label>
                <Select value={mealType} onValueChange={setMealType}>
                  <SelectTrigger id="mealType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Завтрак</SelectItem>
                    <SelectItem value="lunch">Обед</SelectItem>
                    <SelectItem value="dinner">Ужин</SelectItem>
                    <SelectItem value="snack">Перекус</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {quantity && (
                <Card className="p-4 bg-primary/5">
                  <p className="text-sm font-medium mb-2">Итого для {quantity}г:</p>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Калории</p>
                      <p className="font-semibold">
                        {Math.round(selectedFood.calories_per_100g * (parseFloat(quantity) / 100))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Белки</p>
                      <p className="font-semibold">
                        {(selectedFood.protein_per_100g * (parseFloat(quantity) / 100)).toFixed(1)}г
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Жиры</p>
                      <p className="font-semibold">
                        {(selectedFood.fat_per_100g * (parseFloat(quantity) / 100)).toFixed(1)}г
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Углеводы</p>
                      <p className="font-semibold">
                        {(selectedFood.carbs_per_100g * (parseFloat(quantity) / 100)).toFixed(1)}г
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedFood(null)}>
                Назад
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddFood}
                disabled={addFoodMutation.isPending || !quantity}
              >
                {addFoodMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Добавление...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
