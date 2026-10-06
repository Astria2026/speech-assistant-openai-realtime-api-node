import Fastify from 'fastify';
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

const TEXT_MODEL =
  process.env.OPENAI_TEXT_MODEL ||
  'gpt-6-luna';

const MENU_VOICE =
  'Google.en-US-Chirp3-HD-Aoede';

const ENGLISH_RELAY_VOICE =
  'en-US-Chirp3-HD-Aoede';

const CHINESE_RELAY_VOICE =
  'cmn-TW-Wavenet-A';


const SERVICES = {

  '1': [
    'Aviation',

    'Astria advances global mobility and aviation opportunities. We work across airlines, airports, mobility, and aviation services, helping organizations build strategic alliances, expand market access, and connect with partners across international markets. Through industry relationships and commercial insight, Astria supports business development and long-term growth across the aviation ecosystem.'
  ],

  '2': [
    'Space and Aerospace',

    'Astria connects innovation and infrastructure for the future. Our work spans commercial space, satellite and infrastructure opportunities, advanced manufacturing, and global partnerships. We help organizations identify strategic relationships, explore new markets, and build connections across the international space and aerospace ecosystem.'
  ],

  '3': [
    'AI Technology',

    'Astria empowers businesses through intelligent solutions. Our AI technology work includes enterprise AI, AI automation, AI integration, and emerging technology partnerships. We help organizations explore practical applications, connect with technology partners, and identify opportunities for business transformation and growth.'
  ],

  '4': [
    'Sports Hospitality',

    'Astria creates unforgettable experiences that bring people together. Our sports hospitality work includes premium hospitality, major sporting events, corporate experiences, and strategic partnerships. We connect organizations with opportunities that support relationship building, brand engagement, and high-value experiences around major events.'
  ],

  '5': [
    'Government Procurement Services',

    'Astria Government Procurement Services assists companies with supplier and vendor registration, application preparation and submission, and basic supplemental-document follow-up. We help businesses navigate registration and administrative requirements for government procurement participation. Astria does not guarantee approvals, awards, or contracts, and legal or tax services are not included.'
  ],

  '6': [
    'Business Cooperation',

    'Astria helps organizations identify growth opportunities, form strategic partnerships, enter new markets, and connect with decision-makers and resources across industries and borders. Our work includes business development, strategic partnerships, global market access, and commercial advisory. We combine a New York perspective with global relationships to support international expansion and long-term value creation.'
  ],

  '8': [
    'General Assistance',

    'Astria connects organizations, ideas, and opportunities across aviation, space and aerospace, AI technology, sports hospitality, government procurement services, and business cooperation. Through global relationships, industry insight, and strategic collaboration, we help partners explore new markets, build meaningful connections, and create long-term value.'
  ]
};


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
  <Gather
    input="dtmf"
    numDigits="1"
    timeout="6"
    action="https://${h}/menu"
    method="POST"
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

  <Connect
    action="https://${h}/after-ai"
    method="POST">

    <ConversationRelay
      url="wss://${h}/conversation-relay"
      transcriptionLanguage="multi"
      transcriptionProvider="Deepgram"
      ttsLanguage="en-US"
      ttsProvider="Google"
      voice="${ENGLISH_RELAY_VOICE}"
      interruptible="speech">

      <Language
        code="en-US"
        ttsProvider="Google"
        voice="${ENGLISH_RELAY_VOICE}" />

      <Language
        code="cmn-TW"
        ttsProvider="Google"
        voice="${CHINESE_RELAY_VOICE}" />

      <Parameter
        name="service"
        value="${digit}" />

    </ConversationRelay>

  </Connect>

</Response>`;
}


function voicemail(r) {

  const h = host(r);

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


function companyKnowledge() {

  return Object.values(SERVICES)
    .map(
      ([name, info]) =>
        `${name}: ${info}`
    )
    .join('\n\n');
}


function instructions(service) {

  return `
You are Astria's professional company-wide telephone assistant.

The caller initially selected ${service[0]}.

Treat this only as the caller's starting area of interest.
It is not a restriction.

LANGUAGE:

Reply in the language used by the caller.

If the caller speaks English, reply in English.

If the caller speaks Chinese, reply in natural Mandarin Chinese.

If the caller changes languages, follow the caller.

If asked whether you speak Chinese, say:
"会，我可以用中文普通话为您服务。"

If asked what kind of Chinese you speak, say:
"我使用中文普通话为您服务。"

Do not discuss accents, regional speech styles, voice settings, sweetness, femininity, or internal voice configuration.

Never tell callers that you are using a Taiwanese accent, Taiwan Mandarin, a sweet voice, a gentle voice, or an airline-style voice.

STYLE:

Be warm, polished, attentive, friendly, concise, and professional.

Provide a premium international hospitality experience.

COMPANY-WIDE ASSISTANCE:

You are an Astria company-wide assistant.

You may answer questions about every Astria business area regardless of which menu option the caller selected.

If the caller asks about another Astria division, answer normally.

Do not ask the caller to hang up, redial, or return to the menu simply because they ask about another Astria business area.

VERIFIED ASTRIA BUSINESS INFORMATION:

${companyKnowledge()}

RULES:

Never invent partnerships, contracts, awards, approvals, pricing, availability, certifications, legal conclusions, tax conclusions, or guaranteed results.

There is no live transfer to a personal telephone.

If the caller asks for a human, representative, agent, staff member, or customer service, explain that consultation volume is currently high.

Explain that the Astria team can follow up by phone or email.

The caller may leave a voice message through option 7 on the main menu.

CONTACT:

info@goastria.com

https://www.goastria.com

