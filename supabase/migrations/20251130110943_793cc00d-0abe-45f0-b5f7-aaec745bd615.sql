-- Create food database table for common food items
CREATE TABLE public.food_database (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  calories_per_100g INTEGER NOT NULL,
  protein_per_100g NUMERIC NOT NULL DEFAULT 0,
  fat_per_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_per_100g NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.food_database ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read from food database
CREATE POLICY "Food database is viewable by everyone" 
ON public.food_database 
FOR SELECT 
USING (true);

-- Create index for faster search
CREATE INDEX idx_food_database_name ON public.food_database USING gin(to_tsvector('russian', name));

-- Insert common Russian food items
INSERT INTO public.food_database (name, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, category) VALUES
('Куриная грудка', 165, 31, 3.6, 0, 'Мясо'),
('Говядина', 250, 26, 15, 0, 'Мясо'),
('Свинина', 242, 16, 21, 0, 'Мясо'),
('Лосось', 208, 20, 13, 0, 'Рыба'),
('Тунец', 144, 23, 6, 0, 'Рыба'),
('Яйцо куриное', 155, 13, 11, 1.1, 'Яйца'),
('Молоко 2.5%', 52, 2.8, 2.5, 4.7, 'Молочные продукты'),
('Творог 5%', 121, 16, 5, 1.8, 'Молочные продукты'),
('Йогурт натуральный', 61, 5, 3.2, 3.5, 'Молочные продукты'),
('Сыр российский', 363, 24, 29, 0.3, 'Молочные продукты'),
('Рис белый', 130, 2.7, 0.3, 28, 'Крупы'),
('Гречка', 123, 4.5, 1.6, 25, 'Крупы'),
('Овсянка', 68, 2.4, 1.4, 12, 'Крупы'),
('Макароны', 158, 5.8, 0.9, 31, 'Крупы'),
('Хлеб белый', 265, 8.1, 3.2, 49, 'Хлеб'),
('Хлеб ржаной', 259, 6.6, 1.2, 49, 'Хлеб'),
('Картофель', 77, 2, 0.4, 16, 'Овощи'),
('Помидор', 18, 0.9, 0.2, 3.9, 'Овощи'),
('Огурец', 15, 0.8, 0.1, 2.8, 'Овощи'),
('Морковь', 41, 0.9, 0.2, 9.6, 'Овощи'),
('Капуста белокочанная', 27, 1.8, 0.1, 4.7, 'Овощи'),
('Брокколи', 34, 2.8, 0.4, 7, 'Овощи'),
('Банан', 89, 1.1, 0.3, 23, 'Фрукты'),
('Яблоко', 52, 0.3, 0.4, 14, 'Фрукты'),
('Апельсин', 47, 0.9, 0.2, 12, 'Фрукты'),
('Авокадо', 160, 2, 15, 9, 'Фрукты'),
('Орехи грецкие', 654, 15, 65, 14, 'Орехи'),
('Миндаль', 579, 21, 50, 22, 'Орехи'),
('Арахис', 567, 26, 49, 16, 'Орехи'),
('Оливковое масло', 884, 0, 100, 0, 'Масла');