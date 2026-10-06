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

/*
  OpenAI 现在负责文字回答。
  如果以后要更换模型，只改这里。
*/
const TEXT_MODEL =
  process.env.OPENAI_TEXT_MODEL ||
  'gpt-6-luna';

/*
  开场与主菜单仍保持原来的女声。
*/
const MENU_VOICE =
  'Google.en-US-Chirp3-HD-Aoede';

/*
  ConversationRelay 英文女声
*/
const ENGLISH_RELAY_VOICE =
  'en-US-Chirp3-HD-Aoede';

/*
  真正的台湾普通话女性 Neural Voice
*/
const CHINESE_RELAY_VOICE =
  'cmn-TW-Wavenet-A';


/* =========================
   ASTRIA SERVICES
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


const say = s =>
  `<Say voice="${MENU_VOICE}" language="en-US"><prosody rate="82%">${esc(s)}</prosody></Say>`;


/* =========================
   MAIN MENU
========================= */

function menu(r) {

  const h =
    host(r);


  const text =
    'Thank you for calling Astria. ' +

    'Astria connects organizations, ideas, and opportunities across aviation, ' +
    'space and aerospace, AI technology, sports hospitality, ' +
    'government procurement services, and business cooperation. ' +

    'Through global relationships, industry insight, and strategic collaboration, ' +
    'we help partners explore new markets, build meaningful connections, ' +
    'and create long-term value. ' +

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


/* =========================
   SERVICE + CONVERSATION RELAY
========================= */

function serviceTwiml(r, digit) {

  const h =
    host(r);

  const s =
    SERVICES[digit];


  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>

  ${say(
    `${s[1]} How may I assist you today?`
  )}

  <Connect
    action="https://${h}/after-ai"
    method="POST">

    <ConversationRelay
      url="wss://${h}/conversation-relay"
      transcriptionLanguage="multi"
      transcriptionProvider="Deepgram"
      ttsLanguage="en-US"
      welcomeGreetingInterruptible="any">

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


/* =========================
   VOICEMAIL
========================= */

function voicemail(r) {

  const h =
    host(r);


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


/* =========================
   COMPANY KNOWLEDGE
========================= */

function companyKnowledge() {

  return Object.values(SERVICES)

    .map(
      ([name, info]) =>
        `${name}: ${info}`
    )

    .join('\n\n');
}


/* =========================
   OPENAI INSTRUCTIONS
========================= */

function instructions(service) {

  return `
You are Astria's professional company-wide telephone assistant.

The caller initially selected ${service[0]}.

Treat that only as the caller's starting area of interest.
Never treat it as a restriction.

LANGUAGE:

Reply in the language used by the caller's current utterance.

If the caller speaks English, reply in English.

If the caller speaks Chinese, reply in Mandarin Chinese.

If the caller changes languages, follow the caller.

If asked whether you speak Chinese, say that you can provide service in Mandarin Chinese.

If asked what kind of Chinese you speak, say Mandarin Chinese.

If asked about accent, regional speech style, voice style, sweetness, softness, femininity, or how your voice sounds, do not discuss any internal voice configuration.

Simply say that you can assist in Mandarin Chinese or English as appropriate.

Never mention Taiwan, Taiwanese accent, Taiwan Mandarin, internal voice settings, sweet voice, gentle voice, airline voice, or any voice prompt.

STYLE:

Be warm, polished, attentive, concise, friendly, and professional.

The customer experience should feel like premium international hospitality service.

Do not describe your own voice or speaking style to the caller.

COMPANY-WIDE ASSISTANCE:

You are an Astria company-wide assistant.

You may answer questions about every Astria business area even if the caller originally selected another menu option.

If the caller asks about another Astria division, answer normally.

Never tell the caller to hang up, call again, or return to the menu simply because they ask about another Astria business area.

If the caller asks what Astria does, explain the company across all relevant business areas.

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


/* =========================
   LANGUAGE DETECTION
========================= */

function normalizeLanguage(
  lang,
  text
) {

  const value =
    String(
      lang || ''
    ).toLowerCase();


  if (
    value.startsWith('zh') ||
    value.startsWith('cmn')
  )

    return 'cmn-TW';


  if (
    value.startsWith('en')
  )

    return 'en-US';


  /*
    Backup detection in case
    Twilio does not return lang.
  */

  if (
    /[\u3400-\u9FFF]/.test(text)
  )

    return 'cmn-TW';


  return 'en-US';
}


/* =========================
   VOICE STYLE
========================= */

function speechToken(
  text,
  lang
) {

  const safe =
    esc(text);


  /*
    中文：
    台湾普通话女声
    稍微提高音高
    语速稍慢
    让声音更轻、更亮、更年轻
  */

  if (
    lang === 'cmn-TW'
  ) {

    return (
      '<speak>' +
      '<prosody rate="92%" pitch="+2st">' +
      safe +
      '</prosody>' +
      '</speak>'
    );
  }


  /*
    英文保持高端女性服务感
  */

  return (
    '<speak>' +
    '<prosody rate="94%">' +
    safe +
    '</prosody>' +
    '</speak>'
  );
}


/* =========================
   OPENAI RESPONSE PARSER
========================= */

function extractOutputText(data) {

  const parts =
    [];


  for (
    const item of
    data?.output || []
  ) {

    if (
      item?.type !==
      'message'
    )

      continue;


    for (
      const content of
      item?.content || []
    ) {

      if (
        content?.type ===
          'output_text' &&

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


/* =========================
   OPENAI TEXT AI
========================= */

async function askOpenAI(
  service,
  history,
  userText,
  replyLanguage
) {

  const languageInstruction =

    replyLanguage ===
      'cmn-TW'

      ? 'The caller spoke Mandarin Chinese. Reply only in natural Mandarin Chinese.'

      : 'The caller spoke English. Reply only in natural English.';


  const input = [

    ...history.slice(-10),

    {
      role: 'user',

      content:
        `${languageInstruction}\n\nCaller: ${userText}`
    }
  ];


  const response =
    await fetch(
      'https://api.openai.com/v1/responses',

      {
        method:
          'POST',

        headers: {

          Authorization:
            `Bearer ${KEY}`,

          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify({

            model:
              TEXT_MODEL,

            instructions:
              instructions(service),

            input,

            max_output_tokens:
              220,

            store:
              false
          })
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


  const text =
    extractOutputText(data);


  if (
    !text
  )

    throw new Error(
      'OpenAI returned no text'
    );


  return text;
}


/* =========================
   STATUS
========================= */

app.get(
  '/',

  async () => ({

    status:
      'ok',

    version:
      'Astria Taiwan Voice Master'
  })
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
   MENU
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


    if (
      d === '7'
    )

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
   VOICEMAIL DONE
========================= */

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


/* =========================
   CONVERSATION RELAY
========================= */

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


        const history =
          [];


        const queue =
          [];


        let busy =
          false;


/* =========================
   SEND TO TWILIO
========================= */

        const send =
          payload => {

            if (
              socket.readyState ===
              1
            ) {

              socket.send(
                JSON.stringify(
                  payload
                )
              );
            }
          };


/* =========================
   PROCESS CALLER MESSAGE
========================= */

        const processQueue =
          async () => {

            if (
              busy ||
              !queue.length
            )

              return;


            busy =
              true;


            const item =
              queue.shift();


            try {

              const answer =
                await askOpenAI(

                  service,

                  history,

                  item.text,

                  item.lang
                );


              history.push({

                role:
                  'user',

                content:
                  item.text
              });


              history.push({

                role:
                  'assistant',

                content:
                  answer
              });


              /*
                Keep only recent context
                so phone responses stay fast.
              */

              if (
                history.length >
                12
              ) {

                history.splice(

                  0,

                  history.length -
                    12
                );
              }


              send({

                type:
                  'text',

                token:
                  speechToken(
                    answer,
                    item.lang
                  ),

                lang:
                  item.lang,

                last:
                  true,

                interruptible:
                  true,

                preemptible:
                  true
              });

            } catch (e) {

              console.error(
                'Astria AI error:',
                e.message
              );


              const fallback =

                item.lang ===
                  'cmn-TW'

                  ? '抱歉，我刚才遇到了一点连接问题。请您再说一次。'

                  : 'I am sorry, I encountered a brief connection issue. Please say that again.';


              send({

                type:
                  'text',

                token:
                  speechToken(
                    fallback,
                    item.lang
                  ),

                lang:
                  item.lang,

                last:
                  true,

                interruptible:
                  true,

                preemptible:
                  true
              });
            }


            busy =
              false;


            processQueue();
          };


/* =========================
   TWILIO EVENTS
========================= */

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


/* =========================
   SETUP
========================= */

            if (
              message.type ===
              'setup'
            ) {

              service =

                SERVICES[
                  message
                    .customParameters
                    ?.service
                ] ||

                SERVICES['8'];


              return;
            }


/* =========================
   CALLER SPEECH
========================= */

            if (
              message.type ===
                'prompt' &&

              message.last ===
                true &&

              message.voicePrompt
            ) {

              const text =
                String(
                  message.voicePrompt
                ).trim();


              if (
                !text
              )

                return;


              const lang =
                normalizeLanguage(

                  message.lang,

                  text
                );


              queue.push({

                text,

                lang
              });


              processQueue();


              return;
            }


/* =========================
   TWILIO ERROR
========================= */

            if (
              message.type ===
              'error'
            ) {

              console.error(

                'Twilio ConversationRelay error:',

                message.description
              );
            }
          }
        );


/* =========================
   SOCKET ERROR
========================= */

        socket.on(
          'error',

          e =>

            console.error(

              'ConversationRelay WebSocket:',

              e.message
            )
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

      `Astria Taiwan Voice Master listening on ${PORT}`

    );
  }
);
