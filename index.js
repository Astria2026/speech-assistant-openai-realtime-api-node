import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

dotenv.config();
if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

const app = Fastify({ logger: false });
app.register(formbody);
app.register(fastifyWs);

const PORT = Number(process.env.PORT || 5050);
const MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1';
const AI_VOICE = 'shimmer';
const MENU_VOICE = 'Google.en-US-Chirp3-HD-Aoede';

const SERVICES = {
  '1': {
    key: 'aviation',
    name: 'Aviation',
    intro: 'Astria advances global mobility and aviation opportunities. We work across airlines, airports, mobility, and aviation services, helping organizations build strategic alliances, expand market access, and connect with partners across international markets. Through industry relationships and commercial insight, Astria supports business development and long-term growth across the aviation ecosystem.'
  },

  '2': {
    key: 'space',
    name: 'Space and Aerospace',
    intro: 'Astria connects innovation and infrastructure for the future. Our work spans commercial space, satellite and infrastructure opportunities, advanced manufacturing, and global partnerships. We help organizations identify strategic relationships, explore new markets, and build connections across the international space and aerospace ecosystem.'
  },

  '3': {
    key: 'ai',
    name: 'AI Technology',
    intro: 'Astria empowers businesses through intelligent solutions. Our AI technology work includes enterprise AI, AI automation, AI integration, and emerging technology partnerships. We help organizations explore practical applications, connect with technology partners, and identify opportunities for business transformation and growth.'
  },

  '4': {
    key: 'sports',
    name: 'Sports Hospitality',
    intro: 'Astria creates unforgettable experiences that bring people together. Our sports hospitality work includes premium hospitality, major sporting events, corporate experiences, and strategic partnerships. We connect organizations with opportunities that support relationship building, brand engagement, and high-value experiences around major events.'
  },

  '5': {
    key: 'government',
    name: 'Government Procurement Services',
    intro: 'Astria Government Procurement Services assists companies with supplier and vendor registration, application preparation and submission, and basic supplemental-document follow-up. We help businesses navigate registration and administrative requirements for government procurement participation. Astria does not guarantee approvals, awards, or contracts, and legal or tax services are not included.'
  },

  '6': {
    key: 'business',
    name: 'Business Cooperation',
    intro: 'Astria helps organizations identify growth opportunities, form strategic partnerships, enter new markets, and connect with decision-makers and resources across industries and borders. Our work includes business development, strategic partnerships, global market access, and commercial advisory. We combine a New York perspective with global relationships to support international expansion and long-term value creation.'
  },

  '8': {
    key: 'general',
    name: 'General Assistance',
    intro: 'Astria connects organizations, ideas, and opportunities across aviation, space and aerospace, AI technology, sports hospitality, government procurement services, and business cooperation. Through global relationships, industry insight, and strategic collaboration, we help partners explore new markets, build meaningful connections, and create long-term value.'
  }
};

const BY_KEY =
  Object.fromEntries(
    Object.values(SERVICES).map(s => [s.key, s])
  );

const voicemailCalls = new Set();

const esc = s =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const host = req =>
  String(
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    ''
  )
    .split(',')[0]
    .trim();

const say = text =>
  `<Say voice="${MENU_VOICE}" language="en-US">${esc(text)}</Say>`;

function menu(req, prefix = '') {
  const h = host(req);

  const text =
    `${prefix} Thank you for calling Astria. ` +
    `For Aviation, press 1. ` +
    `For Space and Aerospace, press 2. ` +
    `For AI Technology, press 3. ` +
    `For Sports Hospitality, press 4. ` +
    `For Government Procurement Services, press 5. ` +
    `For Business Cooperation, press 6. ` +
    `To leave a voice message, press 7. ` +
    `For General Assistance, press 8. ` +
    `To hear this menu again, press 9.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="dtmf"
    numDigits="1"
    timeout="5"
    action="https://${h}/menu"
    method="POST"
    actionOnEmptyResult="true">
    ${say(text)}
  </Gather>
</Response>`;
}

function connect(req, service) {
  const h = host(req);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect
    action="https://${h}/after-ai"
    method="POST">
    <Stream url="wss://${h}/media-stream">
      <Parameter
        name="service"
        value="${esc(service.key)}" />
    </Stream>
  </Connect>
</Response>`;
}

function voicemail(req) {
  const h = host(req);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(
    'Please leave your name, telephone number, email address if available, and a brief message after the tone. A member of the Astria team will follow up with you.'
  )}
  <Record
    action="https://${h}/voicemail-done"
    method="POST"
    maxLength="120"
    playBeep="true" />
</Response>`;
}

function prompt(service) {
  return `
You are Astria's professional AI telephone assistant.

The caller selected ${service.name}.

BUSINESS INFORMATION:
${service.intro}

Speak in a warm, gentle, polished and professional style,
similar to premium international airline service.

Speak slightly slower than normal.

Keep answers concise unless the caller asks for more detail.

Never invent partnerships, contracts, awards, approvals,
prices, availability, certifications, legal conclusions,
tax conclusions, or guaranteed results.

There is no live transfer to a personal telephone.

If the caller asks for a human, representative,
agent, staff member, or customer service, say:

"Our consultation volume is currently high,
so live assistance may not be immediately available.
Our team can follow up with you by phone or email.
You may also press 7 to leave a voice message,
and a member of the Astria team will get back to you."

Email: info@goastria.com
Website: https://www.goastria.com
Telephone: +1-888-987-8767
`;
}


// ============================================================
// TWILIO ROUTES
// ============================================================

app.get(
  '/',
  async () => ({
    status: 'ok',
    service: 'Astria AI Voice',
    version: 'V7 Short'
  })
);

app.all(
  '/incoming-call',
  async (req, reply) =>
    reply
      .type('text/xml')
      .send(menu(req))
);

