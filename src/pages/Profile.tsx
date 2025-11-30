import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-edit', user?.id],
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

  const [formData, setFormData] = useState({
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                    <SelectValue />
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
            <h3 className="font-semibold text-lg mb-4">Цели по питанию</h3>
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
