import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const avatars = [
  '🍎', '🥑', '🥕', '🍓', '🥗', '🍊',
  '🥦', '🍇', '🍋', '🫐', '🥒', '🍑',
  '🌶️', '🥬', '🍅', '🫑', '🥝', '🍌',
  '🥩', '🍗', '🥚', '🧀', '🥛', '🍵'
];

interface AvatarPickerProps {
  selectedAvatar: string;
  onSelect: (avatar: string) => void;
}

export function AvatarPicker({ selectedAvatar, onSelect }: AvatarPickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg">
          <AvatarFallback className="text-5xl bg-gradient-to-br from-primary/10 to-accent/10">
            {selectedAvatar || '🍎'}
          </AvatarFallback>
        </Avatar>
      </div>
      
      <div className="grid grid-cols-6 gap-2">
        {avatars.map((avatar) => (
          <button
            key={avatar}
            type="button"
            onClick={() => onSelect(avatar)}
            className={cn(
              "aspect-square rounded-2xl flex items-center justify-center text-2xl transition-all hover:scale-110",
              "border-2 hover:border-primary/50",
              selectedAvatar === avatar
                ? "border-primary bg-primary/10 scale-110 shadow-md"
                : "border-border bg-card"
            )}
          >
            {avatar}
          </button>
        ))}
      </div>
    </div>
  );
}
