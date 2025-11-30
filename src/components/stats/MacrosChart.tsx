import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

export const MacrosChart = ({ data, period }: Props) => {
  // Группируем данные по дням
  const groupedData = data.reduce((acc, meal) => {
    const date = meal.meal_date;
    if (!acc[date]) {
      acc[date] = { 
        date, 
        protein: 0,
        fat: 0,
        carbs: 0,
      };
    }
    acc[date].protein += Number(meal.total_protein);
    acc[date].fat += Number(meal.total_fat);
    acc[date].carbs += Number(meal.total_carbs);
    return acc;
  }, {} as Record<string, { date: string; protein: number; fat: number; carbs: number }>);

  const chartData = Object.values(groupedData).map(item => ({
    date: format(new Date(item.date), period === 'week' ? 'EEE' : 'dd MMM', { locale: ru }),
    Белки: Math.round(item.protein),
    Жиры: Math.round(item.fat),
    Углеводы: Math.round(item.carbs),
  }));

  const totals = chartData.reduce(
    (acc, item) => ({
      protein: acc.protein + item.Белки,
      fat: acc.fat + item.Жиры,
      carbs: acc.carbs + item.Углеводы,
    }),
    { protein: 0, fat: 0, carbs: 0 }
  );

  const averages = {
    protein: chartData.length > 0 ? Math.round(totals.protein / chartData.length) : 0,
    fat: chartData.length > 0 ? Math.round(totals.fat / chartData.length) : 0,
    carbs: chartData.length > 0 ? Math.round(totals.carbs / chartData.length) : 0,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-warm p-4 text-white shadow-md border-0">
          <p className="text-xs opacity-90 mb-1">Белки</p>
          <p className="text-2xl font-bold">{averages.protein}г</p>
          <p className="text-xs opacity-75 mt-1">в среднем</p>
        </Card>
        <Card className="bg-gradient-gold p-4 text-white shadow-md border-0">
          <p className="text-xs opacity-90 mb-1">Жиры</p>
          <p className="text-2xl font-bold">{averages.fat}г</p>
          <p className="text-xs opacity-75 mt-1">в среднем</p>
        </Card>
        <Card className="bg-gradient-cool p-4 text-white shadow-md border-0">
          <p className="text-xs opacity-90 mb-1">Углеводы</p>
          <p className="text-2xl font-bold">{averages.carbs}г</p>
          <p className="text-xs opacity-75 mt-1">в среднем</p>
        </Card>
      </div>

      <Card className="bg-card p-6 shadow-md border-border">
        <h3 className="font-semibold mb-4 text-foreground">БЖУ по дням</h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>Нет данных за выбранный период</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
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
              <Bar dataKey="Белки" fill="hsl(340 82% 52%)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Жиры" fill="hsl(45 93% 47%)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Углеводы" fill="hsl(204 94% 70%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};