import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { createHash } from 'node:crypto';

dotenv.config();

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error('Missing OPENAI_API_KEY');

const app = Fastify({ logger: false });

app.register(formbody);
app.register(fastifyWs);

const PORT = Number(process.env.PORT || 5050);

const MODEL =
  process.env.OPENAI_REALTIME_MODEL ||
  'gpt-realtime-1.5';

const TTS_MODEL =
  process.env.OPENAI_TTS_MODEL ||
  'gpt-4o-mini-tts';

const AI_VOICE = 'shimmer';
const AI_SPEED = 0.78;


/* =========================
   ASTRIA VOICE STYLE
========================= */

const VOICE_STYLE =
  'Speak in English with a soft, sweet, feminine Taiwanese-accented delivery. ' +
  'Keep the voice warm, gentle, polished, and naturally charming, like premium international airline customer service. ' +
  'Use a slightly slower pace, smooth intonation, clear articulation, and soft sentence endings. ' +
  'Keep the Taiwanese accent light, stable, and natural from the first word to the last. ' +
  'Do not exaggerate the accent. ' +
  'Do not sound childish, cartoonish, seductive, breathy, or overly dramatic. ' +
  'Maintain a professional business tone.';


/* =========================
   BUSINESS SERVICES
========================= */

const SERVICES = {

  '1': [
    'Aviation',

    'Astria advances global mobility and aviation opportunities. ' +
    'We work across airlines, airports, mobility, and aviation services, ' +
    'helping organizations build strategic alliances, expand market access, ' +
    'and connect with partners across international markets. ' +
    'Through industry relationships and commercial insight, ' +
    'Astria supports business development and long-term growth across the aviation ecosystem.'
  ],

  '2': [
    'Space and Aerospace',

    'Astria connects innovation and infrastructure for the future. ' +
    'Our work spans commercial space, satellite and infrastructure opportunities, ' +
    'advanced manufacturing, and global partnerships. ' +
    'We help organizations identify strategic relationships, explore new markets, ' +
    'and build connections across the international space and aerospace ecosystem.'
  ],

  '3': [
    'AI Technology',

    'Astria empowers businesses through intelligent solutions. ' +
    'Our AI technology work includes enterprise AI, AI automation, ' +
    'AI integration, and emerging technology partnerships. ' +
    'We help organizations explore practical applications, connect with technology partners, ' +
    'and identify opportunities for business transformation and growth.'
  ],

  '4': [
    'Sports Hospitality',

    'Astria creates unforgettable experiences that bring people together. ' +
    'Our sports hospitality work includes premium hospitality, major sporting events, ' +
    'corporate experiences, and strategic partnerships. ' +
    'We connect organizations with opportunities that support relationship building, ' +
    'brand engagement, and high-value experiences around major events.'
  ],

  '5': [
    'Government Procurement Services',

    'Astria Government Procurement Services assists companies with supplier and vendor registration, ' +
    'application preparation and submission, and basic supplemental-document follow-up. ' +
    'We help businesses navigate registration and administrative requirements ' +
    'for government procurement participation. ' +
    'Astria does not guarantee approvals, awards, or contracts, ' +
    'and legal or tax services are not included.'
  ],

  '6': [
    'Business Cooperation',

    'Astria helps organizations identify growth opportunities, form strategic partnerships, ' +
    'enter new markets, and connect with decision-makers and resources across industries and borders. ' +
    'Our work includes business development, strategic partnerships, global market access, ' +
    'and commercial advisory. ' +
    'We combine a New York perspective with global relationships ' +
    'to support international expansion and long-term value creation.'
  ],

  '8': [
    'General Assistance',

    'Astria connects organizations, ideas, and opportunities across aviation, ' +
    'space and aerospace, AI technology, sports hospitality, ' +
    'government procurement services, and business cooperation. ' +
    'Through global relationships, industry insight, and strategic collaboration, ' +
    'we help partners explore new markets, build meaningful connections, ' +
    'and create long-term value.'
  ]
};


/* =========================
   MAIN MENU
========================= */

