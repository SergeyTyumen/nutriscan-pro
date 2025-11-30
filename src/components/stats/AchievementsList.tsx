import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Trophy, Star, Flame, Target } from 'lucide-react';

type Achievement = {
  id: string;
  achievement_name: string;
  achievement_type: string;
  description: string | null;
  icon: string | null;
  earned_at: string;
};

type Props = {
  achievements: Achievement[];
};

const getAchievementIcon = (type: string) => {
  switch (type) {
    case 'streak':
      return <Flame className="w-6 h-6" />;
    case 'goal':
      return <Target className="w-6 h-6" />;
    case 'milestone':
      return <Star className="w-6 h-6" />;
    default:
      return <Trophy className="w-6 h-6" />;
  }
};

const getGradientClass = (type: string) => {
  switch (type) {
    case 'streak':
      return 'bg-gradient-warm';
    case 'goal':
      return 'bg-gradient-primary';
    case 'milestone':
      return 'bg-gradient-gold';
    default:
      return 'bg-gradient-cool';
  }
};

export const AchievementsList = ({ achievements }: Props) => {
  if (achievements.length === 0) {
    return (
      <Card className="bg-card p-8 shadow-md border-border text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Trophy className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Пока нет достижений</h3>
        <p className="text-sm text-muted-foreground">
          Продолжайте отслеживать питание, и вы получите первые награды!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {achievements.map((achievement) => (
        <Card
          key={achievement.id}
          className="bg-card p-4 shadow-md border-border hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl ${getGradientClass(achievement.achievement_type)} flex items-center justify-center text-white flex-shrink-0`}>
              {achievement.icon || getAchievementIcon(achievement.achievement_type)}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">{achievement.achievement_name}</h4>
              {achievement.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {achievement.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(achievement.earned_at), 'd MMMM yyyy', { locale: ru })}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};