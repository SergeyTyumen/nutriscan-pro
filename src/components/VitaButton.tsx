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
  const [showDebug, setShowDebug] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string>('');
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionActiveRef = useRef(false);
  const webRecognitionRef = useRef<any>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Функция для добавления логов
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugLogs(prev => [...prev.slice(-9), logMessage]); // Оставляем последние 10
  };

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
            addLog('Speech recognition not available');
            setMicPermission('denied');
            return;
          }

          const permission = await SpeechRecognition.requestPermissions();
          if (permission.speechRecognition !== 'granted') {
            addLog('Speech recognition permission denied');
            setMicPermission('denied');
            return;
          }
          
          setMicPermission('granted');
          addLog('Native speech recognition initialized');

          startWakeWordDetection();
        } catch (error) {
          console.error('Failed to initialize speech recognition:', error);
        }
      } else {
        // Веб-платформа - запрашиваем разрешение на микрофон
        try {
          const SpeechRecognition = getWebSpeechRecognition();
          if (!SpeechRecognition) {
            addLog('Web Speech API not supported');
            setMicPermission('denied');
            toast({
              title: "Браузер не поддерживает",
              description: "Используйте Chrome/Edge для голосового управления",
              variant: "destructive"
            });
            return;
          }

          // Запрашиваем разрешение на микрофон
          await navigator.mediaDevices.getUserMedia({ audio: true });
          addLog('Microphone permission granted');
          setMicPermission('granted');
          
          startWakeWordDetection();
        } catch (error) {
          addLog(`Microphone permission error: ${error}`);
          setMicPermission('denied');
          setLastError(`Mic permission: ${error}`);
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
          addLog(`[WAKE WORD] Detecting: ${text}`);

          if (text.includes('вита') && state === 'idle') {
            addLog('[WAKE WORD] Detected!');
            stopWakeWordDetection();
            startListening();
          }
        });

        await SpeechRecognition.start({
          language: 'ru-RU',
          partialResults: true,
          popup: false,
        });

        addLog('[WAKE WORD] Started (native)');
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

          addLog(`[WAKE WORD] Detecting: ${transcript}`);

          if (transcript.includes('вита') && state === 'idle') {
            addLog('[WAKE WORD] Detected!');
            stopWakeWordDetection();
            startListening();
          }
        };

        recognition.onerror = (event: any) => {
          addLog(`[WAKE WORD] Error: ${event.error}`);
          setLastError(`Wake word error: ${event.error}`);

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
          addLog('[WAKE WORD] Ended, restarting...');
          if (recognitionActiveRef.current && state === 'idle') {
            setTimeout(() => startWakeWordDetection(), 500);
          }
        };

        webRecognitionRef.current = recognition;
        recognition.start();

        addLog('[WAKE WORD] Started (web)');
      }
    } catch (error) {
      addLog(`[WAKE WORD] Failed to start: ${error}`);
      setLastError(`Wake word start: ${error}`);
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
      addLog('[WAKE WORD] Stopped');
    } catch (error) {
      addLog(`[WAKE WORD] Failed to stop: ${error}`);
    }
  };

  const startListening = async () => {
    try {
      addLog('[VITA] Начинаем прослушивание');
      addLog(`[VITA] isNativePlatform: ${isNativePlatform()}`);
      addLog(`[VITA] Current state: ${state}`);
      
      toast({
        title: "Слушаю",
        description: "Говорите...",
      });
      
      setState('listening');
      
      // На нативной платформе используем SpeechRecognition
      if (isNativePlatform()) {
        addLog('[VITA] Используем нативное распознавание речи');
        const SpeechRecognition = await loadSpeechRecognition();
        if (!SpeechRecognition) {
          throw new Error('Speech recognition not available');
        }

        // Останавливаем wake word detection
        await stopWakeWordDetection();

        // Слушатель для результатов
        const resultListener = SpeechRecognition.addListener('partialResults', async (data: any) => {
          const text = data.matches?.[0] || '';
          addLog(`[VITA] Частичный результат: ${text}`);
          if (text) {
            addLog(`[VITA] Распознан текст: ${text}`);
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
            addLog(`Error stopping recognition: ${e}`);
          }
        }, 5000);

      } else {
        // На веб-платформе используем MediaRecorder
        addLog('[VITA] Используем MediaRecorder для веб-платформы');
        
        addLog('[VITA] Запрашиваем доступ к микрофону...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        addLog('[VITA] Доступ к микрофону получен');
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          addLog(`[VITA] Получены аудио данные, размер: ${event.data.size}`);
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          addLog('[VITA] Запись остановлена, обрабатываем аудио...');
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          addLog(`[VITA] Размер аудио blob: ${audioBlob.size}`);
          stream.getTracks().forEach(track => track.stop());
          await processAudio(audioBlob);
        };

        mediaRecorder.onerror = (event: any) => {
          addLog(`[VITA] MediaRecorder error: ${event.error}`);
          setLastError(`MediaRecorder: ${event.error}`);
        };

        addLog('[VITA] Начинаем запись...');
        mediaRecorder.start();

        // Автоматическая остановка через 5 секунд
        setTimeout(() => {
          addLog('[VITA] 5 секунд прошло, останавливаем запись');
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 5000);
      }

    } catch (error: any) {
      addLog(`[VITA] Error starting recording: ${error.message}`);
      setLastError(`Start recording: ${error.message}`);
      
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось получить доступ к микрофону",
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
      addLog(`[VITA] Начинаем обработку команды: ${text}`);
      
      toast({
        title: "Обрабатываю команду",
        description: `"${text}"`,
      });
      
      setState('processing');

      addLog('[VITA] Отправляем запрос в ai-assistant...');
      
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      
      // Отправляем в AI ассистента с контекстом
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [
            { role: 'user', content: text }
          ],
          userContext: {
            ...todayStats,
            userId: user?.id
          }
        }
      });

      addLog(`[VITA] Ответ от ai-assistant получен`);

      if (aiError) {
        addLog(`[VITA] AI error: ${aiError.message}`);
        setLastError(`AI error: ${aiError.message}`);
        toast({
          title: "Ошибка AI",
          description: aiError.message || 'Сервер недоступен',
          variant: "destructive"
        });
        throw new Error('Failed to get AI response');
      }

      if (!aiResponse) {
        addLog('[VITA] No AI response');
        toast({
          title: "Нет ответа",
          description: "AI не вернул ответ",
          variant: "destructive"
        });
        throw new Error('No AI response received');
      }

      addLog('[VITA] AI response успешно получен');
      
      toast({
        title: "Озвучиваю ответ",
        description: "Готово!",
      });

      // Озвучиваем ответ
      setState('speaking');
      await speakResponse(aiResponse.response || aiResponse.message || 'Не удалось получить ответ');

    } catch (error: any) {
      addLog(`Processing error: ${error.message}`);
      setLastError(`Processing: ${error.message}`);
      
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
      addLog('[VITA] Начинаем обработку аудио blob');
      setState('processing');

      // Конвертируем в base64
      addLog('[VITA] Конвертируем аудио в base64...');
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        addLog('[VITA] Base64 конвертация завершена');
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to convert audio');
        }

        addLog(`[VITA] Размер base64 аудио: ${base64Audio.length}`);

        try {
          // Отправляем на распознавание
          addLog('[VITA] Отправляем на voice-to-text edge function...');
          const { data: transcription, error: transcriptionError } = await supabase.functions.invoke('voice-to-text', {
            body: { audio: base64Audio }
          });

          addLog('[VITA] Ответ от voice-to-text получен');

          if (transcriptionError) {
            addLog(`[VITA] Transcription error: ${transcriptionError.message}`);
            setLastError(`Transcription: ${transcriptionError.message}`);
            throw transcriptionError;
          }

          if (!transcription?.text) {
            addLog('[VITA] No transcription text in response');
            throw new Error('No transcription text received');
          }

          addLog(`[VITA] Распознанный текст: ${transcription.text}`);

          addLog('[VITA] Отправляем текст в AI assistant...');

          // Get user ID
          const { data: { user } } = await supabase.auth.getUser();
          addLog(`[VITA] User ID: ${user?.id}`);

          // Отправляем в AI ассистента с контекстом
          const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
            body: { 
              messages: [
                { role: 'user', content: transcription.text }
              ],
              userContext: {
                ...todayStats,
                userId: user?.id
              }
            }
          });

          addLog('[VITA] Ответ от AI assistant получен');

          if (aiError) {
            addLog(`[VITA] AI error: ${aiError.message}`);
            setLastError(`AI: ${aiError.message}`);
            throw aiError;
          }

          if (!aiResponse) {
            addLog('[VITA] No AI response');
            throw new Error('No AI response received');
          }

          addLog('[VITA] AI response успешно получен');

          // Озвучиваем ответ
          setState('speaking');
          await speakResponse(aiResponse.response || aiResponse.message || 'Не удалось получить ответ');

        } catch (error: any) {
          addLog(`[VITA] Processing error: ${error.message}`);
          setLastError(`Processing: ${error.message}`);
          
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
              description: error.message || "Не удалось обработать команду",
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

    } catch (error: any) {
      addLog(`[VITA] Error processing audio: ${error.message}`);
      setLastError(`Audio processing: ${error.message}`);
      
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обработать команду",
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
      
      addLog('[VITA] Запрос озвучки');
      
      const { data: audioData, error: audioError } = await supabase.functions.invoke('text-to-speech', {
        body: { text: cleanText, voice: 'alena' }
      });

      addLog('[VITA] Ответ text-to-speech получен');

      if (audioError || !audioData?.audioContent) {
        addLog(`[VITA] Text-to-speech error: ${audioError?.message}`);
        setLastError(`TTS: ${audioError?.message}`);
        toast({
          title: "Ошибка озвучки",
          description: audioError?.message || 'Сервер недоступен',
          variant: "destructive"
        });
        throw new Error('Failed to generate speech');
      }

      addLog('[VITA] Аудио получено, воспроизводим');

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

    } catch (error: any) {
      addLog(`Error speaking response: ${error.message}`);
      setLastError(`TTS: ${error.message}`);
      setState('idle');
      if (isNativePlatform()) {
        setTimeout(() => startWakeWordDetection(), 500);
      }
    }
  };

  // Тестовые функции
  const testMicrophone = async () => {
    try {
      addLog('[TEST] Testing microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('[TEST] ✅ Microphone access granted');
      
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        addLog(`[TEST] ✅ Recording size: ${blob.size} bytes`);
        stream.getTracks().forEach(track => track.stop());
        toast({ title: "✅ Микрофон работает", description: `Записано ${blob.size} байт` });
      };
      
      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 2000);
    } catch (error: any) {
      addLog(`[TEST] ❌ Microphone error: ${error.message}`);
      setLastError(`Test mic: ${error.message}`);
      toast({ title: "❌ Ошибка микрофона", description: error.message, variant: "destructive" });
    }
  };

  const testAI = async () => {
    try {
      addLog('[TEST] Testing AI...');
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { 
          messages: [{ role: 'user', content: 'Привет' }],
          userContext: { userId: user?.id }
        }
      });
      
      if (error) throw error;
      addLog(`[TEST] ✅ AI response: ${data?.response || data?.message}`);
      toast({ title: "✅ AI работает", description: data?.response || data?.message });
    } catch (error: any) {
      addLog(`[TEST] ❌ AI error: ${error.message}`);
      setLastError(`Test AI: ${error.message}`);
      toast({ title: "❌ Ошибка AI", description: error.message, variant: "destructive" });
    }
  };

  const testTTS = async () => {
    try {
      addLog('[TEST] Testing TTS...');
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: 'Привет, я Вита', voice: 'alena' }
      });
      
      if (error || !data?.audioContent) throw error || new Error('No audio');
      
      addLog('[TEST] ✅ TTS audio received, playing...');
      const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
      await audio.play();
      toast({ title: "✅ TTS работает" });
    } catch (error: any) {
      addLog(`[TEST] ❌ TTS error: ${error.message}`);
      setLastError(`Test TTS: ${error.message}`);
      toast({ title: "❌ Ошибка TTS", description: error.message, variant: "destructive" });
    }
  };

  // Обработчики долгого нажатия
  const handleMouseDown = () => {
    if (state === 'idle') {
      longPressTimerRef.current = setTimeout(() => {
        setShowDebug(prev => !prev);
        addLog('Debug panel toggled');
      }, 2000);
    }
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
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
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={state !== 'idle'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white shadow-md transition-all ${getButtonColor()} ${
          state !== 'idle' ? 'animate-pulse' : 'hover:scale-105'
        }`}
        title={state === 'idle' ? 'Скажите "Вита" или нажмите. Держите 2 сек для отладки' : 'Обработка...'}
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

      {/* Панель отладки */}
      {showDebug && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border-t-2 border-primary rounded-t-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
              <h3 className="text-base font-semibold">🔍 Отладка Виты</h3>
              <button
                onClick={() => setShowDebug(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                ✕
              </button>
            </div>

            {/* Скроллящийся контейнер со всем содержимым */}
            <div className="overflow-y-auto flex-1">
              <div className="p-3 space-y-2">
                {/* Статус */}
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-xs font-medium mb-1">Статус</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      state === 'idle' ? 'bg-green-500' :
                      state === 'listening' ? 'bg-blue-500 animate-pulse' :
                      state === 'processing' ? 'bg-orange-500 animate-spin' :
                      'bg-purple-500 animate-pulse'
                    }`} />
                    <span className="text-xs capitalize">{state}</span>
                  </div>
                </div>

                {/* Платформа */}
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-xs font-medium mb-1">Платформа</div>
                  <div className="text-xs text-muted-foreground">
                    {isNativePlatform() ? '📱 Native (Capacitor)' : '🌐 Web Browser'}
                  </div>
                </div>

                {/* Микрофон */}
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-xs font-medium mb-1">Микрофон</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">
                      {micPermission === 'granted' ? '✅ Разрешен' :
                       micPermission === 'denied' ? '❌ Запрещен' :
                       '❓ Неизвестно'}
                    </span>
                  </div>
                </div>

                {/* Последняя ошибка */}
                {lastError && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2">
                    <div className="text-xs font-medium text-destructive mb-1">❌ Последняя ошибка</div>
                    <div className="text-xs text-destructive/80 break-words">{lastError}</div>
                  </div>
                )}

                {/* Логи */}
                <div className="bg-muted rounded-lg p-2">
                  <div className="text-xs font-medium mb-1">📝 Логи (последние 10)</div>
                  <div className="space-y-0.5 text-xs text-muted-foreground font-mono max-h-32 overflow-y-auto">
                    {debugLogs.length === 0 ? (
                      <div className="text-center py-2 text-muted-foreground/50">Логов пока нет</div>
                    ) : (
                      debugLogs.map((log, i) => (
                        <div key={i} className="border-l-2 border-primary/30 pl-2 py-0.5 break-words">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Тестовые кнопки - теперь внутри скроллящегося контейнера */}
                <div className="pt-2 space-y-2">
                  <div className="text-xs font-medium">🧪 Тесты</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={testMicrophone}
                      className="px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition"
                    >
                      🎤 Микрофон
                    </button>
                    <button
                      onClick={testAI}
                      className="px-2 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded-lg transition"
                    >
                      🤖 AI
                    </button>
                    <button
                      onClick={testTTS}
                      className="px-2 py-1.5 bg-pink-500 hover:bg-pink-600 text-white text-xs rounded-lg transition"
                    >
                      🔊 TTS
                    </button>
                  </div>
                </div>

                {/* Кнопка закрытия внизу */}
                <button
                  onClick={() => setShowDebug(false)}
                  className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm rounded-lg transition mt-2"
                >
                  Свернуть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
