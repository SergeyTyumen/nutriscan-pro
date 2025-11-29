-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (связана с auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  daily_calorie_goal INTEGER NOT NULL DEFAULT 2000,
  daily_protein_goal INTEGER NOT NULL DEFAULT 150,
  daily_fat_goal INTEGER NOT NULL DEFAULT 65,
  daily_carbs_goal INTEGER NOT NULL DEFAULT 250,
  daily_water_goal INTEGER NOT NULL DEFAULT 2000,
  current_weight DECIMAL(5,2),
  target_weight DECIMAL(5,2),
  height INTEGER,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')) DEFAULT 'moderate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create reference_items table (эталонные предметы для измерения)
CREATE TABLE public.reference_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  real_size_cm DECIMAL(5,2) NOT NULL,
  image_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reference_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reference items"
  ON public.reference_items FOR ALL
  USING (auth.uid() = user_id);

-- Create meals table (приёмы пищи)
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_time TIME NOT NULL DEFAULT CURRENT_TIME,
  total_calories INTEGER NOT NULL DEFAULT 0,
  total_protein DECIMAL(6,2) NOT NULL DEFAULT 0,
  total_fat DECIMAL(6,2) NOT NULL DEFAULT 0,
  total_carbs DECIMAL(6,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own meals"
  ON public.meals FOR ALL
  USING (auth.uid() = user_id);

-- Create meal_foods table (детали продуктов в приёме пищи)
CREATE TABLE public.meal_foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  quantity DECIMAL(8,2) NOT NULL,
  unit TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein DECIMAL(6,2) NOT NULL DEFAULT 0,
  fat DECIMAL(6,2) NOT NULL DEFAULT 0,
  carbs DECIMAL(6,2) NOT NULL DEFAULT 0,
  photo_url TEXT,
  barcode TEXT,
  added_via TEXT CHECK (added_via IN ('photo', 'voice', 'barcode', 'manual', 'recipe')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meal_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage foods in their meals"
  ON public.meal_foods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.meals
      WHERE meals.id = meal_foods.meal_id
      AND meals.user_id = auth.uid()
    )
  );

-- Create saved_recipes table (сохранённые рецепты)
CREATE TABLE public.saved_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_name TEXT NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  total_calories INTEGER NOT NULL,
  total_protein DECIMAL(6,2) NOT NULL DEFAULT 0,
  total_fat DECIMAL(6,2) NOT NULL DEFAULT 0,
  total_carbs DECIMAL(6,2) NOT NULL DEFAULT 0,
  ingredients JSONB NOT NULL,
  photo_url TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recipes"
  ON public.saved_recipes FOR ALL
  USING (auth.uid() = user_id);

-- Create water_log table (учёт воды)
CREATE TABLE public.water_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_ml INTEGER NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  log_time TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.water_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own water logs"
  ON public.water_log FOR ALL
  USING (auth.uid() = user_id);

-- Create achievements table (достижения)
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  icon TEXT
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (true);

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_meals_user_date ON public.meals(user_id, meal_date DESC);
CREATE INDEX idx_water_log_user_date ON public.water_log(user_id, log_date DESC);
CREATE INDEX idx_meal_foods_meal_id ON public.meal_foods(meal_id);
CREATE INDEX idx_reference_items_user_id ON public.reference_items(user_id);
CREATE INDEX idx_achievements_user_id ON public.achievements(user_id, earned_at DESC);