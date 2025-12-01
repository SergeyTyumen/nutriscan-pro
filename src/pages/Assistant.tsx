import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Send, Image as ImageIcon, Loader2, Volume2, Sparkles, TrendingUp, Target, Heart, ArrowLeft, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  foodData?: FoodAnalysis;
  actions?: string[]; // AI actions like "Added water", "Added meal"
};

type FoodItem = {
  name: string;
  quantity: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type FoodAnalysis = {
  foods: FoodItem[];
  description: string;
};

const Assistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Привет! Я твой персональный диет-коуч 🥗\n\nЯ помогу тебе:\n• Достигать целей по питанию\n• Анализировать твой рацион\n• Составлять планы на день\n• Поддерживать мотивацию\n\nЧто будем делать сегодня?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>('');
  const [currentFoodData, setCurrentFoodData] = useState<FoodAnalysis | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null); // Index of message being spoken
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch today's stats
  const { data: todayStats } = useQuery({
    queryKey: ['assistant-today-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const today = new Date().toISOString().split('T')[0];

      // Get today's meals
      const { data: meals } = await supabase
        .from('meals')
        .select('total_calories, total_protein, total_fat, total_carbs')
        .eq('user_id', user.id)
        .eq('meal_date', today);

      // Get today's water
      const { data: water } = await supabase
        .from('water_log')
        .select('amount_ml')
        .eq('user_id', user.id)
        .eq('log_date', today);

      // Get profile goals
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_calorie_goal, daily_water_goal')
        .eq('id', user.id)
        .single();

      const totalCalories = meals?.reduce((sum, m) => sum + m.total_calories, 0) || 0;
      const totalWater = water?.reduce((sum, w) => sum + w.amount_ml, 0) || 0;
      const mealsCount = meals?.length || 0;

      return {
        calories: totalCalories,
        caloriesGoal: profile?.daily_calorie_goal || 2000,
        water: totalWater,
        waterGoal: profile?.daily_water_goal || 2000,
        mealsCount
      };
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string, image?: string) => {
    if (!user) {
      toast({
        title: 'Ошибка',
        description: 'Необходима авторизация',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    const newUserMessage: Message = { 
      role: 'user', 
      content: userMessage,
      ...(image && { image })
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [...messages, newUserMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          ...(image && { image })
        }
      });

      if (invokeError) {
        throw invokeError;
      }

      if (!response) {
        throw new Error('No response received');
      }

      // Проверяем разные форматы ответа
      const responseText = response.response || response.message || response.content;
      
      if (responseText) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: responseText
        }]);
      } else {
        throw new Error('No valid response format');
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение',
        variant: 'destructive'
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setSelectedImage(null);
    }
  };

  const analyzeFoodImage = async (image: string) => {
    if (!user) {
      toast({
        title: 'Ошибка',
        description: 'Необходима авторизация',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: foodData, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [
            {
              role: 'user',
              content: 'Проанализируй эту еду и определи продукты с калориями и БЖУ'
            }
          ],
          image,
          analyzeFood: true
        }
      });

      if (error) {
        throw error;
      }

      if (!foodData) {
        throw new Error('No food data received');
      }
      
      const totalCalories = foodData.foods.reduce((sum, f) => sum + f.calories, 0);
      const totalProtein = foodData.foods.reduce((sum, f) => sum + f.protein, 0);
      const totalFat = foodData.foods.reduce((sum, f) => sum + f.fat, 0);
      const totalCarbs = foodData.foods.reduce((sum, f) => sum + f.carbs, 0);

      const analysisText = `${foodData.description}\n\nОбнаружено:\n${foodData.foods.map(f => 
        `• ${f.name} (${f.quantity}г): ${f.calories} ккал, Б: ${f.protein}г, Ж: ${f.fat}г, У: ${f.carbs}г`
      ).join('\n')}\n\nВсего: ${totalCalories} ккал, Б: ${totalProtein.toFixed(1)}г, Ж: ${totalFat.toFixed(1)}г, У: ${totalCarbs.toFixed(1)}г`;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: analysisText,
        foodData
      }]);

      setCurrentFoodData(foodData);
      
    } catch (error) {
      console.error('Food analysis error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось проанализировать еду',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setSelectedImage(null);
    }
  };

  const addToMealDiary = async () => {
    if (!currentFoodData || !selectedMealType || !user) return;

    try {
      setIsLoading(true);

      const totalCalories = currentFoodData.foods.reduce((sum, f) => sum + f.calories, 0);
      const totalProtein = currentFoodData.foods.reduce((sum, f) => sum + f.protein, 0);
      const totalFat = currentFoodData.foods.reduce((sum, f) => sum + f.fat, 0);
      const totalCarbs = currentFoodData.foods.reduce((sum, f) => sum + f.carbs, 0);

      const now = new Date();
      const { data: meal, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: user.id,
          meal_type: selectedMealType,
          meal_date: now.toISOString().split('T')[0],
          meal_time: now.toTimeString().split(' ')[0],
          total_calories: totalCalories,
          total_protein: totalProtein,
          total_fat: totalFat,
          total_carbs: totalCarbs,
          notes: currentFoodData.description
        })
        .select()
        .single();

      if (mealError) throw mealError;

      const foodItems = currentFoodData.foods.map(food => ({
        meal_id: meal.id,
        food_name: food.name,
        quantity: food.quantity,
        unit: 'г',
        calories: food.calories,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs,
        added_via: 'ai_analysis'
      }));

      const { error: foodsError } = await supabase
        .from('meal_foods')
        .insert(foodItems);

      if (foodsError) throw foodsError;

      toast({
        title: 'Успешно',
        description: 'Еда добавлена в дневник питания'
      });

      setShowAddDialog(false);
      setCurrentFoodData(null);
      
      navigate('/');

    } catch (error) {
      console.error('Add to diary error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить в дневник',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;
    
    const messageText = input.trim() || 'Проанализируй эту еду';
    setInput('');

    // If there's an image and the message is about food analysis
    if (selectedImage && (messageText.toLowerCase().includes('еда') || 
        messageText.toLowerCase().includes('калории') || 
        messageText.toLowerCase().includes('проанализ') ||
        messageText === 'Проанализируй эту еду')) {
      
      setMessages(prev => [...prev, {
        role: 'user',
        content: messageText,
        image: selectedImage
      }]);

      await analyzeFoodImage(selectedImage);
    } else {
      await streamChat(messageText, selectedImage || undefined);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось начать запись',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        const { data, error } = await supabase.functions.invoke('voice-to-text', {
          body: { audio: base64Audio }
        });

        if (error) {
          throw error;
        }

        if (!data?.text) {
          throw new Error('No transcription text received');
        }

        setInput(data.text);
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось распознать речь',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const speakText = async (text: string, messageIndex: number) => {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setIsSpeaking(messageIndex);

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice: 'alena' }
      });

      if (error) {
        throw error;
      }

      if (!data?.audioContent) {
        throw new Error('No audio content received');
      }

      const audioContent = data.audioContent;
      
      // Convert base64 to audio and play
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: 'Ошибка',
          description: 'Не удалось воспроизвести аудио',
          variant: 'destructive'
        });
      };

      await audio.play();

    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(null);
      toast({
        title: 'Ошибка',
        description: 'Не удалось озвучить текст',
        variant: 'destructive'
      });
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(null);
  };

  const quickActions = [
    {
      label: 'План на день',
      prompt: 'Составь мне план питания на сегодня с учётом моих целей',
      icon: Target
    },
    {
      label: 'Что улучшить?',
      prompt: 'Проанализируй мой рацион за последние 7 дней и скажи, что можно улучшить',
      icon: TrendingUp
    },
    {
      label: 'Мотивация',
      prompt: 'Мне нужна мотивация. Помоги мне не сбиться с пути к цели',
      icon: Heart
    }
  ];

  const handleQuickAction = async (prompt: string) => {
    setInput('');
    await streamChat(prompt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted pb-20">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-2xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Диет-коуч</h1>
        </div>

        {/* Today's Summary */}
        {todayStats && (
          <Card className="bg-gradient-primary/10 p-5 mb-4 border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Сегодня</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Калории</p>
                <p className="text-lg font-bold text-foreground">
                  {todayStats.calories}
                  <span className="text-sm font-normal text-muted-foreground"> / {todayStats.caloriesGoal}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Вода</p>
                <p className="text-lg font-bold text-foreground">
                  {Math.round(todayStats.water / 1000 * 10) / 10}
                  <span className="text-sm font-normal text-muted-foreground">L / {todayStats.waterGoal / 1000}L</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Приёмов</p>
                <p className="text-lg font-bold text-foreground">{todayStats.mealsCount}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Быстрые действия</h3>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5 hover:bg-accent hover:border-primary transition-all"
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={isLoading}
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-medium text-center leading-tight">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <Card className="h-[calc(100vh-450px)] flex flex-col">
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.image && (
                          <img 
                            src={message.image} 
                            alt="Uploaded" 
                            className="max-w-full rounded-lg mb-2"
                          />
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      
                      {message.role === 'assistant' && message.content && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            if (isSpeaking === index) {
                              stopSpeaking();
                            } else {
                              speakText(message.content, index);
                            }
                          }}
                          disabled={isSpeaking !== null && isSpeaking !== index}
                        >
                          <Volume2 className={`w-4 h-4 ${isSpeaking === index ? 'text-primary animate-pulse' : ''}`} />
                        </Button>
                      )}
                    </div>
                    
                    {message.actions && message.actions.length > 0 && (
                      <div className="space-y-1">
                        {message.actions.map((action, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 rounded-lg px-3 py-1.5"
                          >
                            <span className="text-primary">✓</span>
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {message.foodData && message.role === 'assistant' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-fit"
                        onClick={() => {
                          setCurrentFoodData(message.foodData!);
                          setShowAddDialog(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Добавить в дневник
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            {/* Quick Actions */}
            {messages.length === 1 && !isLoading && (
              <div className="mb-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInput('Сколько я съел сегодня?');
                  }}
                  className="text-xs"
                >
                  📊 Статистика дня
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInput('Добавь стакан воды');
                  }}
                  className="text-xs"
                >
                  💧 Добавить воду
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInput('Мой прогресс за неделю');
                  }}
                  className="text-xs"
                >
                  📈 Прогресс недели
                </Button>
              </div>
            )}

            {selectedImage && (
              <div className="mb-2 relative inline-block">
                <img 
                  src={selectedImage} 
                  alt="Selected" 
                  className="max-h-20 rounded-lg"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                  onClick={() => setSelectedImage(null)}
                >
                  ×
                </Button>
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              
              <Button
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <ImageIcon className="w-5 h-5" />
              </Button>

              <Button
                size="icon"
                variant={isRecording ? 'destructive' : 'outline'}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
              >
                <Mic className="w-5 h-5" />
              </Button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Напишите сообщение..."
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={isLoading}
                className="flex-1"
              />

              <Button
                size="icon"
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !selectedImage)}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить в дневник питания</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Тип приема пищи</label>
                <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите прием пищи" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Завтрак</SelectItem>
                    <SelectItem value="lunch">Обед</SelectItem>
                    <SelectItem value="dinner">Ужин</SelectItem>
                    <SelectItem value="snack">Перекус</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentFoodData && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium mb-2">{currentFoodData.description}</p>
                  <div className="text-xs space-y-1">
                    {currentFoodData.foods.map((food, idx) => (
                      <div key={idx}>
                        • {food.name} ({food.quantity}г) - {food.calories} ккал
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isLoading}
              >
                Отмена
              </Button>
              <Button
                onClick={addToMealDiary}
                disabled={!selectedMealType || isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Добавить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Assistant;
