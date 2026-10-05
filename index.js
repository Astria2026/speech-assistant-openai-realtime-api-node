import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import formbody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

dotenv.config();

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY');
}

const app = Fastify({ logger: false });

app.register(formbody);
app.register(fastifyWs);


// ============================================================
// ASTRIA AI VOICE
// V6 SIMPLE RECEPTION MASTER
// ============================================================

const PORT = Number(
  process.env.PORT || 5050
);

const MODEL =
  process.env.OPENAI_REALTIME_MODEL ||
  'gpt-realtime-1.5';

// Restore original gentle female menu voice
const MENU_VOICE =
  'Google.en-US-Chirp3-HD-Aoede';

// AI conversation voice
const AI_VOICE =
  'shimmer';


// ============================================================
// BUSINESS SERVICES
// ============================================================

const SERVICES = {

  '1': {
    key: 'aviation',
    name: 'Aviation',

    intro:
      'Astria Aviation connects aviation industry relationships, strategic partnerships, international resources, and business development opportunities.'
  },


  '2': {
    key: 'space',
    name: 'Space and Aerospace',

    intro:
      'Astria Space and Aerospace supports strategic partnerships, international industry relationships, and business development across the global space and aerospace sector.'
  },


  '3': {
    key: 'ai',
    name: 'AI Technology',

    intro:
      'Astria AI Technology focuses on strategic technology partnerships, enterprise applications, business integration, and international technology opportunities.'
  },


  '4': {
    key: 'sports',
    name: 'Sports Hospitality',

    intro:
      'Astria Sports Hospitality focuses on premium sports hospitality, major event opportunities, corporate experiences, and strategic partnerships.'
  },


  '5': {
    key: 'government',
    name: 'Government Procurement Services',

    intro:
      'Astria Government Procurement Services assists with government supplier registration, application preparation and submission, and basic supplemental document follow-up.'
  },


  '6': {
    key: 'business',
    name: 'Business Cooperation',

    intro:
      'Astria connects innovation, capital, talent, organizations, and opportunities across industries and international markets.'
  },


  '0': {
    key: 'general',
    name: 'General Assistance',

    intro:
      'Astria provides general assistance across aviation, space and aerospace, AI technology, sports hospitality, government procurement services, and business cooperation.'
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
// HELPERS
// ============================================================

function escapeXml(value = '') {

  return String(value)

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&apos;');

}


function getHost(request) {

  return String(

    request.headers[
      'x-forwarded-host'
    ] ||

    request.headers.host ||

    ''

  )

    .split(',')[0]

    .trim();

}


function say(text) {

  return `

<Say
  voice="${MENU_VOICE}"
  language="en-US">

  <prosody rate="88%">
    ${escapeXml(text)}
  </prosody>

</Say>

`;

}


// ============================================================
// MAIN MENU
// ============================================================

function buildMenu(request) {

  const action =
    `https://${getHost(request)}/menu`;


  const text =
    'Thank you for calling Astria. ' +

    'For Aviation, press 1. ' +

    'For Space and Aerospace, press 2. ' +

    'For AI Technology, press 3. ' +

    'For Sports Hospitality, press 4. ' +

    'For Government Procurement Services, press 5. ' +

    'For Business Cooperation, press 6. ' +

    'To leave a voice message, press 7. ' +

    'For General Assistance, press 0. ' +

    'To hear this menu again, press 8.';


  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  <Gather
    input="dtmf"
    numDigits="1"
    timeout="6"
    action="${escapeXml(action)}"
    method="POST"
    actionOnEmptyResult="true">

    ${say(text)}

  </Gather>

</Response>`;

}


// ============================================================
// DEPARTMENT INTRODUCTION + AI
// ============================================================

function buildConnect(
  request,
  service
) {

  const host =
    getHost(request);


  const introduction =
    service.intro +
    ' Please tell me how I may assist you today.';


  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  ${say(introduction)}

  <Connect
    action="https://${host}/after-ai"
    method="POST">

    <Stream
      url="wss://${host}/media-stream">

      <Parameter
        name="service"
        value="${escapeXml(service.key)}" />

    </Stream>

  </Connect>

</Response>`;

}


// ============================================================
// VOICEMAIL
// ============================================================

function buildVoicemail(request) {

  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  ${say(
    'Please leave your name, telephone number, email address if available, and a brief message after the tone. A member of the Astria team will follow up with you.'
  )}

  <Record
    action="https://${getHost(request)}/voicemail-done"
    method="POST"
    maxLength="120"
    playBeep="true" />

</Response>`;

}


// ============================================================
// AI INSTRUCTIONS
// ============================================================

function buildInstructions(
  service
) {

  return `

You are Astria's professional AI telephone assistant.

Astria is a New York based global business platform.

Astria works across:

Aviation.

Space and Aerospace.

AI Technology.

Sports Hospitality.

Government Procurement Services.

Business Cooperation.


The caller selected:

${service.name}


Speak in a warm,
gentle,
calm,
polished,
professional service style.

Your manner should resemble
premium international airline cabin crew.

Speak slightly slower than normal.

Keep answers concise.

Usually answer in
one to three sentences.

Ask one question at a time.

Do not interrupt unnecessarily.


Do not claim to be human.

Do not invent:

partnerships,

contracts,

government approvals,

government awards,

prices,

availability,

certifications,

legal conclusions,

tax conclusions,

or guaranteed results.


There is currently
no live transfer
to a personal telephone.


If the caller asks
to speak with a human,
representative,
agent,
staff member,
or customer service person,

say:

"Our consultation volume
is currently high,
so live assistance
may not be immediately available.

Our team can follow up
with you by phone or email.

You may also leave us
a voice message,
and a member of the Astria team
will get back to you."


Astria email:

info@goastria.com


Astria website:

https://www.goastria.com


Astria telephone:

+1-888-987-8767

`;

}


// ============================================================
// BASIC ROUTES
// ============================================================

app.get(
  '/',
  async () => ({
    status: 'ok',
    service: 'Astria AI Voice',
    version: 'V6 Simple Reception'
  })
);


// ============================================================
// INCOMING CALL
// ============================================================

app.all(
  '/incoming-call',

  async (
    request,
    reply
  ) => {

    reply
      .type('text/xml')
      .send(
        buildMenu(request)
      );

  }
);


// ============================================================
// MENU SELECTION
// ============================================================

app.all(
  '/menu',

  async (
    request,
    reply
  ) => {

    const digit =
      String(

        request.body?.Digits ??

        request.query?.Digits ??

        ''

      ).trim();


    // Repeat menu
    if (
      digit === '8'
    ) {

      return reply
        .type('text/xml')
        .send(
          buildMenu(request)
        );

    }


    // Leave voicemail
    if (
      digit === '7'
    ) {

      return reply
        .type('text/xml')
        .send(
          buildVoicemail(request)
        );

    }


    // Selected department
    const service =
      SERVICES[digit] ||
      SERVICES['0'];


    return reply
      .type('text/xml')
      .send(

        buildConnect(
          request,
          service
        )

      );

  }
);


// ============================================================
// IF AI STREAM ENDS
// GO TO VOICEMAIL INSTEAD OF HANGING UP
// ============================================================

app.all(
  '/after-ai',

  async (
    request,
    reply
  ) => {

    reply
      .type('text/xml')
      .send(
        buildVoicemail(request)
      );

  }
);


// ============================================================
// VOICEMAIL COMPLETE
// ============================================================

app.all(
  '/voicemail-done',

  async (
    request,
    reply
  ) => {

    reply
      .type('text/xml')
      .send(

        `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  ${say(
    'Thank you. Your message has been received. A member of the Astria team will follow up with you as soon as possible. Goodbye.'
  )}

</Response>`

      );

  }
);


// ============================================================
// TWILIO <-> OPENAI REALTIME
// ============================================================

app.register(
  async function (
    server
  ) {

    server.get(

      '/media-stream',

      {
        websocket: true
      },

      socket => {


        let streamSid =
          null;


        let selectedService =
          SERVICES['0'];


        let twilioStarted =
          false;


        let openAiStarted =
          false;


        let sessionReady =
          false;


        const pendingAudio =
          [];


        // ----------------------------------------------------
        // OPENAI CONNECTION
        // ----------------------------------------------------

        const openai =
          new WebSocket(

            `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`,

            {

              headers: {

                Authorization:
                  `Bearer ${OPENAI_API_KEY}`

              }

            }

          );


        function sendToOpenAI(
          data
        ) {

          if (
            openai.readyState ===
            WebSocket.OPEN
          ) {

            openai.send(
              JSON.stringify(data)
            );

          }

        }


        // ----------------------------------------------------
        // START AI SESSION
        // ----------------------------------------------------

        function startSession() {

          if (

            !twilioStarted ||

            !openAiStarted ||

            sessionReady

          ) {

            return;

          }


          sendToOpenAI({

            type:
              'session.update',

            session: {

              type:
                'realtime',

              model:
                MODEL,

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
                    AI_VOICE,

                  speed:
                    0.88

                }

              }

            }

          });

        }


        // ----------------------------------------------------
        // OPENAI READY
        // ----------------------------------------------------

        openai.on(
          'open',

          () => {

            openAiStarted =
              true;

            startSession();

          }
        );


        // ----------------------------------------------------
        // OPENAI EVENTS
        // ----------------------------------------------------

        openai.on(
          'message',

          raw => {

            const event =
              JSON.parse(
                raw.toString()
              );


            // Session ready
            if (
              event.type ===
              'session.updated'
            ) {

              sessionReady =
                true;


              while (
                pendingAudio.length
              ) {

                sendToOpenAI({

                  type:
                    'input_audio_buffer.append',

                  audio:
                    pendingAudio.shift()

                });

              }

            }


            // AI audio -> caller
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

            }


            // If AI fails, leave the stream.
            // Twilio then goes to /after-ai and voicemail.
            if (
              event.type ===
              'error'
            ) {

              console.error(
                'OpenAI Realtime error:',
                JSON.stringify(event)
              );


              if (
                socket.readyState ===
                WebSocket.OPEN
              ) {

                socket.close();

              }

            }

          }
        );


        // ----------------------------------------------------
        // OPENAI DISCONNECTED
        // ============================================================

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


        // ----------------------------------------------------
        // TWILIO EVENTS
        // ----------------------------------------------------

        socket.on(
          'message',

          raw => {

            const data =
              JSON.parse(
                raw.toString()
              );


            // Stream starts
            if (
              data.event ===
              'start'
            ) {

              streamSid =
                data.start.streamSid;


              selectedService =

                SERVICE_BY_KEY[
                  data.start
                    .customParameters
                    ?.service
                ] ||

                SERVICES['0'];


              twilioStarted =
                true;


              startSession();

            }


            // Caller audio -> OpenAI
            if (

              data.event ===
                'media' &&

              data.media?.payload

            ) {

              if (
                sessionReady
              ) {

                sendToOpenAI({

                  type:
                    'input_audio_buffer.append',

                  audio:
                    data.media.payload

                });

              }

              else if (
                pendingAudio.length <
                150
              ) {

                pendingAudio.push(
                  data.media.payload
                );

              }

            }

          }
        );


        // ----------------------------------------------------
        // CALL ENDS
        // ----------------------------------------------------

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
// RAILWAY SERVER
// ============================================================

app.listen(

  {

    port:
      PORT,

    host:
      '0.0.0.0'

  },

  error => {

    if (
      error
    ) {

      console.error(
        error
      );

      process.exit(1);

    }


    console.log(
      `Astria AI Voice V6 is listening on port ${PORT}`
    );

  }

);