import { cn } from '@/lib/utils';

export const avatars = [
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
    <div className="grid grid-cols-6 gap-3 p-2">
      {avatars.map((avatar) => (
        <button
          key={avatar}
          type="button"
          onClick={() => onSelect(avatar)}
          className={cn(
            "aspect-square rounded-xl flex items-center justify-center text-3xl transition-all hover:scale-110",
            "border-2 hover:border-primary/50",
            selectedAvatar === avatar
              ? "border-primary bg-primary/10 scale-105 shadow-md"
              : "border-border bg-card"
          )}
        >
          {avatar}
        </button>
      ))}
    </div>
  );
}
