import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'alena' } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const YANDEX_API_KEY = Deno.env.get('YANDEX_API_KEY');
    const YANDEX_FOLDER_ID = Deno.env.get('YANDEX_FOLDER_ID');

    if (!YANDEX_API_KEY || !YANDEX_FOLDER_ID) {
      throw new Error('Yandex API credentials not configured');
    }

    // Prepare form data for Yandex SpeechKit
    const formData = new FormData();
    formData.append('text', text);
    formData.append('lang', 'ru-RU');
    formData.append('voice', voice);
    formData.append('format', 'mp3');
    formData.append('folderId', YANDEX_FOLDER_ID);

    console.log('Calling Yandex SpeechKit with text:', text.substring(0, 100));

    // Call Yandex SpeechKit API
    const response = await fetch('https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${YANDEX_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Yandex API error:', response.status, errorText);
      throw new Error(`Yandex API error: ${response.status}`);
    }

    // Convert audio buffer to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    console.log('Successfully generated speech, audio size:', arrayBuffer.byteLength);

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