app.all(
  '/menu',
  async (req, reply) => {

    const digit =
      String(
        req.body?.Digits ??
        req.query?.Digits ??
        ''
      ).trim();

    if (digit === '9') {
      return reply
        .type('text/xml')
        .send(menu(req));
    }

    if (digit === '7') {
      return reply
        .type('text/xml')
        .send(voicemail(req));
    }

    return reply
      .type('text/xml')
      .send(
        connect(
          req,
          SERVICES[digit] || SERVICES['8']
        )
      );
  }
);

app.all(
  '/after-ai',
  async (req, reply) => {

    const callSid =
      String(
        req.body?.CallSid ??
        req.query?.CallSid ??
        ''
      );

    if (voicemailCalls.delete(callSid)) {
      return reply
        .type('text/xml')
        .send(voicemail(req));
    }

    return reply
      .type('text/xml')
      .send(
        menu(
          req,
          'You have returned to the Astria main menu.'
        )
      );
  }
);

app.all(
  '/voicemail-done',
  async (req, reply) =>
    reply
      .type('text/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(
    'Thank you. Your message has been received. A member of the Astria team will follow up with you. Goodbye.'
  )}
</Response>`
      )
);


// ============================================================
// OPENAI REALTIME
// ============================================================

app.register(
  async server => {

    server.get(
      '/media-stream',
      { websocket: true },

      socket => {

        let streamSid = null;
        let callSid = null;
        let service = SERVICES['8'];
        let configured = false;
        let introSent = false;

        const pending = [];

        const openai =
          new WebSocket(
            `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`,
            {
              headers: {
                Authorization:
                  `Bearer ${process.env.OPENAI_API_KEY}`
              }
            }
          );

        const sendAI = data => {
          if (
            openai.readyState ===
            WebSocket.OPEN
          ) {
            openai.send(
              JSON.stringify(data)
            );
          }
        };

        const configure = () => {

          if (
            !streamSid ||
            openai.readyState !== WebSocket.OPEN ||
            configured
          ) {
            return;
          }

          configured = true;

          sendAI({
            type: 'session.update',

            session: {
              type: 'realtime',
              model: MODEL,

              output_modalities: [
                'audio'
              ],

              instructions:
                prompt(service),

              audio: {

                input: {
                  format: {
                    type: 'audio/pcmu'
                  },

                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 650,
                    create_response: true,
                    interrupt_response: true
                  }
                },

                output: {
                  format: {
                    type: 'audio/pcmu'
                  },

                  voice:
                    AI_VOICE,

                  speed:
                    0.88
                }
              }
            }
          });
        };


        // OPENAI CONNECTED
        openai.on(
          'open',
          configure
        );


        // OPENAI EVENTS
        openai.on(
          'message',
          raw => {

            const event =
              JSON.parse(
                raw.toString()
              );


            // Session ready:
            // Shimmer gives the full business introduction.
            if (
              event.type ===
                'session.updated' &&
              !introSent
            ) {

              introSent = true;

              sendAI({
                type:
                  'response.create',

                response: {
                  output_modalities: [
                    'audio'
                  ],

                  instructions:
                    `Read the following business introduction fully and naturally. Do not shorten it. After finishing, ask: "How may I assist you today?"\n\n${service.intro}`
                }
              });


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

              return;
            }


            // SHIMMER AUDIO -> TWILIO
            if (
              event.type ===
                'response.output_audio.delta' &&
              event.delta &&
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
                      event.delta
                  }
                })
              );

              return;
            }


            if (
              event.type ===
              'error'
            ) {

              console.error(
                'OpenAI Realtime error:',
                JSON.stringify(event)
              );
            }
          }
        );


        openai.on(
          'close',
          () => {

            if (
              socket.readyState ===
              WebSocket.OPEN
            ) {
              socket.close();
            }
          }
        );


        openai.on(
          'error',
          error => {

            console.error(
              'OpenAI WebSocket error:',
              error.message
            );

            if (
              socket.readyState ===
              WebSocket.OPEN
            ) {
              socket.close();
            }
          }
        );


        // TWILIO EVENTS
        socket.on(
          'message',
          raw => {

            const data =
              JSON.parse(
                raw.toString()
              );


            if (
              data.event ===
              'start'
            ) {

              streamSid =
                data.start?.streamSid;

              callSid =
                data.start?.callSid;

              service =
                BY_KEY[
                  data.start
                    ?.customParameters
                    ?.service
                ] ||
                SERVICES['8'];

              configure();

              return;
            }


            if (
              data.event ===
                'media' &&
              data.media?.payload
            ) {

              if (
                configured
              ) {

                sendAI({
                  type:
                    'input_audio_buffer.append',

                  audio:
                    data.media.payload
                });

              } else if (
                pending.length < 150
              ) {

                pending.push(
                  data.media.payload
                );
              }

              return;
            }


            // Press 7 during AI = voicemail
            if (
              data.event ===
                'dtmf' &&
              data.dtmf?.digit ===
                '7'
            ) {

              if (callSid) {
                voicemailCalls.add(
                  callSid
                );
              }

              if (
                socket.readyState ===
                WebSocket.OPEN
              ) {
                socket.close();
              }
            }
          }
        );


        socket.on(
          'close',
          () => {

            if (
              openai.readyState ===
              WebSocket.OPEN
            ) {
              openai.close();
            }
          }
        );
      }
    );
  }
);


// ============================================================
// RAILWAY
// ============================================================

app.listen(
  {
    port: PORT,
    host: '0.0.0.0'
  },

  error => {

    if (error) {
      console.error(error);
      process.exit(1);
    }

    console.log(
      `Astria AI Voice V7 Short is listening on port ${PORT}`
    );
  }
);