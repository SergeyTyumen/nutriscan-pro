import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Send, Image as ImageIcon, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
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
      content: 'Привет! Я твой персональный помощник по питанию. Могу помочь с расчетом калорий, дать рекомендации или проанализировать фото еды. Чем могу помочь?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>('');
  const [currentFoodData, setCurrentFoodData] = useState<FoodAnalysis | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamChat = async (userMessage: string, image?: string) => {
    setIsLoading(true);
    
    const newUserMessage: Message = { 
      role: 'user', 
      content: userMessage,
      ...(image && { image })
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, newUserMessage].map(m => ({
              role: m.role,
              content: m.content
            })),
            ...(image && { image })
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error('Failed to start stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: assistantContent
                };
                return newMessages;
              });
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
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
    setIsLoading(true);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: 'Проанализируй эту еду и определи продукты с калориями и БЖУ'
              }
            ],
            image,
            analyzeFood: true
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to analyze food');
      }

      const foodData: FoodAnalysis = await response.json();
      
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
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-to-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ audio: base64Audio }),
          }
        );

        if (!response.ok) {
          throw new Error('Transcription failed');
        }

        const { text } = await response.json();
        setInput(text);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted pb-20">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          AI Помощник
        </h1>

        <Card className="h-[calc(100vh-220px)] flex flex-col">
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex flex-col gap-2">
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
