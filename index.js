import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

dotenv.config();
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error('Missing OPENAI_API_KEY');

const app = Fastify({ logger: false });
app.register(formbody);
app.register(fastifyWs);

const PORT = Number(process.env.PORT || 5050);
const MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
const MENU_VOICE = 'Google.en-US-Chirp3-HD-Aoede';
const AI_VOICE = 'shimmer';

const SERVICES = {
  '1': ['Aviation',
    'Astria advances global mobility and aviation opportunities. We work across airlines, airports, mobility, and aviation services, helping organizations build strategic alliances, expand market access, and connect with partners across international markets. Through industry relationships and commercial insight, Astria supports business development and long-term growth across the aviation ecosystem.'
  ],

  '2': ['Space and Aerospace',
    'Astria connects innovation and infrastructure for the future. Our work spans commercial space, satellites and infrastructure, advanced manufacturing, and global partnerships. We help organizations identify strategic relationships, explore new markets, and build connections across the international space and aerospace ecosystem.'
  ],

  '3': ['AI Technology',
    'Astria helps organizations explore enterprise AI, AI automation, AI integration, and emerging technology partnerships. We connect businesses with technology opportunities and strategic partners that can support practical applications, transformation, and long-term growth.'
  ],

  '4': ['Sports Hospitality',
    'Astria develops premium sports hospitality and major-event opportunities, including corporate experiences and strategic partnerships. We help organizations build relationships, strengthen engagement, and access high-value opportunities around major sporting events.'
  ],

  '5': ['Government Procurement Services',
    'Astria assists businesses with government supplier and vendor registration, application preparation and submission, and basic supplemental-document follow-up. We help companies navigate the administrative requirements of government procurement participation. Astria does not guarantee approvals, awards, or contracts, and does not provide legal or tax services.'
  ],

  '6': ['Business Cooperation',
    'Astria helps organizations identify growth opportunities, build strategic partnerships, enter new markets, and connect with decision-makers and resources across industries and borders. Our work includes business development, strategic partnerships, global market access, and commercial advisory, combining a New York perspective with global relationships.'
  ],

  '8': ['General Assistance',
    'Astria connects innovation, capital, talent, organizations, and opportunities across aviation, space and aerospace, AI technology, sports hospitality, government procurement, and international business cooperation. We help partners build strategic relationships, explore new markets, and pursue long-term growth.'
  ]
};

const host = r =>
  String(
    r.headers['x-forwarded-host'] ||
    r.headers.host ||
    ''
  ).split(',')[0].trim();

const esc = s =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const say = s =>
  `<Say voice="${MENU_VOICE}" language="en-US"><prosody rate="85%">${esc(s)}</prosody></Say>`;

function menu(r) {
  const h = host(r);

  const text =
    'Thank you for calling Astria. ' +
    'For Aviation, press 1. ' +
    'For Space and Aerospace, press 2. ' +
    'For AI Technology, press 3. ' +
    'For Sports Hospitality, press 4. ' +
    'For Government Procurement Services, press 5. ' +
    'For Business Cooperation, press 6. ' +
    'To leave a voice message, press 7. ' +
    'For General Assistance, press 8. ' +
    'To hear this menu again, press 9.';

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="dtmf" numDigits="1" timeout="6" action="https://${h}/menu" method="POST" actionOnEmptyResult="true">${say(text)}</Gather></Response>`;
}

function connect(r, digit) {
  const h = host(r);

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect action="https://${h}/incoming-call" method="POST"><Stream url="wss://${h}/media-stream"><Parameter name="service" value="${digit}"/></Stream></Connect></Response>`;
}

function voicemail(r) {
  const h = host(r);

  return `<?xml version="1.0" encoding="UTF-8"?><Response>${say(
    'Please leave your name, telephone number, email address if available, and a brief message after the tone. A member of the Astria team will follow up with you.'
  )}<Record action="https://${h}/voicemail-done" method="POST" maxLength="120" playBeep="true"/></Response>`;
}

function prompt(service) {
  return `
You are Astria's professional AI telephone assistant for ${service[0]}.

Speak with a warm, gentle, calm and polished premium airline service style.
Speak slowly and clearly.

Use only this verified business information:
${service[1]}

Never invent partnerships, contracts, awards, approvals,
prices, availability, certifications, legal conclusions,
tax conclusions, or guaranteed outcomes.

There is no live transfer to a personal telephone.

If the caller asks for a human or representative,
explain that consultation volume is currently high
and the Astria team can follow up by phone or email.
The caller may also select option 7 from the main menu
to leave a voice message.

Email: info@goastria.com
Website: https://www.goastria.com
Telephone: +1-888-987-8767
`;
}

