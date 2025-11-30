import { Home, Camera, TrendingUp, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const BottomNav = () => {
  const location = useLocation();

  const links = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/camera', icon: Camera, label: 'Камера' },
    { path: '/stats', icon: TrendingUp, label: 'Статистика' },
    { path: '/profile', icon: User, label: 'Профиль' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl transition-all ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20' : ''}`} />
                <span className="text-xs font-medium">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
