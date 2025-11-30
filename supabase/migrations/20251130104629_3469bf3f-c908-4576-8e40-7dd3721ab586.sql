-- Создаём storage bucket для фотографий еды
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-photos', 'meal-photos', true);

-- Политики для загрузки и просмотра фото
CREATE POLICY "Users can upload their meal photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'meal-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their meal photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'meal-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view meal photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'meal-photos');

CREATE POLICY "Users can delete their meal photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'meal-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);