import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

type MealData = {
  meal_date: string;
  total_calories: number;
  total_protein: number;
  total_fat: number;
  total_carbs: number;
};

type Props = {
  data: MealData[];
  period: 'week' | 'month';
};

export const CaloriesChart = ({ data, period }: Props) => {
  // Группируем данные по дням
  const groupedData = data.reduce((acc, meal) => {
    const date = meal.meal_date;
    if (!acc[date]) {
      acc[date] = { date, calories: 0 };
    }
    acc[date].calories += meal.total_calories;
    return acc;
  }, {} as Record<string, { date: string; calories: number }>);

  const chartData = Object.values(groupedData).map(item => ({
    date: format(new Date(item.date), period === 'week' ? 'EEE' : 'dd MMM', { locale: ru }),
    calories: item.calories,
  }));

  const averageCalories = chartData.length > 0
    ? Math.round(chartData.reduce((sum, item) => sum + item.calories, 0) / chartData.length)
    : 0;

  const totalCalories = chartData.reduce((sum, item) => sum + item.calories, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-primary p-4 text-white shadow-md border-0">
          <p className="text-sm opacity-90 mb-1">Среднее в день</p>
          <p className="text-3xl font-bold">{averageCalories}</p>
          <p className="text-xs opacity-75 mt-1">ккал</p>
        </Card>
        <Card className="bg-gradient-warm p-4 text-white shadow-md border-0">
          <p className="text-sm opacity-90 mb-1">Всего за период</p>
          <p className="text-3xl font-bold">{totalCalories}</p>
          <p className="text-xs opacity-75 mt-1">ккал</p>
        </Card>
      </div>

      <Card className="bg-card p-6 shadow-md border-border">
        <h3 className="font-semibold mb-4 text-foreground">Калории по дням</h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>Нет данных за выбранный период</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="calories"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                name="Калории"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};