+1-888-987-8767
`;
}


function normalizeLanguage(lang, text) {

  const value =
    String(lang || '')
      .toLowerCase();

  if (
    value.startsWith('zh') ||
    value.startsWith('cmn')
  ) {
    return 'cmn-TW';
  }

  if (
    value.startsWith('en')
  ) {
    return 'en-US';
  }

  if (
    /[\u3400-\u9FFF]/.test(text)
  ) {
    return 'cmn-TW';
  }

  return 'en-US';
}


function extractOutputText(data) {

  const parts = [];

  for (
    const item of
    data?.output || []
  ) {

    if (
      item?.type !== 'message'
    ) {
      continue;
    }

    for (
      const content of
      item?.content || []
    ) {

      if (
        content?.type === 'output_text' &&
        content?.text
      ) {

        parts.push(
          content.text
        );
      }
    }
  }

  return parts
    .join('')
    .trim();
}


async function askOpenAI(
  service,
  text,
  language,
  previousResponseId
) {

  const languageInstruction =
    language === 'cmn-TW'
      ? 'The caller spoke Mandarin Chinese. Reply only in natural Mandarin Chinese.'
      : 'The caller spoke English. Reply only in natural English.';

  const body = {

    model: TEXT_MODEL,

    instructions:
      instructions(service),

    input:
      `${languageInstruction}\n\nCaller: ${text}`,

    max_output_tokens: 220,

    store: true
  };

  if (
    previousResponseId
  ) {

    body.previous_response_id =
      previousResponseId;
  }

  const response =
    await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${KEY}`,

          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify(body)
      }
    );

  if (
    !response.ok
  ) {

    const detail =
      await response.text();

    throw new Error(
      `OpenAI Responses ${response.status}: ${detail}`
    );
  }

  const data =
    await response.json();

  const answer =
    extractOutputText(data);

  if (
    !answer
  ) {

    throw new Error(
      'OpenAI returned no text'
    );
  }

  return {
    answer,
    responseId:
      data.id
  };
}


app.get(
  '/',
  async () => ({
    status: 'ok',
    version: 'Astria Taiwan Voice Master V2'
  })
);


app.all(
  '/incoming-call',
  async (r, p) =>
    p
      .type('text/xml')
      .send(menu(r))
);


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
    ) {

      return p
        .type('text/xml')
        .send(menu(r));
    }

    if (
      d === '7'
    ) {

      return p
        .type('text/xml')
        .send(voicemail(r));
    }

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


app.all(
  '/after-ai',
  async (r, p) =>
    p
      .type('text/xml')
      .send(menu(r))
);


app.all(
  '/voicemail-done',
  async (r, p) =>
    p
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


app.register(
  async server => {

    server.get(
      '/conversation-relay',
      {
        websocket: true
      },

      socket => {

        let service =
          SERVICES['8'];

        let previousResponseId =
          null;

        let busy =
          false;

        const pending =
          [];


        const send =
          payload => {

            if (
              socket.readyState === 1
            ) {

              socket.send(
                JSON.stringify(payload)
              );
            }
          };


        const switchTTSLanguage =
          lang => {

            send({
              type: 'language',
              ttsLanguage: lang
            });
          };


        const processNext =
          async () => {

            if (
              busy ||
              pending.length === 0
            ) {
              return;
            }

            busy = true;

            const item =
              pending.shift();

            try {

              const result =
                await askOpenAI(
                  service,
                  item.text,
                  item.lang,
                  previousResponseId
                );

              previousResponseId =
                result.responseId;

              switchTTSLanguage(
                item.lang
              );

              send({
                type: 'text',

                token:
                  result.answer,

                lang:
                  item.lang,

                last:
                  true,

                interruptible:
                  true,

                preemptible:
                  false
              });

            } catch (e) {

              console.error(
                'Astria AI error:',
                e.message
              );

              const fallback =
                item.lang === 'cmn-TW'
                  ? '抱歉，刚才连接出现了一点问题，请您再说一次。'
                  : 'I am sorry, there was a brief connection issue. Please say that again.';

              switchTTSLanguage(
                item.lang
              );

              send({
                type: 'text',

                token:
                  fallback,

                lang:
                  item.lang,

                last:
                  true,

                interruptible:
                  true,

                preemptible:
                  false
              });
            }

            busy = false;

            processNext();
          };


        socket.on(
          'message',
          raw => {

            let message;

            try {

              message =
                JSON.parse(
                  raw.toString()
                );

            } catch {

              return;
            }


            if (
              message.type === 'setup'
            ) {

              service =
                SERVICES[
                  message
                    .customParameters
                    ?.service
                ] ||
                SERVICES['8'];

              console.log(
                `ConversationRelay ready: ${service[0]}`
              );

              return;
            }


            if (
              message.type === 'prompt' &&
              message.last === true &&
              message.voicePrompt
            ) {

              const text =
                String(
                  message.voicePrompt
                ).trim();

              if (
                !text
              ) {
                return;
              }

              const lang =
                normalizeLanguage(
                  message.lang,
                  text
                );

              pending.push({
                text,
                lang
              });

              processNext();

              return;
            }


            if (
              message.type === 'interrupt'
            ) {

              return;
            }


            if (
              message.type === 'error'
            ) {

              console.error(
                'Twilio ConversationRelay error:',
                message.description
              );
            }
          }
        );


        socket.on(
          'error',
          e =>
            console.error(
              'ConversationRelay WebSocket:',
              e.message
            )
        );


        socket.on(
          'close',
          () => {

            console.log(
              'ConversationRelay closed'
            );
          }
        );
      }
    );
  }
);


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
      `Astria Taiwan Voice Master V2 listening on ${PORT}`
    );
  }
);
