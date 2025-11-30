import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Ты - умный помощник по питанию и здоровому образу жизни. 
Твоя задача:
- Помогать пользователям отслеживать калории и БЖУ
- Давать персональные рекомендации по питанию
- Анализировать фотографии еды и определять калории
- Отвечать на вопросы о здоровом питании
- Быть дружелюбным и мотивирующим

Отвечай кратко и по делу. Всегда на русском языке.`;

    const messagesWithSystem = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    // If there's an image, add it to the last user message
    if (image && messagesWithSystem[messagesWithSystem.length - 1]?.role === 'user') {
      const lastMessage = messagesWithSystem[messagesWithSystem.length - 1];
      messagesWithSystem[messagesWithSystem.length - 1] = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: lastMessage.content
          },
          {
            type: 'image_url',
            image_url: {
              url: image
            }
          }
        ]
      };
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: messagesWithSystem,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Превышен лимит запросов. Попробуйте позже.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Требуется пополнение баланса.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('AI Gateway error');
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in ai-assistant:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
