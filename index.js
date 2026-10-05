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

const fastify = Fastify({ logger: false });

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);


// ============================================================
// ASTRIA AI VOICE
// V5 ENGLISH MASTER
// ============================================================

const PORT = Number(process.env.PORT || 5050);

const MODEL =
  process.env.OPENAI_REALTIME_MODEL ||
  'gpt-realtime-1.5';

const VOICE =
  process.env.OPENAI_REALTIME_VOICE ||
  'shimmer';

// Slower, softer AI delivery
const AI_VOICE_SPEED = 0.82;

// Stable Twilio English female voice
const MENU_VOICE = 'Polly.Joanna';

// Slower IVR menu and department introductions
const MENU_RATE = '85%';

const SESSION_TIMEOUT_MS = 10000;
const MAX_PENDING_AUDIO_FRAMES = 300;


// ============================================================
// COMPANY INFORMATION
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

  // ----------------------------------------------------------
  // 1 — AVIATION
  // ----------------------------------------------------------

  '1': {
    key: 'aviation',

    name: 'Aviation',

    intro:
      'Astria Aviation supports aviation industry relationships, strategic partnerships, international connections, and business development opportunities. Please tell me how I may assist you today.',

    scope: `
Astria develops aviation-related strategic relationships,
commercial partnerships,
business development opportunities,
and international industry connections.

Do not promise airline fares,
upgrades,
discounts,
flight availability,
or airline benefits
unless specifically confirmed by Astria.
`
  },


  // ----------------------------------------------------------
  // 2 — SPACE AND AEROSPACE
  // ----------------------------------------------------------

  '2': {
    key: 'space-aerospace',

    name: 'Space and Aerospace',

    intro:
      'Astria Space and Aerospace supports strategic partnerships, international industry relationships, and business development across the global space and aerospace ecosystem. Please tell me how I may assist you today.',

    scope: `
Astria supports strategic relationships,
partnerships,
business development,
and opportunity development
across the space and aerospace ecosystem.

Do not claim that Astria manufactures spacecraft,
launches rockets,
operates satellites,
or represents NASA
or another government agency
unless specifically confirmed.
`
  },


  // ----------------------------------------------------------
  // 3 — AI TECHNOLOGY
  // ----------------------------------------------------------

  '3': {
    key: 'ai-technology',

    name: 'AI Technology',

    intro:
      'Astria AI Technology focuses on strategic technology partnerships, enterprise applications, business integration, and international technology opportunities. Please tell me how I may assist you today.',

    scope: `
Astria explores AI technology partnerships,
enterprise applications,
business integration opportunities,
and strategic technology relationships.

Do not claim that a specific AI product,
integration,
or implementation is available
unless specifically confirmed.
`
  },


  // ----------------------------------------------------------
  // 4 — SPORTS HOSPITALITY
  // ----------------------------------------------------------

  '4': {
    key: 'sports-hospitality',

    name: 'Sports Hospitality',

    intro:
      'Astria Sports Hospitality focuses on premium sports hospitality, major event opportunities, corporate experiences, and strategic partnerships. Please tell me how I may assist you today.',

    scope: `
Astria works with premium sports hospitality,
major-event opportunities,
strategic partnerships,
corporate experiences,
and related international business opportunities.

Never guarantee tickets,
suites,
hospitality inventory,
credentials,
event access,
pricing,
or availability
unless specifically confirmed.
`
  },


  // ----------------------------------------------------------
  // 5 — GOVERNMENT PROCUREMENT
  // ----------------------------------------------------------

  '5': {
    key: 'government-procurement',

    name: 'Government Procurement Services',

    intro:
      'Astria Government Procurement Services assists with government supplier registration, application preparation and submission, and basic supplemental document follow-up. Please tell me how I may assist you today.',

    scope: `
Astria provides assistance
with government supplier and vendor registration,
application preparation and submission,
and basic supplemental-document follow-up.

The service does not include
finding government projects,
preparing or submitting bids unless separately agreed,
guaranteeing contract awards,
or providing legal or tax services.

Never promise a government contract,
award,
approval,
certification,
or registration outcome.
`
  },


  // ----------------------------------------------------------
  // 6 — BUSINESS COOPERATION
  // ----------------------------------------------------------

  '6': {
    key: 'business-cooperation',

    name: 'Business Cooperation and Global Opportunities',

    intro:
      'Astria connects innovation, capital, talent, organizations, and opportunities across industries and international markets. Please tell me how I may assist you today.',

    scope: `
Astria connects innovation,
capital,
and talent
across industries and borders.

Astria works with organizations and investors
to identify opportunities,
build strategic partnerships,
support international expansion,
and create long-term value.

Astria bridges New York
and global markets
through relationships,
industry insight,
and strategic connections.
`
  },


  // ----------------------------------------------------------
  // 0 — GENERAL ASSISTANCE
  // ----------------------------------------------------------

  '0': {
    key: 'general',

    name: 'General Assistance',

    intro:
      'You have reached Astria General Assistance. Astria works across aviation, space and aerospace, AI technology, sports hospitality, government procurement services, and global business cooperation. Please tell me how I may assist you today.',

    scope: `
Help the caller understand Astria,
identify the most relevant business area,
and answer general questions
using only verified company information.
`
  }

};


