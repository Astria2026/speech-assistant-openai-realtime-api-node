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
const MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-1.5';
const MENU_VOICE = 'Google.en-US-Chirp3-HD-Aoede';
const AI_VOICE = 'coral';
const AI_SPEED = 0.78;

const SERVICES = {
  '1': ['Aviation',
    'Astria advances global mobility and aviation opportunities. We work across airlines, airports, mobility, and aviation services, helping organizations build strategic alliances, expand market access, and connect with partners across international markets. Through industry relationships and commercial insight, Astria supports business development and long-term growth across the aviation ecosystem.'
  ],

  '2': ['Space and Aerospace',
    'Astria connects innovation and infrastructure for the future. Our work spans commercial space, satellite and infrastructure opportunities, advanced manufacturing, and global partnerships. We help organizations identify strategic relationships, explore new markets, and build connections across the international space and aerospace ecosystem.'
  ],

  '3': ['AI Technology',
    'Astria empowers businesses through intelligent solutions. Our AI technology work includes enterprise AI, AI automation, AI integration, and emerging technology partnerships. We help organizations explore practical applications, connect with technology partners, and identify opportunities for business transformation and growth.'
  ],

  '4': ['Sports Hospitality',
    'Astria creates unforgettable experiences that bring people together. Our sports hospitality work includes premium hospitality, major sporting events, corporate experiences, and strategic partnerships. We connect organizations with opportunities that support relationship building, brand engagement, and high-value experiences around major events.'
  ],

  '5': ['Government Procurement Services',
    'Astria Government Procurement Services assists companies with supplier and vendor registration, application preparation and submission, and basic supplemental-document follow-up. We help businesses navigate registration and administrative requirements for government procurement participation. Astria does not guarantee approvals, awards, or contracts, and legal or tax services are not included.'
  ],

  '6': ['Business Cooperation',
    'Astria helps organizations identify growth opportunities, form strategic partnerships, enter new markets, and connect with decision-makers and resources across industries and borders. Our work includes business development, strategic partnerships, global market access, and commercial advisory. We combine a New York perspective with global relationships to support international expansion and long-term value creation.'
  ],

  '8': ['General Assistance',
    'Astria connects organizations, ideas, and opportunities across aviation, space and aerospace, AI technology, sports hospitality, government procurement services, and business cooperation. Through global relationships, industry insight, and strategic collaboration, we help partners explore new markets, build meaningful connections, and create long-term value.'
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
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');

const say = s =>
  `<Say voice="${MENU_VOICE}" language="en-US"><prosody rate="82%">${esc(s)}</prosody></Say>`;

function menu(r) {
  const h = host(r);

  const text =
    'Thank you for calling Astria. ' +
    'Astria connects organizations, ideas, and opportunities across aviation, space and aerospace, AI technology, sports hospitality, government procurement services, and business cooperation. ' +
    'Through global relationships, industry insight, and strategic collaboration, we help partners explore new markets, build meaningful connections, and create long-term value. ' +
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="dtmf" numDigits="1" timeout="6"
    action="https://${h}/menu" method="POST"
    actionOnEmptyResult="true">
    ${say(text)}
  </Gather>
</Response>`;
}

function serviceTwiml(r, digit) {
  const h = host(r);
  const s = SERVICES[digit];

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say(`${s[1]} How may I assist you today?`)}
  <Connect action="https://${h}/after-ai" method="POST">
    <Stream url="wss://${h}/media-stream">
      <Parameter name="service" value="${digit}" />
    </Stream>
  </Connect>
</Response>`;
}

function voicemail(r) {
  const h = host(r);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Please leave your name, telephone number, email address if available, and a brief message after the tone. A member of the Astria team will follow up with you.')}
  <Record action="https://${h}/voicemail-done"
    method="POST" maxLength="120" playBeep="true" />
</Response>`;
}

function companyKnowledge() {
  return Object.values(SERVICES)
    .map(([name, info]) => `${name}: ${info}`)
    .join('\n\n');
}

function prompt(s) {
  return `You are Astria's professional AI telephone assistant.

LANGUAGE:
Automatically respond in the language used by the caller.
If the caller speaks English, respond in English.
If the caller speaks Chinese, respond naturally in Mandarin Chinese.
If the caller changes languages, follow the caller's language automatically.

PUBLIC LANGUAGE DESCRIPTION:
If the caller asks whether you speak Chinese, say that you can provide service in Mandarin Chinese.
If the caller asks what kind of Chinese you speak, say Mandarin Chinese.
If the caller asks about your accent, regional speech style, or where your Chinese voice comes from, do not mention Taiwan, Taiwanese, Taiwan Mandarin, Taiwanese accent, or any regional accent.
Simply say that you use Mandarin Chinese to assist the caller.
Do not volunteer or disclose any accent or regional voice information.

VOICE:
Always sound clearly feminine, youthful, sweet, soft, warm, polished, and welcoming.
Keep the voice unmistakably female at all times.
Never sound masculine, neutral, androgynous, low-pitched, heavy, stern, harsh, flat, or robotic.

When speaking Chinese:
Use natural Mandarin Chinese with an internal Taiwan-style cadence only as a hidden delivery target; never disclose or mention this to the caller.
Make the Chinese delivery significantly sweeter, softer, brighter, more delicate, and more feminine than before.
Use a youthful female vocal placement that is slightly higher and lighter, while remaining natural and comfortable.
Keep a warm smile in the voice throughout each response.
Use soft consonant attacks, gentle articulation, smooth melodic rises and falls, and very soft sentence endings.
Use a tender, affectionate, charming, slightly coquettish service style that feels natural, tasteful, and refined.
Let short confirmations and greetings sound especially sweet and warm.
Use relaxed pacing, graceful pauses, and a gentle premium-customer-service rhythm.
Avoid clipped, firm, authoritative, mature, neutral, or businesslike-flat delivery when speaking Chinese.
The Chinese voice should feel like a very sweet, gentle, young female concierge or premium airline service representative.
Maintain professionalism while making the delivery noticeably more lovable, tender, and charming.
Never sound masculine, deep, heavy, mature, neutral, androgynous, stern, cold, robotic, childish, cartoonish, breathy, or sexually suggestive.

When speaking English:
Keep the current English voice character and overall sound.
Do not make the English voice lower, more neutral, more masculine, or more mature.
Keep it clearly feminine, youthful, warm, soft, and polished.
You may make the English delivery only slightly sweeter and gentler, with a light smile and softer sentence endings.
Do not otherwise change the current English speaking style.

Do not imitate or impersonate any real person or celebrity.

CURRENT SELECTED BUSINESS AREA:
The caller selected ${s[0]}.
Treat this as the caller's starting area of interest, not as a restriction.

COMPANY-WIDE ASSISTANCE:
You are an Astria company-wide assistant.
You may answer questions about every Astria business area, even if the caller originally selected a different menu option.
If the caller asks about another Astria division, answer normally without telling the caller to hang up, call again, or return to the menu.
If the caller asks what Astria does, explain the company across all relevant business areas.

VERIFIED ASTRIA BUSINESS INFORMATION:
${companyKnowledge()}

Never invent partnerships, contracts, awards, approvals, pricing, availability, certifications, legal conclusions, tax conclusions, or guaranteed results.

There is no live transfer to a personal telephone.

If the caller asks for a human, representative, agent, staff member, or customer service, explain that consultation volume is currently high, the Astria team can follow up by phone or email, and the caller may choose option 7 from the main menu to leave a voice message.

Contact: info@goastria.com, https://www.goastria.com, +1-888-987-8767.`;
}

app.get('/', async () => ({
  status: 'ok',
  version: 'Astria New Master'
}));

app.all('/incoming-call', async (r,p) =>
  p.type('text/xml').send(menu(r))
);

app.all('/menu', async (r,p) => {
  const d = String(
    r.body?.Digits ??
    r.query?.Digits ??
    ''
  ).trim();

  if (!d || d === '9')
    return p.type('text/xml').send(menu(r));

  if (d === '7')
    return p.type('text/xml').send(voicemail(r));

  return p
    .type('text/xml')
    .send(serviceTwiml(r, SERVICES[d] ? d : '8'));
});

app.all('/after-ai', async (r,p) =>
  p.type('text/xml').send(menu(r))
);

app.all('/voicemail-done', async (r,p) =>
  p.type('text/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${say('Thank you. Your message has been received. A member of the Astria team will follow up with you. Goodbye.')}
</Response>`
  )
);

app.register(async server => {
  server.get('/media-stream', { websocket: true }, socket => {

    let streamSid = null;
    let service = SERVICES['8'];
    let aiOpen = false;
    let twilioOpen = false;
    let sessionReady = false;
    let configured = false;

    const pending = [];

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
      if (!aiOpen || !twilioOpen || configured)
        return;

      configured = true;

      sendAI({
        type: 'session.update',

        session: {
          type: 'realtime',
          output_modalities: ['audio'],
          instructions: prompt(service),

          audio: {
            input: {
              format: {
                type: 'audio/pcmu'
              },

              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 700,
                create_response: true,
                interrupt_response: true
              }
            },

            output: {
              format: {
                type: 'audio/pcmu'
              },

              voice: AI_VOICE,
              speed: AI_SPEED
            }
          }
        }
      });
    };

    ai.on('open', () => {
      aiOpen = true;
      configure();
    });

    ai.on('message', raw => {
      const e = JSON.parse(raw.toString());

      if (e.type === 'session.updated') {
        sessionReady = true;

        while (pending.length) {
          sendAI({
            type: 'input_audio_buffer.append',
            audio: pending.shift()
          });
        }
      }

      if (
        e.type === 'response.output_audio.delta' &&
        e.delta &&
        streamSid &&
        socket.readyState === WebSocket.OPEN
      ) {
        socket.send(
          JSON.stringify({
            event: 'media',
            streamSid,
            media: {
              payload: e.delta
            }
          })
        );
      }

      if (e.type === 'error') {
        console.error(
          'OpenAI Realtime error:',
          JSON.stringify(e)
        );
      }
    });

    socket.on('message', raw => {
      const d = JSON.parse(raw.toString());

      if (d.event === 'start') {
        streamSid = d.start?.streamSid;

        service =
          SERVICES[
            d.start?.customParameters?.service
          ] ||
          SERVICES['8'];

        twilioOpen = true;
        configure();
      }

      if (
        d.event === 'media' &&
        d.media?.payload
      ) {
        if (sessionReady) {
          sendAI({
            type: 'input_audio_buffer.append',
            audio: d.media.payload
          });
        } else if (pending.length < 150) {
          pending.push(d.media.payload);
        }
      }
    });

    ai.on('close', () => {
      if (socket.readyState === WebSocket.OPEN)
        socket.close();
    });

    ai.on('error', e =>
      console.error(
        'OpenAI WebSocket:',
        e.message
      )
    );

    socket.on('close', () => {
      if (ai.readyState === WebSocket.OPEN)
        ai.close();
    });
  });
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
      `Astria New Master listening on ${PORT}`
    );
  }
);
