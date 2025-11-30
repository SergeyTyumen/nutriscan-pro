import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNativePlatform, getPlatform } from '@/utils/platform';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationSettings {
  push_enabled: boolean;
  meal_reminders_enabled: boolean;
  breakfast_time: string;
  lunch_time: string;
  dinner_time: string;
  snack_time?: string | null;
  water_reminders_enabled: boolean;
  water_reminder_frequency: number;
  water_reminder_start: string;
  water_reminder_end: string;
  achievement_notifications_enabled: boolean;
  motivation_notifications_enabled: boolean;
  daily_stats_enabled: boolean;
  daily_stats_time: string;
  push_token?: string | null;
  device_platform?: string | null;
}

class NotificationService {
  private isInitialized = false;

  async initialize() {
    if (!isNativePlatform() || this.isInitialized) return;

    try {
      // Запрашиваем разрешения на уведомления
      const permResult = await LocalNotifications.requestPermissions();
      if (permResult.display !== 'granted') {
        console.warn('Local notifications permission denied');
        return;
      }

      // Запрашиваем разрешения на push-уведомления
      const pushPermResult = await PushNotifications.requestPermissions();
      if (pushPermResult.receive === 'granted') {
        await PushNotifications.register();
        
        // Слушаем регистрацию токена
        PushNotifications.addListener('registration', async (token) => {
          console.log('Push token:', token.value);
          await this.savePushToken(token.value);
        });

        // Слушаем ошибки регистрации
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Слушаем получение push-уведомлений
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });
      }

      this.isInitialized = true;
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  private async savePushToken(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notification_settings')
        .update({
          push_token: token,
          device_platform: getPlatform()
        })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  }

  async scheduleNotifications(settings: NotificationSettings, userId: string) {
    if (!isNativePlatform()) return;

    try {
      // Отменяем все существующие уведомления
      await LocalNotifications.cancel({ notifications: await this.getPendingNotifications() });

      const notifications: any[] = [];
      let notificationId = 1;

      // Напоминания о приемах пищи
      if (settings.meal_reminders_enabled) {
        if (settings.breakfast_time) {
          notifications.push(this.createMealNotification(
            notificationId++,
            'Завтрак',
            'Время позавтракать! 🍳',
            settings.breakfast_time
          ));
        }
        if (settings.lunch_time) {
          notifications.push(this.createMealNotification(
            notificationId++,
            'Обед',
            'Время пообедать! 🍽️',
            settings.lunch_time
          ));
        }
        if (settings.dinner_time) {
          notifications.push(this.createMealNotification(
            notificationId++,
            'Ужин',
            'Время поужинать! 🍲',
            settings.dinner_time
          ));
        }
        if (settings.snack_time) {
          notifications.push(this.createMealNotification(
            notificationId++,
            'Перекус',
            'Время для перекуса! 🥗',
            settings.snack_time
          ));
        }
      }

      // Напоминания о воде
      if (settings.water_reminders_enabled) {
        const waterNotifications = this.createWaterNotifications(
          notificationId,
          settings.water_reminder_start,
          settings.water_reminder_end,
          settings.water_reminder_frequency
        );
        notifications.push(...waterNotifications);
        notificationId += waterNotifications.length;
      }

      // Статистика дня
      if (settings.daily_stats_enabled && settings.daily_stats_time) {
        notifications.push(this.createDailyStatsNotification(
          notificationId++,
          settings.daily_stats_time
        ));
      }

      // Планируем все уведомления
      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.log(`Scheduled ${notifications.length} notifications`);
      }
    } catch (error) {
      console.error('Failed to schedule notifications:', error);
    }
  }

  private createMealNotification(id: number, title: string, body: string, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const schedule = new Date();
    schedule.setHours(hours, minutes, 0, 0);

    // Если время уже прошло сегодня, планируем на завтра
    if (schedule < new Date()) {
      schedule.setDate(schedule.getDate() + 1);
    }

    return {
      id,
      title,
      body,
      schedule: { at: schedule, repeats: true },
      sound: 'default',
      actionTypeId: 'meal_reminder',
    };
  }

  private createWaterNotifications(
    startId: number,
    startTime: string,
    endTime: string,
    frequencyMinutes: number
  ) {
    const notifications: any[] = [];
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startMinutesTotal = startHours * 60 + startMinutes;
    const endMinutesTotal = endHours * 60 + endMinutes;

    let currentMinutes = startMinutesTotal;
    let id = startId;

    while (currentMinutes <= endMinutesTotal) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;

      const schedule = new Date();
      schedule.setHours(hours, minutes, 0, 0);

      if (schedule < new Date()) {
        schedule.setDate(schedule.getDate() + 1);
      }

      notifications.push({
        id: id++,
        title: 'Время пить воду',
        body: 'Не забудьте выпить воды! 💧',
        schedule: { at: schedule, repeats: true },
        sound: 'default',
        actionTypeId: 'water_reminder',
      });

      currentMinutes += frequencyMinutes;
    }

    return notifications;
  }

  private createDailyStatsNotification(id: number, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const schedule = new Date();
    schedule.setHours(hours, minutes, 0, 0);

    if (schedule < new Date()) {
      schedule.setDate(schedule.getDate() + 1);
    }

    return {
      id,
      title: 'Ваша статистика',
      body: 'Посмотрите свой прогресс за сегодня! 📊',
      schedule: { at: schedule, repeats: true },
      sound: 'default',
      actionTypeId: 'daily_stats',
    };
  }

  private async getPendingNotifications() {
    try {
      const result = await LocalNotifications.getPending();
      return result.notifications;
    } catch (error) {
      console.error('Failed to get pending notifications:', error);
      return [];
    }
  }

  async sendAchievementNotification(title: string, body: string) {
    if (!isNativePlatform()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from('notification_settings')
        .select('achievement_notifications_enabled')
        .eq('user_id', user.id)
        .single();

      if (!settings?.achievement_notifications_enabled) return;

      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 100000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          actionTypeId: 'achievement',
        }]
      });
    } catch (error) {
      console.error('Failed to send achievement notification:', error);
    }
  }

  async sendMotivationNotification(message: string) {
    if (!isNativePlatform()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: settings } = await supabase
        .from('notification_settings')
        .select('motivation_notifications_enabled')
        .eq('user_id', user.id)
        .single();

      if (!settings?.motivation_notifications_enabled) return;

      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 100000),
          title: 'Мотивация',
          body: message,
          schedule: { at: new Date(Date.now() + 1000) },
          sound: 'default',
          actionTypeId: 'motivation',
        }]
      });
    } catch (error) {
      console.error('Failed to send motivation notification:', error);
    }
  }

  async cancelAllNotifications() {
    if (!isNativePlatform()) return;

    try {
      const pending = await this.getPendingNotifications();
      if (pending.length > 0) {
        await LocalNotifications.cancel({ notifications: pending });
        console.log('All notifications cancelled');
      }
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
