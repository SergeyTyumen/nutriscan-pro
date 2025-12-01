-- Создание таблицы для планов питания
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'eaten')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Создание таблицы для элементов плана питания
CREATE TABLE meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  source TEXT CHECK (source IN ('recipe', 'food_database')),
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Включение RLS для meal_plans
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Политика для просмотра своих планов
CREATE POLICY "Users can view their own meal plans"
ON meal_plans
FOR SELECT
USING (auth.uid() = user_id);

-- Политика для создания своих планов
CREATE POLICY "Users can create their own meal plans"
ON meal_plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Политика для обновления своих планов
CREATE POLICY "Users can update their own meal plans"
ON meal_plans
FOR UPDATE
USING (auth.uid() = user_id);

-- Политика для удаления своих планов
CREATE POLICY "Users can delete their own meal plans"
ON meal_plans
FOR DELETE
USING (auth.uid() = user_id);

-- Включение RLS для meal_plan_items
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;

-- Политика для управления элементами плана
CREATE POLICY "Users can manage their meal plan items"
ON meal_plan_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM meal_plans
    WHERE meal_plans.id = meal_plan_items.plan_id
    AND meal_plans.user_id = auth.uid()
  )
);

-- Триггер для обновления updated_at
CREATE TRIGGER update_meal_plans_updated_at
BEFORE UPDATE ON meal_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Индексы для производительности
CREATE INDEX idx_meal_plans_user_date ON meal_plans(user_id, plan_date);
CREATE INDEX idx_meal_plans_status ON meal_plans(status);
CREATE INDEX idx_meal_plan_items_plan_id ON meal_plan_items(plan_id);