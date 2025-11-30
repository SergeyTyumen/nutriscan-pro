import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;
    
    const messageText = input.trim() || 'Проанализируй эту еду';
    setInput('');
    await streamChat(messageText, selectedImage || undefined);
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
      </div>
    </div>
  );
};

export default Assistant;
