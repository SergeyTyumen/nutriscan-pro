import { useState, useRef, useEffect } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Типы для Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type VitaState = 'idle' | 'listening' | 'processing' | 'speaking';

export const VitaButton = () => {
  const [state, setState] = useState<VitaState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wakeWordRecognitionRef = useRef<any>(null);
  const { toast } = useToast();

  // Постоянное прослушивание wake word "Вита"
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ru-RU';

    recognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0].transcript.toLowerCase();
      
      console.log('Wake word detection:', transcript);
      
      // Проверяем wake word "вита"
      if (transcript.includes('вита') && state === 'idle') {
        console.log('Wake word detected!');
        recognition.stop();
        startListening();
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Wake word recognition error:', event.error);
      // Перезапуск при ошибке
      if (event.error !== 'aborted') {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      // Перезапуск после остановки (если не в процессе обработки)
      if (state === 'idle') {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
          }
        }, 500);
      }
    };

    wakeWordRecognitionRef.current = recognition;

    // Запускаем прослушивание
    try {
      recognition.start();
      console.log('Wake word detection started');
    } catch (e) {
      console.error('Failed to start wake word detection:', e);
    }

    return () => {
      recognition.stop();
      wakeWordRecognitionRef.current = null;
    };
  }, [state]);

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

        // Отправляем на распознавание
        const { data: transcription, error: transcriptionError } = await supabase.functions.invoke('voice-to-text', {
          body: { audio: base64Audio }
        });

        if (transcriptionError || !transcription?.text) {
          throw new Error('Failed to transcribe audio');
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

        if (aiError || !aiResponse) {
          throw new Error('Failed to get AI response');
        }

        console.log('AI response:', aiResponse);

        // Только озвучиваем ответ (без toast)
        setState('speaking');
        await speakResponse(aiResponse.response || aiResponse.message);

        // Перезапускаем прослушивание wake word
        if (wakeWordRecognitionRef.current) {
          try {
            wakeWordRecognitionRef.current.start();
          } catch (e) {
            console.error('Failed to restart wake word detection:', e);
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
      };

      audio.onerror = () => {
        setState('idle');
      };

      await audio.play();

    } catch (error) {
      console.error('Error speaking response:', error);
      setState('idle');
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
      title={state === 'idle' ? 'Нажмите или скажите "Вита"' : 'Обработка...'}
    >
      {getButtonContent()}
      <span className="text-xs font-semibold">Вита</span>
    </button>
  );
};