const MENU_TEXT =
  'Thank you for calling Astria. ' +

  'Astria connects organizations, ideas, and opportunities across aviation, ' +
  'space and aerospace, AI technology, sports hospitality, ' +
  'government procurement services, and business cooperation. ' +

  'Through global relationships, industry insight, and strategic collaboration, ' +
  'we help partners explore new markets, build meaningful connections, ' +
  'and create long-term value. ' +

  'You are speaking with Astria’s AI assistant. ' +

  'Please select a business area. ' +

  'For Aviation, press 1. ' +

  'For Space and Aerospace, press 2. ' +

  'For AI Technology, press 3. ' +

  'For Sports Hospitality, press 4. ' +

  'For Government Procurement Services, press 5. ' +

  'For Business Cooperation, press 6. ' +

  'To leave a voice message, press 7. ' +

  'For General Assistance, press 8. ' +

  'To hear this menu again, press 9.';


const VOICEMAIL_TEXT =
  'Please leave your name, telephone number, email address if available, ' +
  'and a brief message after the tone. ' +
  'A member of the Astria team will follow up with you.';


const VOICEMAIL_DONE_TEXT =
  'Thank you. Your message has been received. ' +
  'A member of the Astria team will follow up with you. Goodbye.';


/* =========================
   HELPERS
========================= */

const host = r =>
  String(
    r.headers['x-forwarded-host'] ||
    r.headers.host ||
    ''
  )
    .split(',')[0]
    .trim();


const esc = s =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');


function clipText(clip) {

  if (clip === 'menu')
    return MENU_TEXT;

  if (clip === 'voicemail')
    return VOICEMAIL_TEXT;

  if (clip === 'voicemail-done')
    return VOICEMAIL_DONE_TEXT;

  const match =
    /^service-([1-6]|8)$/.exec(clip);

  if (!match)
    return null;

  const service =
    SERVICES[match[1]];

  return (
    service[1] +
    ' How may I assist you today?'
  );
}


function audioFingerprint(text) {

  return createHash('sha256')

    .update(
      `${TTS_MODEL}|${AI_VOICE}|${VOICE_STYLE}|${text}`
    )

    .digest('hex')

    .slice(0, 12);
}


function audioUrl(r, clip) {

  const text =
    clipText(clip);

  const version =
    audioFingerprint(text);

  return (
    `https://${host(r)}` +
    `/audio/${clip}.wav?v=${version}`
  );
}


/* =========================
   OPENAI TTS CACHE
========================= */

const ttsCache =
  new Map();

const ttsPending =
  new Map();


