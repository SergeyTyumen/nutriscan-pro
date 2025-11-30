-- Создаем таблицу для настроек уведомлений
CREATE TABLE public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Общие настройки
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Напоминания о приемах пищи
  meal_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  breakfast_time TIME NOT NULL DEFAULT '08:00',
  lunch_time TIME NOT NULL DEFAULT '13:00',
  dinner_time TIME NOT NULL DEFAULT '19:00',
  snack_time TIME,
  
  -- Напоминания о воде
  water_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  water_reminder_frequency INTEGER NOT NULL DEFAULT 120, -- минуты
  water_reminder_start TIME NOT NULL DEFAULT '08:00',
  water_reminder_end TIME NOT NULL DEFAULT '22:00',
  
  -- Достижения и мотивация
  achievement_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  motivation_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Статистика дня
  daily_stats_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_stats_time TIME NOT NULL DEFAULT '20:00',
  
  -- Push token для FCM/APNS
  push_token TEXT,
  device_platform TEXT, -- 'android' | 'ios' | 'web'
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Включаем RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Пользователи видят свои настройки"
  ON public.notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Пользователи создают свои настройки"
  ON public.notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Пользователи обновляют свои настройки"
  ON public.notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Пользователи удаляют свои настройки"
  ON public.notification_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Триггер для updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Создаем настройки по умолчанию при создании профиля
CREATE OR REPLACE FUNCTION public.create_default_notification_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Триггер для автосоздания настроек
CREATE TRIGGER on_profile_created_notification_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_settings();

-- Индекс для быстрого поиска по user_id
CREATE INDEX idx_notification_settings_user_id ON public.notification_settings(user_id);

-- Добавляем уникальное ограничение
ALTER TABLE public.notification_settings ADD CONSTRAINT notification_settings_user_id_unique UNIQUE (user_id);