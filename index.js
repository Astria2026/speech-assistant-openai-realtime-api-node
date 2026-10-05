import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

dotenv.config();

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const fastify = Fastify({
  logger: false
});

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);


// ============================================================
// ASTRIA AI VOICE — MASTER CONFIGURATION
// VERSION: V1
// ============================================================

const PORT = Number(process.env.PORT || 5050);

// Current production voice-agent model.
// Can be overridden later in Railway without changing source code.
const MODEL =
  process.env.OPENAI_REALTIME_MODEL ||
  'gpt-realtime-1.5';

// Astria AI conversational voice.
const VOICE =
  process.env.OPENAI_REALTIME_VOICE ||
  'shimmer';

// Slightly slower, calmer delivery.
const VOICE_SPEED = 0.93;

// Twilio menu voice.
// This is only used for the keypad menu before the AI stream starts.
const MENU_VOICE =
  'Google.en-US-Chirp3-HD-Aoede';


// ============================================================
// ASTRIA COMPANY INFORMATION
// ============================================================

const COMPANY = {
  brandName: 'Astria',
  legalName: 'Astria Corp.',
  website: 'https://www.goastria.com',
  email: 'info@goastria.com',
  phone: '+1-888-987-8767',
  address:
    '108 W 39th Street Ste 1006, New York, NY 10018, United States'
};


// ============================================================
// BUSINESS DEPARTMENTS
// ============================================================

const SERVICES = {
  '1': {
    key: 'space-aerospace',
    label: 'Space and Aerospace',
    language: 'en-US',
    connectMessage:
      'Thank you. Connecting you with Astria Space and Aerospace assistance.',
    scope: `
Space and Aerospace:
Astria supports strategic relationships, partnerships, business development,
and opportunity development across the space and aerospace ecosystem.

Do not claim that Astria manufactures spacecraft, launches rockets,
operates satellites, or represents NASA unless that information is
specifically provided in the conversation.
`
  },

  '2': {
    key: 'aviation',
    label: 'Aviation',
    language: 'en-US',
    connectMessage:
      'Thank you. Connecting you with Astria Aviation assistance.',
    scope: `
Aviation:
Astria works with aviation-related organizations, commercial partners,
industry relationships, business development opportunities, and
international connections.

Do not promise airline fares, upgrades, discounts, flight availability,
or contractual airline benefits unless specifically confirmed.
`
  },

  '3': {
    key: 'ai-technology',
    label: 'AI Technology',
    language: 'en-US',
    connectMessage:
      'Thank you. Connecting you with Astria AI Technology assistance.',
    scope: `
AI Technology:
Astria explores AI technology partnerships, enterprise applications,
business integration opportunities, and strategic technology relationships.

Do not claim that a specific AI product, integration, or implementation
is available unless it has been explicitly confirmed.
`
  },

  '4': {
    key: 'sports-hospitality',
    label: 'Sports Hospitality',
    language: 'en-US',
    connectMessage:
      'Thank you. Connecting you with Astria Sports Hospitality assistance.',
    scope: `
Sports Hospitality:
Astria works with premium sports hospitality, major-event opportunities,
strategic partnerships, corporate experiences, and related international
business opportunities.

Never guarantee tickets, suites, hospitality inventory, credentials,
event access, pricing, or availability unless explicitly confirmed.
`
  },

  '5': {
    key: 'government-procurement',
    label: 'Government Procurement Services',
    language: 'en-US',
    connectMessage:
      'Thank you. Connecting you with Astria Government Procurement Services.',
    scope: `
Government Procurement Services:
Astria provides assistance with government supplier and vendor registration,
application preparation and submission, and basic supplemental-document
follow-up.

The service does not include finding government projects,
preparing or submitting bids unless separately agreed,
guaranteeing contract awards,
or providing legal or tax services.

Never promise a government contract, award, approval, certification,
or registration outcome.
`
  },

  '6': {
    key: 'corporate-partnerships',
    label: 'Corporate Partnerships and Global Opportunities',
    language: 'en-US',
    connectMessage:
      'Thank you. Connecting you with Astria Corporate Partnerships assistance.',
    scope: `
Corporate Partnerships and Global Opportunities:
Astria connects innovation, capital, talent, organizations, and partners
across industries and borders.

Astria works with organizations and investors to identify opportunities,
develop strategic relationships, support international expansion,
and create long-term business value.

Astria bridges New York and global markets through relationships,
industry insight, and strategic connections.
`
  },

  '0': {
    key: 'general',
    label: 'General Assistance',
    language: 'en-US',
    connectMessage:
      'Thank you. Connecting you with Astria general assistance.',
    scope: `
General Assistance:
Help the caller identify which Astria business area is most relevant
and answer general questions about Astria.
`
  },

  '9': {
    key: 'mandarin',
    label: 'Mandarin Chinese Service',
    language: 'zh-CN',
    connectMessage:
      'Thank you. Connecting you with Astria Mandarin Chinese assistance.',
    scope: `
Mandarin Chinese Service:
Speak Mandarin Chinese naturally and professionally.

Begin by asking:
“感谢您致电 Astria，请问您需要咨询航空、航天、
人工智能技术、体育款待、政府采购服务，还是商务合作？”

Continue the conversation primarily in Mandarin Chinese unless
the caller requests another language.
`
  }
};

