-- Fix UPDATE policy for notification_settings to include with_check
DROP POLICY IF EXISTS "Пользователи обновляют свои настр" ON notification_settings;

CREATE POLICY "Пользователи обновляют свои настройки"
ON notification_settings
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);