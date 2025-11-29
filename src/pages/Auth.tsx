import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Ошибка входа',
            description: error.message === 'Invalid login credentials' 
              ? 'Неверный email или пароль' 
              : error.message,
          });
        } else {
          toast({
            title: 'Успешный вход!',
            description: 'Добро пожаловать обратно',
          });
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Ошибка регистрации',
            description: error.message === 'User already registered'
              ? 'Пользователь с таким email уже существует'
              : error.message,
          });
        } else {
          toast({
            title: 'Регистрация успешна!',
            description: 'Вы можете войти в систему',
          });
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-muted p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl shadow-lg p-8">
          <div className="mb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md">
              <span className="text-4xl">🍎</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {isLogin ? 'Вход' : 'Регистрация'}
            </h1>
            <p className="text-muted-foreground">
              {isLogin ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Имя</Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Введите ваше имя"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 rounded-2xl"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-2xl"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-2xl"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-gradient-primary text-white font-semibold shadow-md hover:shadow-lg transition-all"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Загрузка...</span>
                </div>
              ) : (
                isLogin ? 'Войти' : 'Зарегистрироваться'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? (
                <>
                  Нет аккаунта?{' '}
                  <span className="font-semibold text-primary">Зарегистрируйтесь</span>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{' '}
                  <span className="font-semibold text-primary">Войдите</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
