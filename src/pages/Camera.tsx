import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera as CameraIcon, ArrowLeft, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type FoodItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type AnalysisResult = {
  foods: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  mealType: string;
  notes: string;
};

const Camera = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsAnalyzing(true);

    try {
      // Загружаем фото в Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('meal-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('meal-photos')
        .getPublicUrl(fileName);

      console.log('Image uploaded to:', publicUrl);

      // Анализируем через GPT-4o Vision
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-food', {
        body: { imageUrl: publicUrl }
      });

      if (analysisError) throw analysisError;

      console.log('Analysis result:', analysisData);
      setAnalysisResult(analysisData);
      toast.success('Еда распознана! 🎉');

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Ошибка при анализе фото');
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMeal = async () => {
    if (!analysisResult || !user || !capturedImage) return;

    setIsSaving(true);

    try {
      // Создаём приём пищи
      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          meal_type: analysisResult.mealType,
          total_calories: analysisResult.totalCalories,
          total_protein: analysisResult.totalProtein,
          total_fat: analysisResult.totalFat,
          total_carbs: analysisResult.totalCarbs,
          notes: analysisResult.notes,
        })
        .select()
        .single();

      if (mealError) throw mealError;

      // Добавляем все продукты
      const foodsToInsert = analysisResult.foods.map(food => ({
        meal_id: meal.id,
        food_name: food.name,
        quantity: food.quantity,
        unit: food.unit,
        calories: food.calories,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs,
        added_via: 'camera',
        photo_url: capturedImage,
      }));

      const { error: foodsError } = await supabase
        .from('meal_foods')
        .insert(foodsToInsert);

      if (foodsError) throw foodsError;

      toast.success('Приём пищи сохранён!');
      navigate('/');

    } catch (error: any) {
      console.error('Error saving meal:', error);
      toast.error('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-foreground">Сфотографировать еду</h1>
        </div>

        {!capturedImage ? (
          <Card className="bg-card p-8 shadow-md border-border text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-primary flex items-center justify-center">
              <CameraIcon className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Выберите фото еды</h2>
            <p className="text-muted-foreground mb-6">
              AI автоматически распознает блюда и рассчитает калории, БЖУ
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="lg"
              className="bg-gradient-primary hover:opacity-90 text-white border-0 rounded-2xl"
            >
              <CameraIcon className="mr-2" />
              Открыть камеру
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="bg-card p-4 shadow-md border-border overflow-hidden">
              <img 
                src={capturedImage} 
                alt="Captured meal" 
                className="w-full rounded-2xl"
              />
            </Card>

            {isAnalyzing && (
              <Card className="bg-card p-6 shadow-md border-border text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-foreground font-medium">Анализирую фото...</p>
                <p className="text-sm text-muted-foreground">GPT-4o Vision работает</p>
              </Card>
            )}

            {analysisResult && (
              <Card className="bg-card p-6 shadow-md border-border">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Распознано!</h3>
                    <p className="text-sm text-muted-foreground">{analysisResult.notes}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-muted rounded-2xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Калории</p>
                    <p className="text-2xl font-bold text-foreground">{analysisResult.totalCalories}</p>
                  </div>
                  <div className="bg-muted rounded-2xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Тип</p>
                    <p className="text-lg font-semibold text-foreground capitalize">{analysisResult.mealType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-gradient-warm text-white rounded-xl p-2 text-center">
                    <p className="text-xs opacity-90">Белки</p>
                    <p className="text-lg font-bold">{Math.round(analysisResult.totalProtein)}г</p>
                  </div>
                  <div className="bg-gradient-gold text-white rounded-xl p-2 text-center">
                    <p className="text-xs opacity-90">Жиры</p>
                    <p className="text-lg font-bold">{Math.round(analysisResult.totalFat)}г</p>
                  </div>
                  <div className="bg-gradient-cool text-white rounded-xl p-2 text-center">
                    <p className="text-xs opacity-90">Углеводы</p>
                    <p className="text-lg font-bold">{Math.round(analysisResult.totalCarbs)}г</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <h4 className="font-semibold text-sm">Продукты:</h4>
                  {analysisResult.foods.map((food, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-muted rounded-xl p-3">
                      <div>
                        <p className="font-medium">{food.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {food.quantity}{food.unit}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{food.calories} ккал</p>
                        <p className="text-xs text-muted-foreground">
                          Б: {food.protein}г Ж: {food.fat}г У: {food.carbs}г
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setCapturedImage(null);
                      setAnalysisResult(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Переснять
                  </Button>
                  <Button
                    onClick={handleSaveMeal}
                    disabled={isSaving}
                    className="flex-1 bg-gradient-primary hover:opacity-90 text-white border-0"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" />
                        Сохраняю...
                      </>
                    ) : (
                      'Сохранить'
                    )}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Camera;