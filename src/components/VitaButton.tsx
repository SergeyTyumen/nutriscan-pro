import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { isNativePlatform } from '@/utils/platform';

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

export const VitaButton = () => {
  const [state, setState] = useState<VitaState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionActiveRef = useRef(false);
  const { toast } = useToast();

  // Инициализация для нативной платформы
  useEffect(() => {
    if (!isNativePlatform()) return;

    const initNativeSpeechRecognition = async () => {
      try {
        const SpeechRecognition = await loadSpeechRecognition();
        if (!SpeechRecognition) return;

        // Запрашиваем разрешения
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

        // Запускаем непрерывное прослушивание wake word
        startWakeWordDetection();
      } catch (error) {
        console.error('Failed to initialize speech recognition:', error);
      }
    };

    initNativeSpeechRecognition();

    return () => {
      stopWakeWordDetection();
    };
  }, []);

  const startWakeWordDetection = async () => {
    if (!isNativePlatform() || recognitionActiveRef.current) return;

    try {
      const SpeechRecognition = await loadSpeechRecognition();
      if (!SpeechRecognition) return;

      recognitionActiveRef.current = true;

      // Слушатель для частичных результатов
      SpeechRecognition.addListener('partialResults', (data: any) => {
        const text = data.matches?.join(' ').toLowerCase() || '';
        console.log('Wake word detection:', text);

        if (text.includes('вита') && state === 'idle') {
          console.log('Wake word detected!');
          stopWakeWordDetection();
          startListening();
        }
      });

      // Запуск распознавания
      await SpeechRecognition.start({
        language: 'ru-RU',
        partialResults: true,
        popup: false,
      });

      console.log('Wake word detection started (native)');
    } catch (error) {
      console.error('Failed to start wake word detection:', error);
      recognitionActiveRef.current = false;
      
      // Повторная попытка через 2 секунды
      setTimeout(() => {
        if (state === 'idle') startWakeWordDetection();
      }, 2000);
    }
  };

  const stopWakeWordDetection = async () => {
    if (!isNativePlatform() || !recognitionActiveRef.current) return;

    try {
      const SpeechRecognition = await loadSpeechRecognition();
      if (!SpeechRecognition) return;

      await SpeechRecognition.stop();
      SpeechRecognition.removeAllListeners();
      recognitionActiveRef.current = false;
      console.log('Wake word detection stopped');
    } catch (error) {
      console.error('Failed to stop wake word detection:', error);
    }
  };

  const startListening = async () => {
    try {
      setState('listening');
      
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

          // Отправляем в AI ассистента
          const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-assistant', {
            body: { 
              messages: [
                { role: 'user', content: transcription.text }
              ]
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
      const { data: audioData, error: audioError } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice: 'alena' }
      });

      if (audioError || !audioData?.audioContent) {
        throw new Error('Failed to generate speech');
      }

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
    <button
      onClick={startListening}
      disabled={state !== 'idle'}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white shadow-md transition-all ${getButtonColor()} ${
        state !== 'idle' ? 'animate-pulse' : 'hover:scale-105'
      }`}
      title={state === 'idle' ? (isNativePlatform() ? 'Нажмите или скажите "Вита"' : 'Нажмите для записи') : 'Обработка...'}
    >
      {getButtonContent()}
      <span className="text-xs font-semibold">Вита</span>
    </button>
  );
};
