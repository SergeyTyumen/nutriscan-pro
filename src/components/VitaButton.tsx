import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isNativePlatform } from '@/utils/platform';
import { useQuery } from '@tanstack/react-query';

type VitaState = 'idle' | 'listening' | 'processing' | 'speaking';

// Динамически загружаем SpeechRecognition только когда нужно
let SpeechRecognitionModule: any = null;

async function loadSpeechRecognition() {
  if (!isNativePlatform() || SpeechRecognitionModule) return SpeechRecognitionModule;
  
  try {
    const module = await import('@capacitor-community/speech-recognition');
    SpeechRecognitionModule = module.SpeechRecognition;
    return SpeechRecognitionModule;
  } catch (error) {
    console.error('Failed to load speech recognition:', error);
    return null;
  }
}

// Web Speech API для веб-платформы
const getWebSpeechRecognition = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return SpeechRecognition;
}

export const VitaButton = () => {
  const [state, setState] = useState<VitaState>('idle');
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionActiveRef = useRef(false);
  const webRecognitionRef = useRef<any>(null);
  const { toast } = useToast();

  // Load today's stats for context
  const { data: todayStats } = useQuery({
    queryKey: ['vita-context'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const today = new Date().toISOString().split('T')[0];

      const [mealsData, waterData, profileData] = await Promise.all([
        supabase.from('meals').select('total_calories, total_protein, total_fat, total_carbs').eq('user_id', user.id).eq('meal_date', today),
        supabase.from('water_log').select('amount_ml').eq('user_id', user.id).eq('log_date', today),
        supabase.from('profiles').select('daily_calorie_goal, daily_protein_goal, daily_fat_goal, daily_carbs_goal, daily_water_goal').eq('id', user.id).single()
      ]);

      const calories = mealsData.data?.reduce((sum, m) => sum + m.total_calories, 0) || 0;
      const protein = mealsData.data?.reduce((sum, m) => sum + m.total_protein, 0) || 0;
      const fat = mealsData.data?.reduce((sum, m) => sum + m.total_fat, 0) || 0;
      const carbs = mealsData.data?.reduce((sum, m) => sum + m.total_carbs, 0) || 0;
      const water = waterData.data?.reduce((sum, w) => sum + w.amount_ml, 0) || 0;

      return {
        calories: { consumed: calories, goal: profileData.data?.daily_calorie_goal || 2000 },
        protein: { consumed: Math.round(protein), goal: profileData.data?.daily_protein_goal || 150 },
        fat: { consumed: Math.round(fat), goal: profileData.data?.daily_fat_goal || 65 },
        carbs: { consumed: Math.round(carbs), goal: profileData.data?.daily_carbs_goal || 250 },
        water: { consumed: water, goal: profileData.data?.daily_water_goal || 2000 },
        mealsCount: mealsData.data?.length || 0
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Инициализация для нативной и веб платформы
  useEffect(() => {
    const initSpeechRecognition = async () => {
      if (isNativePlatform()) {
        // Нативная платформа
        try {
          const SpeechRecognition = await loadSpeechRecognition();
          if (!SpeechRecognition) return;

          const { available } = await SpeechRecognition.available();
          if (!available) {
            console.warn('Speech recognition not available');
            return;
          }

          const permission = await SpeechRecognition.requestPermissions();
          if (permission.speechRecognition !== 'granted') {
            console.warn('Speech recognition permission denied');
            return;
          }

          startWakeWordDetection();
        } catch (error) {
          console.error('Failed to initialize speech recognition:', error);
        }
      } else {
        // Веб-платформа - запрашиваем разрешение на микрофон
        try {
          const SpeechRecognition = getWebSpeechRecognition();
          if (!SpeechRecognition) {
            console.warn('Web Speech API not supported');
            toast({
              title: "Браузер не поддерживает",
              description: "Используйте Chrome/Edge для голосового управления",
              variant: "destructive"
            });
            return;
          }

          // Запрашиваем разрешение на микрофон
          await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('[WAKE WORD] Microphone permission granted');
          
          startWakeWordDetection();
        } catch (error) {
          console.error('[WAKE WORD] Microphone permission denied:', error);
          toast({
            title: "Нужен доступ к микрофону",
            description: "Нажмите на кнопку Вита для записи",
          });
        }
      }
    };

    initSpeechRecognition();

    return () => {
      stopWakeWordDetection();
    };
  }, []);

  const startWakeWordDetection = async () => {
    if (recognitionActiveRef.current) return;

    try {
      recognitionActiveRef.current = true;
      setIsListeningForWakeWord(true);

      if (isNativePlatform()) {
        // Нативная платформа
        const SpeechRecognition = await loadSpeechRecognition();
        if (!SpeechRecognition) return;

        SpeechRecognition.addListener('partialResults', (data: any) => {
          const text = data.matches?.join(' ').toLowerCase() || '';
          console.log('[WAKE WORD] Detecting:', text);

          if (text.includes('вита') && state === 'idle') {
            console.log('[WAKE WORD] Detected!');
            stopWakeWordDetection();
            startListening();
          }
        });

        await SpeechRecognition.start({
          language: 'ru-RU',
          partialResults: true,
          popup: false,
        });

        console.log('[WAKE WORD] Started (native)');
      } else {
        // Веб-платформа
        const SpeechRecognition = getWebSpeechRecognition();
        if (!SpeechRecognition) {
          recognitionActiveRef.current = false;
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'ru-RU';

        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('')
            .toLowerCase();

          console.log('[WAKE WORD] Detecting:', transcript);

          if (transcript.includes('вита') && state === 'idle') {
            console.log('[WAKE WORD] Detected!');
            stopWakeWordDetection();
            startListening();
          }
        };

        recognition.onerror = (event: any) => {
          console.error('[WAKE WORD] Error:', event.error);

          // Если браузер не дает использовать сервис речи — отключаем wake word
          if (event.error === 'network' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            recognitionActiveRef.current = false;
            setIsListeningForWakeWord(false);
            toast({
              title: 'Активация по "Вита" недоступна',
              description: 'В вашем браузере постоянноe прослушивание не поддерживается. Используйте кнопку Вита.',
              variant: 'destructive',
            });
            return;
          }

          if (event.error !== 'aborted') {
            recognitionActiveRef.current = false;
            setTimeout(() => {
              if (state === 'idle') startWakeWordDetection();
            }, 2000);
          }
        };

        recognition.onend = () => {
          console.log('[WAKE WORD] Ended, restarting...');
          if (recognitionActiveRef.current && state === 'idle') {
            setTimeout(() => startWakeWordDetection(), 500);
          }
        };

        webRecognitionRef.current = recognition;
        recognition.start();

        console.log('[WAKE WORD] Started (web)');
      }
    } catch (error) {
      console.error('[WAKE WORD] Failed to start:', error);
      recognitionActiveRef.current = false;
      
      setTimeout(() => {
        if (state === 'idle') startWakeWordDetection();
      }, 2000);
    }
  };

  const stopWakeWordDetection = async () => {
    if (!recognitionActiveRef.current) return;

    try {
      if (isNativePlatform()) {
        const SpeechRecognition = await loadSpeechRecognition();
        if (SpeechRecognition) {
          await SpeechRecognition.stop();
          SpeechRecognition.removeAllListeners();
        }
      } else {
        if (webRecognitionRef.current) {
          webRecognitionRef.current.stop();
          webRecognitionRef.current = null;
        }
      }
      
      recognitionActiveRef.current = false;
      setIsListeningForWakeWord(false);
      console.log('[WAKE WORD] Stopped');
    } catch (error) {
      console.error('[WAKE WORD] Failed to stop:', error);
    }
  };

  const startListening = async () => {
    try {
      console.log('[VITA] Начинаем прослушивание');
      
      toast({
        title: "Слушаю",
        description: "Говорите...",
      });
      
      setState('listening');
      
      // На нативной платформе используем SpeechRecognition
      if (isNativePlatform()) {
        const SpeechRecognition = await loadSpeechRecognition();
        if (!SpeechRecognition) {
          throw new Error('Speech recognition not available');
        }

        // Останавливаем wake word detection
        await stopWakeWordDetection();

        // Слушатель для результатов
        const resultListener = SpeechRecognition.addListener('partialResults', async (data: any) => {
          const text = data.matches?.[0] || '';
          console.log('[VITA] Частичный результат:', text);
          if (text) {
            console.log('[VITA] Распознан текст:', text);
            // Останавливаем распознавание
            await SpeechRecognition.stop();
            SpeechRecognition.removeAllListeners();
            // Обрабатываем команду
            await processVoiceCommand(text);
          }
        });

        // Запускаем распознавание на 5 секунд
        await SpeechRecognition.start({
          language: 'ru-RU',
          partialResults: true,
          popup: false,
        });

        // Автоматическая остановка через 5 секунд
        setTimeout(async () => {
          try {
            await SpeechRecognition.stop();
            SpeechRecognition.removeAllListeners();
            if (state === 'listening') {
              toast({
                title: "Ничего не распознано",
                description: "Попробуйте еще раз",
              });
              setState('idle');
              setTimeout(() => startWakeWordDetection(), 1000);
            }
          } catch (e) {
            console.error('Error stopping recognition:', e);
          }
        }, 5000);

      } else {
        // На веб-платформе используем MediaRecorder
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());
          await processAudio(audioBlob);
        };

        mediaRecorder.start();

        // Автоматическая остановка через 5 секунд
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 5000);
      }

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось получить доступ к микрофону",
        variant: "destructive"
      });
      setState('idle');
      
      // Перезапускаем прослушивание wake word
      if (isNativePlatform()) {
        setTimeout(() => startWakeWordDetection(), 1000);
      }
    }
  };

  const processVoiceCommand = async (text: string) => {
    try {
      console.log('[VITA] Начинаем обработку команды:', text);
      
      toast({
        title: "Обрабатываю команду",
        description: `"${text}"`,
      });
      
      setState('processing');

      console.log('[VITA] Отправляем запрос в ai-assistant...');
      
      // Отправляем в AI ассистента с контекстом
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [
            { role: 'user', content: text }
          ],
          userContext: todayStats
        }
      });

      console.log('[VITA] Ответ от ai-assistant:', { aiResponse, aiError });

      if (aiError) {
        console.error('[VITA] AI error:', aiError);
        toast({
          title: "Ошибка AI",
          description: aiError.message || 'Сервер недоступен',
          variant: "destructive"
        });
        throw new Error('Failed to get AI response');
      }

      if (!aiResponse) {
        console.error('[VITA] No AI response');
        toast({
          title: "Нет ответа",
          description: "AI не вернул ответ",
          variant: "destructive"
        });
        throw new Error('No AI response received');
      }

      console.log('[VITA] AI response успешно получен:', aiResponse);
      
      toast({
        title: "Озвучиваю ответ",
        description: "Готово!",
      });

      // Озвучиваем ответ
      setState('speaking');
      await speakResponse(aiResponse.response || aiResponse.message || 'Не удалось получить ответ');

    } catch (error: any) {
      console.error('Processing error:', error);
      
      // Показываем дружественную ошибку пользователю
      if (error.message?.includes('429') || error.status === 429) {
        toast({
          title: "Слишком много запросов",
          description: "Попробуйте позже",
          variant: "destructive"
        });
      } else if (error.message?.includes('402') || error.status === 402) {
        toast({
          title: "Превышен лимит",
          description: "Пополните баланс",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось обработать команду",
          variant: "destructive"
        });
      }
      
      setState('idle');
      
      // Перезапускаем прослушивание
      if (isNativePlatform()) {
        setTimeout(() => startWakeWordDetection(), 1000);
      }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      setState('processing');

      // Конвертируем в base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to convert audio');
        }

        try {
          // Отправляем на распознавание
          const { data: transcription, error: transcriptionError } = await supabase.functions.invoke('voice-to-text', {
            body: { audio: base64Audio }
          });

          if (transcriptionError) {
            console.error('Transcription error:', transcriptionError);
            throw new Error('Failed to transcribe audio');
          }

          if (!transcription?.text) {
            throw new Error('No transcription text received');
          }

          console.log('Transcribed text:', transcription.text);

          // Отправляем в AI ассистента с контекстом
          const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
            body: { 
              messages: [
                { role: 'user', content: transcription.text }
              ],
              userContext: todayStats
            }
          });

          if (aiError) {
            console.error('AI error:', aiError);
            throw new Error('Failed to get AI response');
          }

          if (!aiResponse) {
            throw new Error('No AI response received');
          }

          console.log('AI response:', aiResponse);

          // Озвучиваем ответ
          setState('speaking');
          await speakResponse(aiResponse.response || aiResponse.message);

        } catch (error: any) {
          console.error('Processing error:', error);
          
          // Показываем дружественную ошибку пользователю
          if (error.message?.includes('429') || error.status === 429) {
            toast({
              title: "Слишком много запросов",
              description: "Попробуйте позже",
              variant: "destructive"
            });
          } else if (error.message?.includes('402') || error.status === 402) {
            toast({
              title: "Превышен лимит",
              description: "Пополните баланс",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Ошибка",
              description: "Не удалось обработать команду",
              variant: "destructive"
            });
          }
          
          setState('idle');
          
          // Перезапускаем прослушивание
          if (isNativePlatform()) {
            setTimeout(() => startWakeWordDetection(), 1000);
          }
        }
      };

    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обработать команду",
        variant: "destructive"
      });
      setState('idle');
      
      // Перезапускаем прослушивание
      if (isNativePlatform()) {
        setTimeout(() => startWakeWordDetection(), 1000);
      }
    }
  };

  const speakResponse = async (text: string) => {
    try {
      // Очищаем markdown форматирование перед озвучкой
      const cleanText = text
        .replace(/\*\*/g, '') // Убираем **
        .replace(/\*/g, '')   // Убираем *
        .replace(/#{1,6}\s/g, '') // Убираем заголовки
        .replace(/`{1,3}/g, '') // Убираем код
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Заменяем ссылки на текст
        .trim();
      
      console.log('[VITA] Запрос озвучки (очищенный):', cleanText);
      
      const { data: audioData, error: audioError } = await supabase.functions.invoke('text-to-speech', {
        body: { text: cleanText, voice: 'alena' }
      });

      console.log('[VITA] Ответ text-to-speech:', { audioData, audioError });

      if (audioError || !audioData?.audioContent) {
        console.error('[VITA] Text-to-speech error:', audioError);
        toast({
          title: "Ошибка озвучки",
          description: audioError?.message || 'Сервер недоступен',
          variant: "destructive"
        });
        throw new Error('Failed to generate speech');
      }

      console.log('[VITA] Аудио получено, воспроизводим');

      // Воспроизводим аудио
      const audio = new Audio(`data:audio/mp3;base64,${audioData.audioContent}`);
      
      audio.onended = () => {
        setState('idle');
        // Перезапускаем прослушивание wake word после озвучки
        if (isNativePlatform()) {
          setTimeout(() => startWakeWordDetection(), 500);
        }
      };

      audio.onerror = () => {
        setState('idle');
        if (isNativePlatform()) {
          setTimeout(() => startWakeWordDetection(), 500);
        }
      };

      await audio.play();

    } catch (error) {
      console.error('Error speaking response:', error);
      setState('idle');
      if (isNativePlatform()) {
        setTimeout(() => startWakeWordDetection(), 500);
      }
    }
  };

  const getButtonContent = () => {
    switch (state) {
      case 'listening':
        return (
          <div className="relative">
            <Mic className="w-5 h-5" />
            <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-25" />
          </div>
        );
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'speaking':
        return (
          <div className="relative">
            <span className="text-lg">🔊</span>
            <span className="absolute inset-0 animate-pulse rounded-full bg-current opacity-25" />
          </div>
        );
      default:
        return <Mic className="w-5 h-5" />;
    }
  };

  const getButtonColor = () => {
    switch (state) {
      case 'listening':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500';
      case 'processing':
        return 'bg-gradient-to-r from-orange-500 to-amber-500';
      case 'speaking':
        return 'bg-gradient-to-r from-purple-500 to-pink-500';
      default:
        return 'bg-gradient-to-r from-purple-500 to-pink-500';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={startListening}
        disabled={state !== 'idle'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white shadow-md transition-all ${getButtonColor()} ${
          state !== 'idle' ? 'animate-pulse' : 'hover:scale-105'
        }`}
        title={state === 'idle' ? 'Скажите "Вита" или нажмите' : 'Обработка...'}
      >
        {getButtonContent()}
        <span className="text-xs font-semibold">Вита</span>
      </button>
      
      {/* Индикатор прослушивания wake word */}
      {isListeningForWakeWord && state === 'idle' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" 
             title="Слушаю команду 'Вита'">
          <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
        </div>
      )}
    </div>
  );
};