app.get('/', async () => ({
  status: 'ok',
  version: 'Astria Fresh Master'
}));

app.all('/incoming-call', async (r, p) =>
  p.type('text/xml').send(menu(r))
);

app.all('/menu', async (r, p) => {
  const d = String(
    r.body?.Digits ??
    r.query?.Digits ??
    ''
  ).trim();

  if (d === '9')
    return p.type('text/xml').send(menu(r));

  if (d === '7')
    return p.type('text/xml').send(voicemail(r));

  return p
    .type('text/xml')
    .send(connect(r, SERVICES[d] ? d : '8'));
});

app.all('/voicemail-done', async (r, p) =>
  p.type('text/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${say(
      'Thank you. Your message has been received. A member of the Astria team will follow up with you. Goodbye.'
    )}</Response>`
  )
);

app.register(async server => {
  server.get(
    '/media-stream',
    { websocket: true },

    connection => {
      let streamSid = null;
      let service = SERVICES['8'];
      let twilioReady = false;
      let aiReady = false;
      let configured = false;
      let introSent = false;

      const ai = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`,
        {
          headers: {
            Authorization: `Bearer ${KEY}`
          }
        }
      );

      const sendAI = data => {
        if (ai.readyState === WebSocket.OPEN)
          ai.send(JSON.stringify(data));
      };

      const configure = () => {
        if (!twilioReady || !aiReady || configured)
          return;

        configured = true;

        sendAI({
          type: 'session.update',

          session: {
            type: 'realtime',

            output_modalities: ['audio'],

            instructions:
              prompt(service),

            audio: {
              input: {
                format: {
                  type: 'audio/pcmu'
                },

                turn_detection: {
                  type: 'server_vad'
                }
              },

              output: {
                format: {
                  type: 'audio/pcmu'
                },

                voice: AI_VOICE,

                speed: 0.75
              }
            }
          }
        });
      };

      ai.on('open', () => {
        aiReady = true;
        configure();
      });

      ai.on('message', raw => {
        const e =
          JSON.parse(raw.toString());

        if (
          e.type === 'session.updated' &&
          !introSent
        ) {
          introSent = true;

          sendAI({
            type: 'conversation.item.create',

            item: {
              type: 'message',
              role: 'user',

              content: [{
                type: 'input_text',

                text:
                  `Read this full Astria business introduction naturally and do not shorten it: ${service[1]} Then ask exactly: How may I assist you today?`
              }]
            }
          });

          sendAI({
            type: 'response.create'
          });
        }

        if (
          e.type ===
            'response.output_audio.delta' &&
          e.delta &&
          streamSid &&
          connection.readyState ===
            WebSocket.OPEN
        ) {
          connection.send(
            JSON.stringify({
              event: 'media',
              streamSid,

              media: {
                payload: e.delta
              }
            })
          );
        }

        if (e.type === 'error')
          console.error(
            'OpenAI:',
            JSON.stringify(e)
          );
      });

      connection.on('message', raw => {
        const d =
          JSON.parse(raw.toString());

        if (d.event === 'start') {
          streamSid =
            d.start.streamSid;

          service =
            SERVICES[
              d.start.customParameters?.service
            ] ||
            SERVICES['8'];

          twilioReady = true;

          configure();
        }

        if (
          d.event === 'media' &&
          d.media?.payload &&
          configured
        ) {
          sendAI({
            type:
              'input_audio_buffer.append',

            audio:
              d.media.payload
          });
        }
      });

      connection.on('close', () => {
        if (ai.readyState === WebSocket.OPEN)
          ai.close();
      });

      ai.on('close', () => {
        if (
          connection.readyState ===
          WebSocket.OPEN
        )
          connection.close();
      });

      ai.on('error', e =>
        console.error(
          'OpenAI WebSocket:',
          e.message
        )
      );
    }
  );
});

app.listen(
  {
    port: PORT,
    host: '0.0.0.0'
  },

  err => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    console.log(
      `Astria Fresh Master listening on ${PORT}`
    );
  }
);