const SERVICE_BY_KEY =
  Object.fromEntries(
    Object.values(SERVICES).map(
      service => [
        service.key,
        service
      ]
    )
  );


// ============================================================
// AI KNOWLEDGE AND SERVICE STYLE
// ============================================================

function buildInstructions(service) {

  return `

You are Astria's professional AI voice assistant.


COMPANY IDENTITY

Public-facing company name:
Astria.

Legal entity,
only when specifically asked:
Astria Corp.

Never claim to be a human employee.

If directly asked,
clearly say you are Astria's AI voice assistant.


COMPANY OVERVIEW

Astria is a New York-based
global business platform
connecting innovation,
capital,
talent,
organizations,
and opportunities
across industries
and international markets.

Astria connects innovation,
capital,
and talent
across industries and borders.

We work with visionary organizations
and investors
to identify opportunities,
build strategic partnerships,
and drive sustainable growth.

Our global network
and industry expertise
help open doors,
accelerate expansion,
and create lasting value.

Astria bridges New York
and the world,
combining local insight
with global connections.

We work across industries
and markets
where relationships matter most.

By connecting
the right partners,
resources,
and opportunities,
we help organizations grow,
expand internationally,
and pursue long-term success.


CORE BUSINESS AREAS

1. Aviation

2. Space and Aerospace

3. AI Technology

4. Sports Hospitality

5. Government Procurement Services

6. Business Cooperation and Global Opportunities


Website:
${COMPANY.website}

Email:
${COMPANY.email}

Telephone:
${COMPANY.phone}

New York office:
${COMPANY.address}


CURRENT DEPARTMENT

${service.name}


DEPARTMENT INFORMATION

${service.scope}


SERVICE STYLE

Sound:

warm,

gentle,

calm,

polished,

attentive,

patient,

professional,

and discreet.


Your service style
should resemble
premium international airline
cabin crew service.


Speak clearly.

Speak slightly slower
than normal.

Keep most answers
to one to three short sentences
unless the caller asks
for more detail.

Ask one concise
clarifying question
at a time.

Let the caller finish speaking.

Do not interrupt unnecessarily.

Never sound robotic.

Never sound rushed.

Never sound theatrical.

Never sound overly casual.

Never sound excessively enthusiastic.

Never sound salesy.


LANGUAGE

Begin in English.

If the caller clearly speaks
or requests another language,
respond naturally
in that language when possible.

Keep the company name
Astria unchanged.


ACCURACY

Never invent
or imply unconfirmed:

partnerships,

contracts,

government approvals,

government awards,

project awards,

airline benefits,

ticket availability,

hospitality availability,

pricing,

certifications,

legal conclusions,

or tax conclusions.


Never promise an outcome.


If information is not confirmed,
explain that
the Astria team
can provide further details.


HUMAN ASSISTANCE

This version does not perform
a live human transfer.

It does not automatically create:

tickets,

reservations,

applications,

orders,

emails,

or formal requests.


Never falsely claim
that you:

transferred a call,

sent an email,

submitted an application,

created a reservation,

placed an order,

or recorded a formal request.


If the caller requests
human assistance,
provide:

${COMPANY.email}


CLOSING

When the conversation
is complete,
close politely
and concisely.

Example:

Thank you for contacting Astria.
We appreciate your call
and look forward to assisting you.

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
    request.headers[
      'x-forwarded-host'
    ];


  const rawHost =
    String(
      forwardedHost ||
      request.headers.host ||
      ''
    )
      .split(',')[0]
      .trim();


  if (
    !/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(
      rawHost
    )
  ) {

    throw new Error(
      'Invalid public host'
    );

  }


  return rawHost;

}


// ============================================================
// TWILIO SAY
// ============================================================

function sayBlock(text) {

  return `

<Say
  voice="${MENU_VOICE}"
  language="en-US">

  <prosody rate="${MENU_RATE}">
    ${xmlEscape(text)}
  </prosody>

</Say>

`;

}


// ============================================================
// MAIN MENU
// NO CHINESE MENU
// NO NUMBER 9
// ============================================================

function buildMainMenuTwiml(request) {

  const host =
    getPublicHost(request);


  const action =
    `https://${host}/menu`;


  const menuText = [

    'Thank you for calling Astria.',

    'For Aviation, press 1.',

    'For Space and Aerospace, press 2.',

    'For AI Technology, press 3.',

    'For Sports Hospitality, press 4.',

    'For Government Procurement Services, press 5.',

    'For Business Cooperation, press 6.',

    'For General Assistance, press 0.',

    'To hear this menu again, press 8.'

  ].join(' ');


  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  <Gather
    input="dtmf"
    numDigits="1"
    timeout="6"
    action="${xmlEscape(action)}"
    method="POST"
    actionOnEmptyResult="true">

    ${sayBlock(menuText)}

  </Gather>

</Response>`;

}


// ============================================================
// INVALID SELECTION
// ============================================================

function buildInvalidSelectionTwiml(request) {

  const host =
    getPublicHost(request);


  const redirect =
    `https://${host}/incoming-call`;


  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  ${sayBlock(
    'Sorry, that selection is not available. Please try again.'
  )}

  <Redirect method="POST">
    ${xmlEscape(redirect)}
  </Redirect>

</Response>`;

}


// ============================================================
// DEPARTMENT INTRODUCTION + AI CONNECTION
//
// IMPORTANT:
// Twilio first speaks the department introduction.
// Only AFTER that introduction finishes
// does Twilio enter the AI Media Stream.
// ============================================================

function buildConnectTwiml(
  request,
  service
) {

  const host =
    getPublicHost(request);


  const websocketUrl =
    `wss://${host}/media-stream`;


  const fallback =
    `We are sorry. The Astria AI assistant is temporarily unavailable. Please email ${COMPANY.email} or call again later.`;


  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  ${sayBlock(service.intro)}

  <Connect>

    <Stream
      url="${xmlEscape(websocketUrl)}">

      <Parameter
        name="service"
        value="${xmlEscape(service.key)}" />

    </Stream>

  </Connect>

  ${sayBlock(fallback)}

</Response>`;

}


// ============================================================
// HEALTH ROUTES
// ============================================================

fastify.get(
  '/',
  async () => ({
    status: 'ok',
    service: 'Astria AI Voice',
    version: 'V5-English'
  })
);


fastify.get(
  '/health',
  async () => ({
    status: 'healthy',
    company: 'Astria',
    model: MODEL,
    voice: VOICE,
    aiVoiceSpeed: AI_VOICE_SPEED
  })
);


// ============================================================
// INCOMING CALL
// ============================================================

fastify.all(
  '/incoming-call',
  async (
    request,
    reply
  ) => {

    try {

      console.log(
        'Incoming Astria call: main menu'
      );


      reply
        .type('text/xml')
        .send(
          buildMainMenuTwiml(
            request
          )
        );

    }

    catch (error) {

      console.error(
        'Incoming menu error:',
        error
      );


      reply
        .code(500)
        .type('text/plain')
        .send(
          'Configuration error'
        );

    }

  }
);


// ============================================================
// MENU SELECTION
// ============================================================

fastify.all(
  '/menu',
  async (
    request,
    reply
  ) => {

    try {

      const digit =
        String(

          request.body?.Digits ??
          request.query?.Digits ??
          ''

        ).trim();


      console.log(
        `Menu digit received: ${digit || '(none)'}`
      );


      // No selection
      if (!digit) {

        console.log(
          'No digit received. Connecting General Assistance.'
        );


        reply
          .type('text/xml')
          .send(

            buildConnectTwiml(

              request,

              SERVICES['0']

            )

          );


        return;

      }


      // Repeat menu
      if (
        digit === '8'
      ) {

        reply
          .type('text/xml')
          .send(

            buildMainMenuTwiml(
              request
            )

          );


        return;

      }


      // Invalid number
      if (

        !Object.prototype.hasOwnProperty.call(
          SERVICES,
          digit
        )

      ) {

        reply
          .type('text/xml')
          .send(

            buildInvalidSelectionTwiml(
              request
            )

          );


        return;

      }


      const service =
        SERVICES[digit];


      console.log(
        `Department selected: ${service.name}`
      );


      reply
        .type('text/xml')
        .send(

          buildConnectTwiml(

            request,

            service

          )

        );

    }

    catch (error) {

      console.error(
        'Menu selection error:',
        error
      );


      reply
        .code(500)
        .type('text/plain')
        .send(
          'Configuration error'
        );

    }

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

      connection => {


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

        let sessionTimeout = null;


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
        // CONNECTION STATUS
        // ----------------------------------------------------

        function twilioIsOpen() {

          return (
            connection.readyState ===
            WebSocket.OPEN
          );

        }


        function openAiIsOpen() {

          return (
            openAiWs.readyState ===
            WebSocket.OPEN
          );

        }


        // ----------------------------------------------------
        // SEND TO TWILIO
        // ----------------------------------------------------

        function sendToTwilio(payload) {

          if (
            !twilioIsOpen()
          ) {

            return false;

          }


          connection.send(
            JSON.stringify(
              payload
            )
          );


          return true;

        }


        // ----------------------------------------------------
        // SEND TO OPENAI
        // ----------------------------------------------------

        function sendToOpenAI(payload) {

          if (
            !openAiIsOpen()
          ) {

            return false;

          }


          openAiWs.send(
            JSON.stringify(
              payload
            )
          );


          return true;

        }


        // ----------------------------------------------------
        // SESSION TIMER
        // ----------------------------------------------------

        function clearSessionTimer() {

          if (
            sessionTimeout
          ) {

            clearTimeout(
              sessionTimeout
            );


            sessionTimeout = null;

          }

        }


        // ----------------------------------------------------
        // FALLBACK
        // ----------------------------------------------------

        function closeForFallback(reason) {

          console.error(
            `Closing AI stream for fallback: ${reason}`
          );


          clearSessionTimer();


          if (
            twilioIsOpen()
          ) {

            connection.close(
              1011,
              'AI backend unavailable'
            );

          }

        }


        // ----------------------------------------------------
        // CONFIGURE OPENAI REALTIME SESSION
        // ----------------------------------------------------

        function configureSession() {

          if (

            !twilioStarted ||

            !openAiConnected ||

            sessionConfigured

          ) {

            return;

          }


          console.log(

            `Configuring Astria AI session: ${selectedService.name}`

          );


          const sessionUpdate = {

            type: 'session.update',

            session: {

              type: 'realtime',

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
                      650,

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
                    VOICE,

                  speed:
                    AI_VOICE_SPEED

                }

              }

            }

          };


          sessionTimeout =
            setTimeout(

              () => {

                if (
                  !sessionConfigured
                ) {

                  closeForFallback(
                    'OpenAI session setup timed out'
                  );

                }

              },

              SESSION_TIMEOUT_MS

            );


          sendToOpenAI(
            sessionUpdate
          );

        }


        // ----------------------------------------------------
        // FLUSH BUFFERED CALLER AUDIO
        // ----------------------------------------------------

        function flushPendingAudio() {

          while (

            pendingAudio.length > 0 &&

            openAiIsOpen()

          ) {

            sendToOpenAI({

              type:
                'input_audio_buffer.append',

              audio:
                pendingAudio.shift()

            });

          }

        }


        // ----------------------------------------------------
        // TWILIO MARK
        // ----------------------------------------------------

        function sendMark() {

          if (
            !streamSid
          ) {

            return;

          }


          const markName =
            `astria-${Date.now()}-${markQueue.length}`;


          if (

            sendToTwilio({

              event: 'mark',

              streamSid,

              mark: {
                name:
                  markName
              }

            })

          ) {

            markQueue.push(
              markName
            );

          }

        }


        // ----------------------------------------------------
        // CALLER INTERRUPTS AI
        // ----------------------------------------------------

        function handleCallerInterruption() {

          if (

            !streamSid ||

            markQueue.length === 0

          ) {

            return;

          }


          // Clear queued Twilio AI audio
          sendToTwilio({

            event: 'clear',

            streamSid

          });


          // Truncate current OpenAI assistant audio
          if (

            lastAssistantItem &&

            responseStartTimestampTwilio !==
              null

          ) {

            const elapsedTime =
              Math.max(

                0,

                Number(
                  latestMediaTimestamp
                ) -

                Number(
                  responseStartTimestampTwilio
                )

              );


            sendToOpenAI({

              type:
                'conversation.item.truncate',

              item_id:
                lastAssistantItem,

              content_index:
                0,

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


            configureSession();

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


                clearSessionTimer();


                console.log(

                  `Astria AI session ready: ${selectedService.name}`

                );


                flushPendingAudio();


                return;

              }


              // ----------------------------------------------
              // OPENAI AUDIO -> TWILIO
              // ----------------------------------------------

              if (

                event.type ===
                  'response.output_audio.delta' &&

                event.delta

              ) {

                if (
                  !streamSid
                ) {

                  return;

                }


                if (

                  responseStartTimestampTwilio ===
                    null

                ) {

                  responseStartTimestampTwilio =
                    Number(
                      latestMediaTimestamp
                    ) || 0;

                }


                if (
                  event.item_id
                ) {

                  lastAssistantItem =
                    event.item_id;

                }


                sendToTwilio({

                  event: 'media',

                  streamSid,

                  media: {

                    payload:
                      event.delta

                  }

                });


                sendMark();


                return;

              }


              // ----------------------------------------------
              // CALLER STARTS TALKING
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


                closeForFallback(
                  'OpenAI API error'
                );

              }

            }

            catch (error) {

              console.error(

                'Error processing OpenAI event:',

                error

              );

            }

          }
        );


        // ----------------------------------------------------
        // TWILIO MEDIA STREAM EVENTS
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


                  latestMediaTimestamp = 0;

                  responseStartTimestampTwilio =
                    null;

                  lastAssistantItem = null;

                  markQueue = [];


                  const parameters =
                    data.start?.customParameters ||
                    {};


                  selectedService =

                    SERVICE_BY_KEY[
                      parameters.service
                    ] ||

                    SERVICES['0'];


                  twilioStarted = true;


                  console.log(

                    `Twilio stream started: ${streamSid}`

                  );


                  console.log(

                    `Astria department: ${selectedService.name}`

                  );


                  configureSession();


                  break;

                }


                // --------------------------------------------
                // CALLER AUDIO
                // --------------------------------------------

                case 'media': {

                  latestMediaTimestamp =
                    Number(
                      data.media?.timestamp ||
                      0
                    );


                  const payload =
                    data.media?.payload;


                  if (
                    !payload
                  ) {

                    break;

                  }


                  if (

                    sessionConfigured &&

                    openAiIsOpen()

                  ) {

                    sendToOpenAI({

                      type:
                        'input_audio_buffer.append',

                      audio:
                        payload

                    });

                  }

                  else if (

                    pendingAudio.length <
                    MAX_PENDING_AUDIO_FRAMES

                  ) {

                    pendingAudio.push(
                      payload
                    );

                  }


                  break;

                }


                // --------------------------------------------
                // TWILIO MARK COMPLETE
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
                // STREAM STOPPED
                // --------------------------------------------

                case 'stop': {

                  console.log(
                    'Twilio stream stopped'
                  );


                  break;

                }


                default:

                  break;

              }

            }

            catch (error) {

              console.error(

                'Error processing Twilio event:',

                error

              );

            }

          }
        );


        // ----------------------------------------------------
        // CALLER DISCONNECTED
        // ----------------------------------------------------

        connection.on(
          'close',
          () => {

            console.log(
              'Caller disconnected'
            );


            clearSessionTimer();


            if (
              openAiIsOpen()
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
        // OPENAI CLOSED
        // ----------------------------------------------------

        openAiWs.on(
          'close',
          (
            code,
            reason
          ) => {

            console.log(

              `Disconnected from OpenAI Realtime API: ${code} ${reason?.toString?.() || ''}`

            );


            clearSessionTimer();

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


            closeForFallback(
              'OpenAI WebSocket error'
            );

          }
        );

      }

    );

  }
);


// ============================================================
// START SERVER
// ============================================================

fastify.listen(

  {

    port:
      PORT,

    host:
      '0.0.0.0'

  },

  err => {

    if (
      err
    ) {

      console.error(
        err
      );


      process.exit(
        1
      );

    }


    console.log(

      `Astria AI Voice V5 English Master is listening on port ${PORT}`

    );

  }

);