import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Bell, Clock, Droplet, Award, BarChart3, Save, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { notificationService } from '@/services/notificationService';
import { isNativePlatform } from '@/utils/platform';

export const NotificationSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [permissionStatus, setPermissionStatus] = useState<any>(null);
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [lastError, setLastError] = useState<string>('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('No user');
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // Создаем настройки, если их нет
        const { data: newSettings, error: insertError } = await supabase
          .from('notification_settings')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        return newSettings;
      }

      return data;
    },
    enabled: !!user?.id && isNativePlatform(),
  });

  const [formData, setFormData] = useState({
    push_enabled: true,
    meal_reminders_enabled: true,
    breakfast_time: '08:00',
    lunch_time: '13:00',
    dinner_time: '19:00',
    snack_time: '',
    water_reminders_enabled: true,
    water_reminder_frequency: 120,
    water_reminder_start: '08:00',
    water_reminder_end: '22:00',
    achievement_notifications_enabled: true,
    motivation_notifications_enabled: true,
    daily_stats_enabled: true,
    daily_stats_time: '20:00',
  });

  // Helper to convert HH:MM:SS from DB to HH:MM for input
  const formatTimeForInput = (time: string | null) => {
    if (!time) return '';
    return time.substring(0, 5); // Get HH:MM from HH:MM:SS
  };

  useEffect(() => {
    if (settings) {
      setFormData({
        push_enabled: settings.push_enabled,
        meal_reminders_enabled: settings.meal_reminders_enabled,
        breakfast_time: formatTimeForInput(settings.breakfast_time) || '08:00',
        lunch_time: formatTimeForInput(settings.lunch_time) || '13:00',
        dinner_time: formatTimeForInput(settings.dinner_time) || '19:00',
        snack_time: formatTimeForInput(settings.snack_time) || '',
        water_reminders_enabled: settings.water_reminders_enabled,
        water_reminder_frequency: settings.water_reminder_frequency,
        water_reminder_start: formatTimeForInput(settings.water_reminder_start) || '08:00',
        water_reminder_end: formatTimeForInput(settings.water_reminder_end) || '22:00',
        achievement_notifications_enabled: settings.achievement_notifications_enabled,
        motivation_notifications_enabled: settings.motivation_notifications_enabled,
        daily_stats_enabled: settings.daily_stats_enabled,
        daily_stats_time: formatTimeForInput(settings.daily_stats_time) || '20:00',
      });

      // НЕ инициализируем сервис автоматически - только при явном включении
    }
  }, [settings]);

  const initializeService = async () => {
    if (!isNativePlatform()) return;
    
    try {
      // Проверяем доступность плагинов перед инициализацией
      const availability = await notificationService.isAvailable();
      if (!availability.available) {
        toast.error('Плагины уведомлений недоступны', {
          description: availability.error || 'Выполните `npx cap sync android` и пересоберите приложение'
        });
        setLastError(availability.error || 'Plugins not available');
        return;
      }

      await notificationService.initialize();
      
      // Проверяем разрешения
      const permissions = await notificationService.checkPermissions();
      setPermissionStatus(permissions);
      
      // Получаем количество запланированных уведомлений
      const scheduled = await notificationService.getScheduledNotifications();
      setScheduledCount(scheduled.length);
      
      console.log('Notification service initialized, permissions:', permissions);
      console.log('Scheduled notifications:', scheduled.length);
    } catch (error: any) {
      console.error('Failed to initialize notification service:', error);
      toast.error('Ошибка инициализации уведомлений', {
        description: error.message || 'Неизвестная ошибка'
      });
      setLastError(error.message || 'Unknown error');
    }
  };

  // Helper to convert HH:MM to HH:MM:SS for database
  const formatTimeForDb = (time: string) => {
    if (!time) return null;
    return time.includes(':00') ? time : `${time}:00`;
  };

  const updateSettings = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user?.id) throw new Error('No user');

      // Если включаем уведомления впервые, инициализируем сервис
      if (data.push_enabled && !settings?.push_enabled) {
        const availability = await notificationService.isAvailable();
        if (!availability.available) {
          throw new Error(availability.error || 'Notification plugins not available');
        }
        await notificationService.initialize();
      }

      // Convert time format for database (HH:MM:SS)
      const dbData = {
        ...data,
        breakfast_time: formatTimeForDb(data.breakfast_time),
        lunch_time: formatTimeForDb(data.lunch_time),
        dinner_time: formatTimeForDb(data.dinner_time),
        snack_time: data.snack_time ? formatTimeForDb(data.snack_time) : null,
        water_reminder_start: formatTimeForDb(data.water_reminder_start),
        water_reminder_end: formatTimeForDb(data.water_reminder_end),
        daily_stats_time: formatTimeForDb(data.daily_stats_time),
      };

      const { error } = await supabase
        .from('notification_settings')
        .update(dbData)
        .eq('user_id', user.id);

      if (error) throw error;

      // Обновляем запланированные уведомления
      if (data.push_enabled) {
        await notificationService.scheduleNotifications(data as any, user.id);
        
        // Обновляем статус после планирования
        const scheduled = await notificationService.getScheduledNotifications();
        setScheduledCount(scheduled.length);
      } else {
        await notificationService.cancelAllNotifications();
        setScheduledCount(0);
      }
    },
    onSuccess: () => {
      toast.success('Настройки сохранены!');
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
    onError: (error: any) => {
      toast.error('Ошибка при сохранении');
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate(formData);
  };

  // Не инициализируем автоматически - только при включении уведомлений

  if (!isNativePlatform()) {
    return (
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="text-center text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Push-уведомления доступны только в мобильном приложении</p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Основные настройки */}
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Уведомления</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
            <div>
              <Label>Включить уведомления</Label>
              <p className="text-sm text-muted-foreground">
                Получать напоминания и уведомления
              </p>
            </div>
            <Switch
              checked={formData.push_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, push_enabled: checked })}
            />
          </div>

          {/* Статус уведомлений */}
          {lastError && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
              <div className="text-sm font-medium text-destructive mb-2">❌ Ошибка</div>
              <div className="text-xs text-destructive/80 break-words mb-2">{lastError}</div>
              <p className="text-xs text-muted-foreground">
                💡 Выполните <code className="bg-muted px-1 rounded">npx cap sync android</code> и пересоберите приложение
              </p>
            </div>
          )}

          {permissionStatus && (
            <div className="p-4 rounded-2xl bg-secondary/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Разрешения:</span>
                <span className={`text-sm ${
                  permissionStatus.local === 'granted' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {permissionStatus.local === 'granted' ? '✓ Предоставлены' : '✗ Не предоставлены'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Запланировано:</span>
                <span className="text-sm text-foreground">
                  {scheduledCount} уведомлений
                </span>
              </div>
              {permissionStatus.local !== 'granted' && (
                <p className="text-xs text-orange-500 mt-2">
                  ⚠️ Разрешите уведомления в настройках телефона
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Напоминания о приемах пищи */}
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Напоминания о приемах пищи</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
            <Label>Включить напоминания</Label>
            <Switch
              checked={formData.meal_reminders_enabled}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, meal_reminders_enabled: checked })
              }
              disabled={!formData.push_enabled}
            />
          </div>

          {formData.meal_reminders_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="breakfast_time">Завтрак</Label>
                <Input
                  id="breakfast_time"
                  type="time"
                  value={formData.breakfast_time}
                  onChange={(e) => setFormData({ ...formData, breakfast_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lunch_time">Обед</Label>
                <Input
                  id="lunch_time"
                  type="time"
                  value={formData.lunch_time}
                  onChange={(e) => setFormData({ ...formData, lunch_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dinner_time">Ужин</Label>
                <Input
                  id="dinner_time"
                  type="time"
                  value={formData.dinner_time}
                  onChange={(e) => setFormData({ ...formData, dinner_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="snack_time">Перекус (опц.)</Label>
                <Input
                  id="snack_time"
                  type="time"
                  value={formData.snack_time}
                  onChange={(e) => setFormData({ ...formData, snack_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Напоминания о воде */}
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="flex items-center gap-2 mb-4">
          <Droplet className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Напоминания о воде</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
            <Label>Включить напоминания</Label>
            <Switch
              checked={formData.water_reminders_enabled}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, water_reminders_enabled: checked })
              }
              disabled={!formData.push_enabled}
            />
          </div>

          {formData.water_reminders_enabled && (
            <>
              <div>
                <Label htmlFor="water_frequency">Частота напоминаний</Label>
                <Select
                  value={formData.water_reminder_frequency.toString()}
                  onValueChange={(value) => 
                    setFormData({ ...formData, water_reminder_frequency: Number(value) })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">Каждый час</SelectItem>
                    <SelectItem value="120">Каждые 2 часа</SelectItem>
                    <SelectItem value="180">Каждые 3 часа</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="water_start">С</Label>
                  <Input
                    id="water_start"
                    type="time"
                    value={formData.water_reminder_start}
                    onChange={(e) => 
                      setFormData({ ...formData, water_reminder_start: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="water_end">До</Label>
                  <Input
                    id="water_end"
                    type="time"
                    value={formData.water_reminder_end}
                    onChange={(e) => 
                      setFormData({ ...formData, water_reminder_end: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Другие уведомления */}
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Другие уведомления</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
            <div>
              <Label>Достижения</Label>
              <p className="text-sm text-muted-foreground">Уведомления о достижениях</p>
            </div>
            <Switch
              checked={formData.achievement_notifications_enabled}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, achievement_notifications_enabled: checked })
              }
              disabled={!formData.push_enabled}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
            <div>
              <Label>Мотивация</Label>
              <p className="text-sm text-muted-foreground">Мотивирующие сообщения</p>
            </div>
            <Switch
              checked={formData.motivation_notifications_enabled}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, motivation_notifications_enabled: checked })
              }
              disabled={!formData.push_enabled}
            />
          </div>
        </div>
      </Card>

      {/* Статистика дня */}
      <Card className="bg-card p-6 shadow-md border-border">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Статистика дня</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
            <Label>Ежедневная сводка</Label>
            <Switch
              checked={formData.daily_stats_enabled}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, daily_stats_enabled: checked })
              }
              disabled={!formData.push_enabled}
            />
          </div>

          {formData.daily_stats_enabled && (
            <div>
              <Label htmlFor="stats_time">Время отправки</Label>
              <Input
                id="stats_time"
                type="time"
                value={formData.daily_stats_time}
                onChange={(e) => setFormData({ ...formData, daily_stats_time: e.target.value })}
                className="mt-1"
              />
            </div>
          )}
        </div>
      </Card>

      <Button
        type="submit"
        disabled={updateSettings.isPending}
        className="w-full bg-gradient-primary hover:opacity-90 text-white border-0"
      >
        {updateSettings.isPending ? (
          <>
            <Loader2 className="mr-2 animate-spin" />
            Сохранение...
          </>
        ) : (
          <>
            <Save className="mr-2" />
            Сохранить настройки
          </>
        )}
      </Button>
    </form>
  );
};