async function makeSpeech(text) {

  const response =
    await fetch(
      'https://api.openai.com/v1/audio/speech',

      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${KEY}`,

          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({

          model:
            TTS_MODEL,

          voice:
            AI_VOICE,

          input:
            text,

          instructions:
            VOICE_STYLE,

          response_format:
            'wav',

          speed:
            0.92
        })
      }
    );


  if (!response.ok) {

    const detail =
      await response.text();

    throw new Error(
      `OpenAI TTS ${response.status}: ${detail}`
    );
  }


  return Buffer.from(
    await response.arrayBuffer()
  );
}


async function getSpeech(clip) {

  const text =
    clipText(clip);

  if (!text)
    return null;


  const cacheKey =
    audioFingerprint(text);


  if (ttsCache.has(cacheKey))
    return ttsCache.get(cacheKey);


  if (ttsPending.has(cacheKey))
    return ttsPending.get(cacheKey);


  const job =
    makeSpeech(text)

      .then(buffer => {

        ttsCache.set(
          cacheKey,
          buffer
        );

        ttsPending.delete(
          cacheKey
        );

        return buffer;
      })

      .catch(error => {

        ttsPending.delete(
          cacheKey
        );

        throw error;
      });


  ttsPending.set(
    cacheKey,
    job
  );


  return job;
}


/* =========================
   TWILIO MENU
========================= */

function menu(r) {

  const h =
    host(r);


  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="dtmf"
    numDigits="1"
    timeout="6"
    action="https://${h}/menu"
    method="POST"
    actionOnEmptyResult="true">

    <Play>${esc(audioUrl(r, 'menu'))}</Play>

  </Gather>
</Response>`;
}


/* =========================
   SERVICE INTRO
========================= */

function serviceTwiml(
  r,
  digit
) {

  const h =
    host(r);


  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>

  <Play>${esc(
    audioUrl(
      r,
      `service-${digit}`
    )
  )}</Play>

  <Connect
    action="https://${h}/after-ai"
    method="POST">

    <Stream
      url="wss://${h}/media-stream">

      <Parameter
        name="service"
        value="${digit}" />

    </Stream>

  </Connect>

</Response>`;
}


/* =========================
   VOICEMAIL
========================= */

function voicemail(r) {

  const h =
    host(r);


  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>

  <Play>${esc(
    audioUrl(
      r,
      'voicemail'
    )
  )}</Play>

  <Record
    action="https://${h}/voicemail-done"
    method="POST"
    maxLength="120"
    playBeep="true" />

</Response>`;
}


/* =========================
   REALTIME AI PROMPT
========================= */

function prompt(s) {

  return `
You are Astria's professional AI telephone assistant for ${s[0]}.

# Voice and Accent

- Speak only in English.

- Use a soft, sweet, feminine Taiwanese-accented delivery.

- Keep the voice warm, gentle, polished, and naturally charming, like premium international airline customer service.

- Speak slowly and clearly with smooth intonation and soft sentence endings.

- Keep the Taiwanese accent light, stable, and natural throughout the conversation.

- Do not exaggerate the accent.

- Do not sound childish, cartoonish, seductive, breathy, or overly dramatic.

- Keep a professional business tone.

# Business Information

Use only this verified business information:

${s[1]}

# Rules

Never invent partnerships, contracts, awards, approvals, pricing, availability, certifications, legal conclusions, tax conclusions, or guaranteed results.

There is no live transfer to a personal telephone.

If the caller asks for a human, representative, agent, staff member, or customer service, explain that consultation volume is currently high, the Astria team can follow up by phone or email, and the caller may choose option 7 from the main menu to leave a voice message.

Contact:

info@goastria.com

https://www.goastria.com

+1-888-987-8767
`;
}


/* =========================
   STATUS
========================= */

app.get(
  '/',

  async () => ({
    status: 'ok',
    version: 'Astria New Master'
  })
);


/* =========================
   AUDIO ENDPOINT
========================= */

app.get(
  '/audio/:clip',

  async (r, p) => {

    const raw =
      String(
        r.params?.clip ||
        ''
      );


    const clip =
      raw.endsWith('.wav')
        ? raw.slice(0, -4)
        : raw;


    const text =
      clipText(clip);


    if (!text) {

      return p
        .code(404)
        .send('Not found');
    }


    try {

      const audio =
        await getSpeech(clip);


      return p

        .header(
          'Content-Type',
          'audio/wav'
        )

        .header(
          'Cache-Control',
          'public, max-age=31536000, immutable'
        )

        .send(audio);

    } catch (e) {

      console.error(
        'OpenAI TTS error:',
        e.message
      );


      return p
        .code(500)
        .send(
          'Audio generation failed'
        );
    }
  }
);


/* =========================
   INCOMING CALL
========================= */

app.all(
  '/incoming-call',

  async (r, p) =>

    p
      .type('text/xml')
      .send(
        menu(r)
      )
);


/* =========================
   MENU SELECTION
========================= */

app.all(
  '/menu',

  async (r, p) => {

    const d =
      String(
        r.body?.Digits ??
        r.query?.Digits ??
        ''
      ).trim();


    if (
      !d ||
      d === '9'
    )

      return p
        .type('text/xml')
        .send(
          menu(r)
        );


    if (d === '7')

      return p
        .type('text/xml')
        .send(
          voicemail(r)
        );


    return p
      .type('text/xml')
      .send(
        serviceTwiml(
          r,
          SERVICES[d]
            ? d
            : '8'
        )
      );
  }
);


/* =========================
   AFTER AI
========================= */

app.all(
  '/after-ai',

  async (r, p) =>

    p
      .type('text/xml')
      .send(
        menu(r)
      )
);


/* =========================
   VOICEMAIL COMPLETE
========================= */

app.all(
  '/voicemail-done',

  async (r, p) =>

    p
      .type('text/xml')
      .send(

        `<?xml version="1.0" encoding="UTF-8"?>
<Response>

  <Play>${esc(
    audioUrl(
      r,
      'voicemail-done'
    )
  )}</Play>

</Response>`

      )
);


/* =========================
   OPENAI REALTIME
========================= */

app.register(

  async server => {

    server.get(

      '/media-stream',

      {
        websocket: true
      },

      socket => {


        let streamSid =
          null;


        let service =
          SERVICES['8'];


        let aiOpen =
          false;


        let twilioOpen =
          false;


        let sessionReady =
          false;


        let configured =
          false;


        const pending =
          [];


/* =========================
   OPENAI WEBSOCKET
========================= */

        const ai =
          new WebSocket(

            `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`,

            {
              headers: {
                Authorization:
                  `Bearer ${KEY}`
              }
            }
          );


/* =========================
   SEND TO OPENAI
========================= */

        const sendAI =
          data => {

            if (
              ai.readyState ===
              WebSocket.OPEN
            )

              ai.send(
                JSON.stringify(data)
              );
          };


/* =========================
   CONFIGURE SESSION
========================= */

        const configure =
          () => {

            if (
              !aiOpen ||
              !twilioOpen ||
              configured
            )

              return;


            configured =
              true;


            sendAI({

              type:
                'session.update',

              session: {

                type:
                  'realtime',

                output_modalities: [
                  'audio'
                ],

                instructions:
                  prompt(service),

                audio: {

                  input: {

                    format: {
                      type:
                        'audio/pcmu'
                    },

                    turn_detection: {

                      type:
                        'server_vad',

                      threshold:
                        0.5,

                      prefix_padding_ms:
                        300,

                      silence_duration_ms:
                        700,

                      create_response:
                        true,

                      interrupt_response:
                        true
                    }
                  },

                  output: {

                    format: {
                      type:
                        'audio/pcmu'
                    },

                    voice:
                      AI_VOICE,

                    speed:
                      AI_SPEED
                  }
                }
              }
            });
          };


/* =========================
   OPENAI CONNECTED
========================= */

        ai.on(
          'open',

          () => {

            aiOpen =
              true;

            configure();
          }
        );


/* =========================
   OPENAI AUDIO OUTPUT
========================= */

        ai.on(
          'message',

          raw => {

            const e =
              JSON.parse(
                raw.toString()
              );


            if (
              e.type ===
              'session.updated'
            ) {

              sessionReady =
                true;


              while (
                pending.length
              ) {

                sendAI({

                  type:
                    'input_audio_buffer.append',

                  audio:
                    pending.shift()
                });
              }
            }


            if (
              e.type ===
                'response.output_audio.delta' &&

              e.delta &&

              streamSid &&

              socket.readyState ===
                WebSocket.OPEN
            ) {

              socket.send(

                JSON.stringify({

                  event:
                    'media',

                  streamSid,

                  media: {
                    payload:
                      e.delta
                  }
                })
              );
            }


            if (
              e.type ===
              'error'
            ) {

              console.error(

                'OpenAI Realtime error:',

                JSON.stringify(e)
              );
            }
          }
        );


/* =========================
   TWILIO AUDIO INPUT
========================= */

        socket.on(
          'message',

          raw => {

            const d =
              JSON.parse(
                raw.toString()
              );


            if (
              d.event ===
              'start'
            ) {

              streamSid =
                d.start?.streamSid;


              service =

                SERVICES[
                  d.start
                    ?.customParameters
                    ?.service
                ] ||

                SERVICES['8'];


              twilioOpen =
                true;


              configure();
            }


            if (
              d.event ===
                'media' &&

              d.media?.payload
            ) {

              if (
                sessionReady
              ) {

                sendAI({

                  type:
                    'input_audio_buffer.append',

                  audio:
                    d.media.payload
                });

              } else if (
                pending.length <
                150
              ) {

                pending.push(
                  d.media.payload
                );
              }
            }
          }
        );


/* =========================
   CLOSE CONNECTIONS
========================= */

        ai.on(
          'close',

          () => {

            if (
              socket.readyState ===
              WebSocket.OPEN
            )

              socket.close();
          }
        );


        ai.on(
          'error',

          e =>

            console.error(
              'OpenAI WebSocket:',
              e.message
            )
        );


        socket.on(
          'close',

          () => {

            if (
              ai.readyState ===
              WebSocket.OPEN
            )

              ai.close();
          }
        );
      }
    );
  }
);


/* =========================
   START SERVER
========================= */

app.listen(

  {
    port:
      PORT,

    host:
      '0.0.0.0'
  },

  err => {

    if (err) {

      console.error(err);

      process.exit(1);
    }


    console.log(
      `Astria New Master listening on ${PORT}`
    );


/* =========================
   PRELOAD ASTRIA VOICE
========================= */

    setTimeout(

      async () => {

        const clips = [

          'menu',

          'service-1',

          'service-2',

          'service-3',

          'service-4',

          'service-5',

          'service-6',

          'service-8',

          'voicemail',

          'voicemail-done'
        ];


        for (
          const clip of clips
        ) {

          try {

            await getSpeech(
              clip
            );


            console.log(
              `TTS ready: ${clip}`
            );

          } catch (e) {

            console.error(
              `TTS preload failed: ${clip}:`,
              e.message
            );
          }
        }
      },

      1000
    );
  }
);