const SERVICE_BY_KEY = Object.fromEntries(
  Object.values(SERVICES).map(service => [
    service.key,
    service
  ])
);


// ============================================================
// ASTRIA MASTER AI INSTRUCTIONS
// ============================================================

function buildInstructions(service) {
  return `
# Identity

You are Astria's professional AI voice assistant.

The public-facing company name is Astria.
If a caller specifically asks for the legal company name,
the legal entity is Astria Corp.

Never claim to be a human employee.
If directly asked, clearly say you are Astria's AI voice assistant.


# Company Overview

Astria is a New York-based global business platform connecting
innovation, capital, talent, organizations, and opportunities
across industries and international markets.

Astria's primary areas include:

1. Space and Aerospace
2. Aviation
3. AI Technology
4. Sports Hospitality
5. Government Procurement Services
6. Corporate Partnerships and Global Opportunities

Website: ${COMPANY.website}
Email: ${COMPANY.email}
Telephone: ${COMPANY.phone}
New York office: ${COMPANY.address}


# Current Call Department

The caller selected:

${service.label}

Use the following department-specific information:

${service.scope}


# Personality

Sound like premium international airline cabin crew service:

- Warm
- Gentle
- Calm
- Polished
- Attentive
- Patient
- Professional
- Discreet
- Confident without sounding aggressive

Do not sound robotic.
Do not sound rushed.
Do not sound overly enthusiastic.
Do not use slang.
Do not speak in long paragraphs.


# Speaking Style

Use a soft, welcoming tone.

Speak clearly.

Use a slightly slower, elegant pace.

Keep most answers to approximately 1 to 3 short sentences,
unless the caller asks for more detail.

Allow the caller to finish speaking.

Do not interrupt unnecessarily.

If audio is unclear, politely ask the caller to repeat the request.


# Language

If this department is Mandarin Chinese Service,
speak Mandarin Chinese by default.

Otherwise:
- Begin in English.
- If the caller clearly speaks another language,
  respond naturally in that language when possible.
- Keep the company name “Astria” unchanged.


# Business Accuracy

Never invent facts.

Never invent:
- partnerships
- contracts
- government approvals
- event inventory
- ticket availability
- airline discounts
- pricing
- certifications
- project awards
- legal conclusions
- tax conclusions

Never promise an outcome.

If the requested information is not confirmed,
say that a member of the Astria team can provide further details.


# Actions and Human Assistance

This telephone version does not currently perform a live human transfer.

Do not falsely tell the caller that:
- you transferred the call
- you sent an email
- you submitted an application
- you created a reservation
- you placed an order
- you recorded a formal request

unless the software actually performed that action.

If the caller requests further human assistance,
politely provide:

${COMPANY.email}

and explain that the Astria team can follow up through the
appropriate business channel.


# Customer Experience

Always make the caller feel welcomed and professionally assisted.

When appropriate, ask one concise clarifying question at a time.

Examples:

“How may I assist you today?”

“May I ask which Astria service you are interested in?”

“Certainly. Could you tell me a little more about what you are looking for?”

“I'd be happy to help with that.”


# Closing

When the conversation appears complete, close politely.

Example:

“Thank you for contacting Astria. We appreciate your call and look forward
to assisting you.”
`;
}


// ============================================================
// XML HELPERS
// ============================================================

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPublicHost(request) {
  const forwardedHost =
    request.headers['x-forwarded-host'];

  const rawHost =
    forwardedHost ||
    request.headers.host ||
    '';

  return String(rawHost)
    .split(',')[0]
    .trim();
}


// ============================================================
// MAIN TELEPHONE MENU
// ============================================================

function buildMainMenuTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather
    input="dtmf"
    numDigits="1"
    timeout="8"
    action="/menu"
    method="POST"
    actionOnEmptyResult="true">
    <Say voice="${MENU_VOICE}">
      Thank you for calling Astria.
      Connecting global opportunities.
      For Space and Aerospace, press 1.
      For Aviation, press 2.
      For AI Technology, press 3.
      For Sports Hospitality, press 4.
      For Government Procurement Services, press 5.
      For Corporate Partnerships and Global Opportunities, press 6.
      For General Assistance, press 0.
      To repeat this menu, press 8.
      For Mandarin Chinese service, press 9.
    </Say>
  </Gather>
</Response>`;
}


// ============================================================
// CONNECT SELECTED DEPARTMENT TO AI
// ============================================================

function buildConnectTwiml(
  request,
  service
) {
  const host =
    getPublicHost(request);

  const websocketUrl =
    `wss://${host}/media-stream`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${MENU_VOICE}">
    ${xmlEscape(service.connectMessage)}
    Please tell us how we may assist you today.
  </Say>
  <Connect>
    <Stream url="${xmlEscape(websocketUrl)}">
      <Parameter
        name="service"
        value="${xmlEscape(service.key)}" />
      <Parameter
        name="language"
        value="${xmlEscape(service.language)}" />
    </Stream>
  </Connect>
