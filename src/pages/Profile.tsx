import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save, Loader2, Moon, Sun, Palette, Edit2, Bell, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { AvatarPicker } from '@/components/AvatarPicker';
import { useTheme } from '@/components/ThemeProvider';

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isCalculatingGoals, setIsCalculatingGoals] = useState(false);
  const [goalType, setGoalType] = useState<'lose' | 'maintain' | 'gain'>('maintain');

  const { data: profile, isLoading, error: profileError } = useQuery({
    queryKey: ['profile-edit', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    retry: 2,
  });

  const [formData, setFormData] = useState({
    avatar_url: '',
    display_name: '',
    age: '',
    gender: '',
    height: '',
    current_weight: '',
    target_weight: '',
    activity_level: 'moderate',
    daily_calorie_goal: 2000,
    daily_protein_goal: 150,
    daily_fat_goal: 65,
    daily_carbs_goal: 250,
    daily_water_goal: 2000,
  });

  // Обновляем formData когда загрузится профиль
  useEffect(() => {
    if (profile) {
      setFormData({
        avatar_url: profile.avatar_url || '🍎',
        display_name: profile.display_name || '',
        age: profile.age?.toString() || '',
        gender: profile.gender || '',
        height: profile.height?.toString() || '',
        current_weight: profile.current_weight?.toString() || '',
        target_weight: profile.target_weight?.toString() || '',
        activity_level: profile.activity_level || 'moderate',
        daily_calorie_goal: profile.daily_calorie_goal || 2000,
        daily_protein_goal: profile.daily_protein_goal || 150,
        daily_fat_goal: profile.daily_fat_goal || 65,
        daily_carbs_goal: profile.daily_carbs_goal || 250,
        daily_water_goal: profile.daily_water_goal || 2000,
      });
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: data.avatar_url || null,
          display_name: data.display_name || null,
          age: data.age ? Number(data.age) : null,
          gender: data.gender || null,
          height: data.height ? Number(data.height) : null,
          current_weight: data.current_weight ? Number(data.current_weight) : null,
          target_weight: data.target_weight ? Number(data.target_weight) : null,
          activity_level: data.activity_level,
          daily_calorie_goal: Number(data.daily_calorie_goal),
          daily_protein_goal: Number(data.daily_protein_goal),
          daily_fat_goal: Number(data.daily_fat_goal),
          daily_carbs_goal: Number(data.daily_carbs_goal),
          daily_water_goal: Number(data.daily_water_goal),
        })
        .eq('id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Профиль обновлён!');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile-edit'] });
    },
    onError: (error: any) => {
      toast.error('Ошибка при сохранении');
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(formData);
  };

  const calculateGoalsWithAI = async () => {
    const missingFields = [];
    if (!formData.age) missingFields.push('Возраст');
    if (!formData.gender) missingFields.push('Пол');
    if (!formData.height) missingFields.push('Рост');
    if (!formData.current_weight) missingFields.push('Вес');
    if (!formData.activity_level) missingFields.push('Уровень активности');
    
    if (missingFields.length > 0) {
      toast.error(`Заполните: ${missingFields.join(', ')}`);
      return;
    }

    setIsCalculatingGoals(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-goals', {
        body: {
          age: Number(formData.age),
          gender: formData.gender,
          height: Number(formData.height),
          currentWeight: Number(formData.current_weight),
          targetWeight: formData.target_weight ? Number(formData.target_weight) : null,
          activityLevel: formData.activity_level,
          goal: goalType === 'lose' ? 'похудение' : goalType === 'gain' ? 'набор массы' : 'поддержание веса'
        }
      });

      if (error) throw error;

      setFormData({
        ...formData,
        daily_calorie_goal: data.dailyCalories,
        daily_protein_goal: data.protein,
        daily_fat_goal: data.fat,
        daily_carbs_goal: data.carbs,
        daily_water_goal: data.water,
      });

      toast.success(data.explanation || 'Цели рассчитаны!');
    } catch (error: any) {
      console.error('Error calculating goals:', error);
      toast.error(error.message || 'Ошибка при расчете целей');
    } finally {
      setIsCalculatingGoals(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Необходима авторизация</p>
          <Button onClick={() => navigate('/auth')}>Войти</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Ошибка загрузки профиля</p>
          <Button onClick={() => navigate('/')}>На главную</Button>
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
          <h1 className="text-2xl font-bold text-foreground">Профиль</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="bg-card p-6 shadow-md border-border">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Внешний вид</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16 border-2 border-primary/20">
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-primary/10 to-accent/10">
                      {formData.avatar_url || '🍎'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Label>Аватар</Label>
                    <p className="text-sm text-muted-foreground">Выберите свой аватар</p>
                  </div>
                </div>
                <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Изменить
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Выберите аватар</DialogTitle>
                    </DialogHeader>
                    <AvatarPicker
                      selectedAvatar={formData.avatar_url}
                      onSelect={(avatar) => {
                        setFormData({ ...formData, avatar_url: avatar });
                        setIsAvatarDialogOpen(false);
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Moon className="h-5 w-5 text-primary" />
                  ) : (
                    <Sun className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <Label>Тёмная тема</Label>
                    <p className="text-sm text-muted-foreground">
                      {theme === 'dark' ? 'Включена' : 'Выключена'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
            </div>
          </Card>

          <Card className="bg-card p-6 shadow-md border-border">
            <h3 className="font-semibold text-lg mb-4">Личные данные</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="display_name">Имя</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Введите имя"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">Возраст</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="25"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Пол</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Выберите пол" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Мужской</SelectItem>
                      <SelectItem value="female">Женский</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="height">Рост (см)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    placeholder="175"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="current_weight">Вес (кг)</Label>
                  <Input
                    id="current_weight"
                    type="number"
                    step="0.1"
                    value={formData.current_weight}
                    onChange={(e) => setFormData({ ...formData, current_weight: e.target.value })}
                    placeholder="70"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="target_weight">Цель (кг)</Label>
                  <Input
                    id="target_weight"
                    type="number"
                    step="0.1"
                    value={formData.target_weight}
                    onChange={(e) => setFormData({ ...formData, target_weight: e.target.value })}
                    placeholder="65"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="activity_level">Уровень активности</Label>
                <Select
                  value={formData.activity_level}
                  onValueChange={(value) => setFormData({ ...formData, activity_level: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Выберите уровень активности" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Сидячий образ жизни</SelectItem>
                    <SelectItem value="light">Лёгкая активность</SelectItem>
                    <SelectItem value="moderate">Умеренная активность</SelectItem>
                    <SelectItem value="active">Высокая активность</SelectItem>
                    <SelectItem value="very_active">Очень высокая активность</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="bg-card p-6 shadow-md border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Цели по питанию</h3>
              <Button
                type="button"
                onClick={() => navigate('/profile/notifications')}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Bell className="w-4 h-4" />
                Уведомления
              </Button>
            </div>

            {/* Goal Type Selection */}
            <div className="mb-4">
              <Label>Ваша цель</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button
                  type="button"
                  variant={goalType === 'lose' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGoalType('lose')}
                  className={goalType === 'lose' ? 'bg-gradient-primary text-white border-0' : ''}
                >
                  Похудеть
                </Button>
                <Button
                  type="button"
                  variant={goalType === 'maintain' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGoalType('maintain')}
                  className={goalType === 'maintain' ? 'bg-gradient-primary text-white border-0' : ''}
                >
                  Удерживать
                </Button>
                <Button
                  type="button"
                  variant={goalType === 'gain' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGoalType('gain')}
                  className={goalType === 'gain' ? 'bg-gradient-primary text-white border-0' : ''}
                >
                  Набрать
                </Button>
              </div>
            </div>

            {/* AI Calculate Button */}
            <div className="bg-gradient-primary/10 rounded-2xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Рассчитать с ИИ</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Персональные рекомендации на основе ваших данных
                  </p>
                  <Button
                    type="button"
                    onClick={calculateGoalsWithAI}
                    disabled={isCalculatingGoals}
                    size="sm"
                    className="bg-gradient-primary hover:opacity-90 text-white border-0"
                  >
                    {isCalculatingGoals ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Расчёт...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Получить рекомендации
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="daily_calorie_goal">Калории (ккал/день)</Label>
                <Input
                  id="daily_calorie_goal"
                  type="number"
                  value={formData.daily_calorie_goal}
                  onChange={(e) => setFormData({ ...formData, daily_calorie_goal: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="daily_protein_goal">Белки (г)</Label>
                  <Input
                    id="daily_protein_goal"
                    type="number"
                    value={formData.daily_protein_goal}
                    onChange={(e) => setFormData({ ...formData, daily_protein_goal: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="daily_fat_goal">Жиры (г)</Label>
                  <Input
                    id="daily_fat_goal"
                    type="number"
                    value={formData.daily_fat_goal}
                    onChange={(e) => setFormData({ ...formData, daily_fat_goal: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="daily_carbs_goal">Углеводы (г)</Label>
                  <Input
                    id="daily_carbs_goal"
                    type="number"
                    value={formData.daily_carbs_goal}
                    onChange={(e) => setFormData({ ...formData, daily_carbs_goal: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="daily_water_goal">Вода (мл/день)</Label>
                <Input
                  id="daily_water_goal"
                  type="number"
                  value={formData.daily_water_goal}
                  onChange={(e) => setFormData({ ...formData, daily_water_goal: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={updateProfile.isPending}
              className="flex-1 bg-gradient-primary hover:opacity-90 text-white border-0"
            >
              {updateProfile.isPending ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="mr-2" />
                  Сохранить
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={signOut}
              variant="outline"
              className="flex-1"
            >
              Выйти
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
