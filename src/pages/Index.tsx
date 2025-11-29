import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md">
              <span className="text-2xl">🍎</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Calorie Tracker AI</h1>
              <p className="text-sm text-muted-foreground">
                Привет, {user?.user_metadata?.display_name || user?.email?.split('@')[0]}!
              </p>
            </div>
          </div>
          <Button
            onClick={signOut}
            variant="outline"
            size="icon"
            className="rounded-2xl"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h2 className="text-lg font-semibold mb-2">База данных готова!</h2>
            <p className="text-muted-foreground">
              Профили, приёмы пищи, референсы, рецепты, достижения — всё настроено.
            </p>
          </div>

          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h2 className="text-lg font-semibold mb-2">Авторизация работает</h2>
            <p className="text-muted-foreground">
              Email автоподтверждается, профили создаются автоматически.
            </p>
          </div>

          <div className="bg-card rounded-3xl p-6 shadow-soft">
            <h2 className="text-lg font-semibold mb-2">OpenAI готов</h2>
            <p className="text-muted-foreground">
              API ключ настроен, готово к распознаванию еды через GPT-4o Vision.
            </p>
          </div>
        </div>

        <div className="mt-8 bg-card rounded-3xl p-8 shadow-md">
          <h2 className="text-xl font-bold mb-4">Что дальше?</h2>
          <p className="text-muted-foreground mb-4">
            Этап 1 (Фундамент) завершён! Теперь можно переходить к:
          </p>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Этап 2: Дизайн-система с градиентами (в стиле Яндекс.Пэй)</li>
            <li>• Этап 3: Главный экран с калориями, водой, стриком</li>
            <li>• Этап 4: Камера и AI распознавание еды (GPT-4o Vision)</li>
            <li>• Этап 5: Голосовой ассистент</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Index;