</Response>`;
}


// ============================================================
// HEALTH CHECK
// ============================================================

fastify.get(
  '/',
  async () => {
    return {
      status: 'ok',
      service: 'Astria AI Voice',
      version: 'V1'
    };
  }
);

fastify.get(
  '/health',
  async () => {
    return {
      status: 'healthy',
      company: 'Astria',
      model: MODEL,
      voice: VOICE
    };
  }
);


// ============================================================
// TWILIO INCOMING CALL
// ============================================================

fastify.all(
  '/incoming-call',
  async (request, reply) => {
    reply
      .type('text/xml')
      .send(
        buildMainMenuTwiml()
      );
  }
);


// ============================================================
// MENU SELECTION
// ============================================================

fastify.all(
  '/menu',
  async (request, reply) => {
    const bodyDigits =
      request.body?.Digits;

    const queryDigits =
      request.query?.Digits;

    const digit =
      String(
        bodyDigits ??
        queryDigits ??
        ''
      ).trim();

    // Repeat menu
    if (digit === '8') {
      reply
        .type('text/xml')
        .send(
          buildMainMenuTwiml()
        );

      return;
    }

    // Invalid or no selection -> General Assistance
    const service =
      SERVICES[digit] ||
      SERVICES['0'];

    reply
      .type('text/xml')
      .send(
        buildConnectTwiml(
          request,
          service
        )
      );
  }
);


// ============================================================
// TWILIO MEDIA STREAM <-> OPENAI REALTIME
// ============================================================

fastify.register(
  async function (app) {

    app.get(
      '/media-stream',
      {
        websocket: true
      },
      (connection) => {

        console.log(
          'Twilio Media Stream connected'
        );


        // ----------------------------------------------------
        // CALL STATE
        // ----------------------------------------------------

        let streamSid = null;

        let latestMediaTimestamp = 0;

        let responseStartTimestampTwilio = null;

        let lastAssistantItem = null;

        let markQueue = [];

        let twilioStarted = false;

        let openAiConnected = false;

        let sessionConfigured = false;

        let selectedService =
          SERVICES['0'];

        const pendingAudio = [];


        // ----------------------------------------------------
        // OPENAI REALTIME CONNECTION
        // ----------------------------------------------------

        const openAiWs =
          new WebSocket(
            `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`,
            {
              headers: {
                Authorization:
                  `Bearer ${OPENAI_API_KEY}`
              }
            }
          );


        // ----------------------------------------------------
        // SAFE TWILIO SEND
        // ----------------------------------------------------

        function sendToTwilio(payload) {
          if (
            connection.readyState ===
            WebSocket.OPEN
          ) {
            connection.send(
              JSON.stringify(payload)
            );
          }
        }


        // ----------------------------------------------------
        // SAFE OPENAI SEND
        // ----------------------------------------------------

        function sendToOpenAI(payload) {
          if (
            openAiWs.readyState ===
            WebSocket.OPEN
          ) {
            openAiWs.send(
              JSON.stringify(payload)
            );

            return true;
          }

          return false;
        }


        // ----------------------------------------------------
        // CONFIGURE OPENAI SESSION
        // ----------------------------------------------------

        function maybeConfigureSession() {
          if (
            !twilioStarted ||
            !openAiConnected ||
            sessionConfigured
          ) {
            return;
          }

          const sessionUpdate = {
            type: 'session.update',

            session: {
              type: 'realtime',

              model: MODEL,

              output_modalities: [
                'audio'
              ],

              instructions:
                buildInstructions(
                  selectedService
                ),

              audio: {
                input: {
                  format: {
                    type: 'audio/pcmu'
                  },

                  turn_detection: {
                    type: 'server_vad',

                    threshold: 0.5,

                    prefix_padding_ms: 300,

                    silence_duration_ms: 600,

                    create_response: true,

                    interrupt_response: true
                  }
                },

                output: {
                  format: {
                    type: 'audio/pcmu'
                  },

                  voice: VOICE,

                  speed: VOICE_SPEED
                }
              }
            }
          };

          sendToOpenAI(
            sessionUpdate
          );

          console.log(
            `Configuring Astria AI session: ${selectedService.label}`
          );
        }


        // ----------------------------------------------------
        // FORWARD CALLER AUDIO
        // ----------------------------------------------------

        function forwardCallerAudio(
          audioPayload
        ) {
          if (
            sessionConfigured &&
            openAiWs.readyState ===
              WebSocket.OPEN
          ) {
            sendToOpenAI({
              type:
                'input_audio_buffer.append',

              audio:
                audioPayload
            });

            return;
          }

          // Briefly buffer audio while
          // OpenAI session finishes configuring.
          if (
            pendingAudio.length < 100
          ) {
            pendingAudio.push(
              audioPayload
            );
          }
        }


        // ----------------------------------------------------
        // FLUSH BUFFERED AUDIO
        // ----------------------------------------------------

        function flushPendingAudio() {
          while (
            pendingAudio.length > 0 &&
            openAiWs.readyState ===
              WebSocket.OPEN
          ) {
            const payload =
              pendingAudio.shift();

            sendToOpenAI({
              type:
                'input_audio_buffer.append',

              audio:
                payload
            });
          }
        }


        // ----------------------------------------------------
        // TWILIO MARK
        // ----------------------------------------------------

        function sendMark() {
          if (!streamSid) {
            return;
          }

          const markName =
            `astria-${Date.now()}`;

          sendToTwilio({
            event: 'mark',

            streamSid,

            mark: {
              name: markName
            }
          });

          markQueue.push(
            markName
          );
        }


        // ----------------------------------------------------
        // CALLER INTERRUPTS AI
        // ----------------------------------------------------

        function handleCallerInterruption() {
          if (!streamSid) {
            return;
          }

          if (
            markQueue.length === 0
          ) {
            return;
          }

          sendToTwilio({
            event: 'clear',
            streamSid
          });

          if (
            lastAssistantItem &&
            responseStartTimestampTwilio !==
              null
          ) {
            const elapsedTime =
              Math.max(
                0,
                latestMediaTimestamp -
                responseStartTimestampTwilio
              );

            sendToOpenAI({
              type:
                'conversation.item.truncate',

              item_id:
                lastAssistantItem,

              content_index: 0,

              audio_end_ms:
                elapsedTime
            });
          }

          markQueue = [];

          lastAssistantItem = null;

          responseStartTimestampTwilio =
            null;
        }


        // ----------------------------------------------------
        // OPENAI CONNECTED
        // ----------------------------------------------------

        openAiWs.on(
          'open',
          () => {
            console.log(
              'Connected to OpenAI Realtime API'
            );

            openAiConnected =
              true;

            maybeConfigureSession();
          }
        );


        // ----------------------------------------------------
        // OPENAI EVENTS
        // ----------------------------------------------------

        openAiWs.on(
          'message',
          rawData => {

            try {
              const event =
                JSON.parse(
                  rawData.toString()
                );


              // ----------------------------------------------
              // SESSION READY
              // ----------------------------------------------

              if (
                event.type ===
                'session.updated'
              ) {
                sessionConfigured =
                  true;

                console.log(
                  `Astria AI session ready: ${selectedService.label}`
                );

                flushPendingAudio();

                return;
              }


              // ----------------------------------------------
              // OPENAI AUDIO -> TWILIO
              //
              // Current Realtime GA event:
              // response.output_audio.delta
              //
              // response.audio.delta is also accepted below
              // only as a compatibility fallback.
              // ----------------------------------------------

              if (
                (
                  event.type ===
                    'response.output_audio.delta' ||
                  event.type ===
                    'response.audio.delta'
                ) &&
                event.delta
              ) {
                if (!streamSid) {
                  return;
                }

                sendToTwilio({
                  event: 'media',

                  streamSid,

                  media: {
                    payload:
                      event.delta
                  }
                });


                if (
                  responseStartTimestampTwilio ===
                  null
                ) {
                  responseStartTimestampTwilio =
                    latestMediaTimestamp;
                }


                if (
                  event.item_id
                ) {
                  lastAssistantItem =
                    event.item_id;
                }


                sendMark();

                return;
              }


              // ----------------------------------------------
              // CALLER STARTS SPEAKING
              // ----------------------------------------------

              if (
                event.type ===
                'input_audio_buffer.speech_started'
              ) {
                handleCallerInterruption();

                return;
              }


              // ----------------------------------------------
              // OPENAI ERROR
              // ----------------------------------------------

              if (
                event.type ===
                'error'
              ) {
                console.error(
                  'OpenAI Realtime error:',
                  JSON.stringify(
                    event
                  )
                );

                return;
              }

            } catch (error) {
              console.error(
                'Error processing OpenAI event:',
                error
              );
            }
          }
        );


        // ----------------------------------------------------
        // TWILIO EVENTS
        // ----------------------------------------------------

        connection.on(
          'message',
          rawMessage => {

            try {
              const data =
                JSON.parse(
                  rawMessage.toString()
                );


              switch (
                data.event
              ) {


                // --------------------------------------------
                // STREAM START
                // --------------------------------------------

                case 'start': {
                  streamSid =
                    data.start?.streamSid ||
                    data.streamSid;

                  latestMediaTimestamp =
                    0;

                  responseStartTimestampTwilio =
                    null;

                  const parameters =
                    data.start
                      ?.customParameters ||
                    {};

                  const serviceKey =
                    parameters.service ||
                    'general';

                  selectedService =
                    SERVICE_BY_KEY[
                      serviceKey
                    ] ||
                    SERVICES['0'];

                  twilioStarted =
                    true;

                  console.log(
                    `Twilio stream started: ${streamSid}`
                  );

                  console.log(
                    `Astria department: ${selectedService.label}`
                  );

                  maybeConfigureSession();

                  break;
                }


                // --------------------------------------------
                // CALLER AUDIO
                // --------------------------------------------

                case 'media': {
                  latestMediaTimestamp =
                    Number(
                      data.media
                        ?.timestamp ||
                      0
                    );

                  const payload =
                    data.media
                      ?.payload;

                  if (payload) {
                    forwardCallerAudio(
                      payload
                    );
                  }

                  break;
                }


                // --------------------------------------------
                // MARK COMPLETE
                // --------------------------------------------

                case 'mark': {
                  if (
                    markQueue.length > 0
                  ) {
                    markQueue.shift();
                  }

                  break;
                }


                // --------------------------------------------
                // CALL ENDS
                // --------------------------------------------

                case 'stop': {
                  console.log(
                    'Twilio stream stopped'
                  );

                  break;
                }


                default: {
                  break;
                }
              }

            } catch (error) {
              console.error(
                'Error processing Twilio event:',
                error
              );
            }
          }
        );


        // ----------------------------------------------------
        // TWILIO CLOSE
        // ----------------------------------------------------

        connection.on(
          'close',
          () => {
            console.log(
              'Caller disconnected'
            );

            if (
              openAiWs.readyState ===
              WebSocket.OPEN
            ) {
              openAiWs.close();
            }
          }
        );


        // ----------------------------------------------------
        // TWILIO ERROR
        // ----------------------------------------------------

        connection.on(
          'error',
          error => {
            console.error(
              'Twilio WebSocket error:',
              error
            );
          }
        );


        // ----------------------------------------------------
        // OPENAI CLOSE
        // ----------------------------------------------------

        openAiWs.on(
          'close',
          () => {
            console.log(
              'Disconnected from OpenAI Realtime API'
            );
          }
        );


        // ----------------------------------------------------
        // OPENAI ERROR
        // ----------------------------------------------------

        openAiWs.on(
          'error',
          error => {
            console.error(
              'OpenAI WebSocket error:',
              error
            );
          }
        );
      }
    );
  }
);


// ============================================================
// START ASTRIA AI VOICE SERVER
// ============================================================

fastify.listen(
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
      `Astria AI Voice V1 is listening on port ${PORT}`
    );
  }
);