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
// ASTRIA AI VOICE CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 5050;

const MODEL = 'gpt-realtime';

const VOICE = 'shimmer';

const SYSTEM_MESSAGE = `
You are the professional AI voice assistant for Astria.

Your voice and service style should feel warm, gentle, polished,
attentive, calm, and reassuring, similar to the service style of
a premium international airline cabin crew member.

Speak naturally and elegantly.

Use a soft and welcoming tone.
Use clear pronunciation.
Speak at a calm, slightly slower pace.
Keep responses concise and easy to understand.

Always be courteous, patient, professional, and attentive.

Never sound robotic.
Never sound rushed.
Never sound overly casual.
Never sound overly excited.
Do not interrupt the caller unnecessarily.

The company name is Astria.
Always pronounce and identify the company as Astria.

When a caller first connects, welcome them warmly.

If the caller asks what company they reached, clearly say that
they have reached Astria.

Help callers understand what they need and provide appropriate
general assistance.

If you do not know an answer, never invent information.
Politely explain that a member of the Astria team can provide
additional assistance.

If the caller asks to speak with a person, politely acknowledge
the request and explain that a member of the Astria team can
assist them.

Maintain a premium, professional customer-service experience
throughout the entire conversation.
`;

const INITIAL_GREETING =
  'Thank you for calling Astria. How may I assist you today?';


// ============================================================
// HEALTH / ROOT ROUTES
// ============================================================

fastify.get('/', async () => {
  return {
    status: 'ok',
    service: 'Astria AI Voice'
  };
});

fastify.get('/health', async () => {
  return {
    status: 'healthy'
  };
});


// ============================================================
// TWILIO INCOMING CALL
// ============================================================
//
// Twilio connects directly to the Media Stream.
// We intentionally do NOT use <Say> here.
// This means the first spoken greeting comes from OpenAI
// using the same Shimmer voice as the rest of the conversation.
//

fastify.all('/incoming-call', async (request, reply) => {
  const host = request.headers.host;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream" />
  </Connect>
</Response>`;

  reply
    .type('text/xml')
    .send(twiml);
});


// ============================================================
// TWILIO MEDIA STREAM <-> OPENAI REALTIME
// ============================================================

fastify.register(async function (app) {
  app.get('/media-stream', { websocket: true }, (connection) => {

    console.log('Twilio media stream connected');

    let streamSid = null;

    let latestMediaTimestamp = 0;

    let responseStartTimestampTwilio = null;

    let lastAssistantItem = null;

    let markQueue = [];

    let sessionReady = false;

    let greetingSent = false;


    // --------------------------------------------------------
    // CONNECT TO OPENAI REALTIME
    // --------------------------------------------------------

    const openAiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${MODEL}`,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`
        }
      }
    );


    // --------------------------------------------------------
    // SEND SESSION CONFIGURATION
    // --------------------------------------------------------

    const initializeSession = () => {
      const sessionUpdate = {
        type: 'session.update',
        session: {
          type: 'realtime',

          model: MODEL,

          output_modalities: [
            'audio'
          ],

          instructions: SYSTEM_MESSAGE,

          audio: {
            input: {
              format: {
                type: 'audio/pcmu'
              },

              turn_detection: {
                type: 'server_vad',
                create_response: true,
                interrupt_response: true
              }
            },

            output: {
              format: {
                type: 'audio/pcmu'
              },

              voice: VOICE
            }
          }
        }
      };

      openAiWs.send(
        JSON.stringify(sessionUpdate)
      );
    };


    // --------------------------------------------------------
    // ASTRIA INITIAL GREETING
    // --------------------------------------------------------

    const maybeSendInitialGreeting = () => {
      if (
        greetingSent ||
        !sessionReady ||
        !streamSid ||
        openAiWs.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      greetingSent = true;

      const greetingInstruction = {
        type: 'conversation.item.create',

        item: {
          type: 'message',

          role: 'user',

          content: [
            {
              type: 'input_text',

              text:
                `Begin the telephone call now. ` +
                `Greet the caller exactly with: ` +
                `"${INITIAL_GREETING}" ` +
                `Use the warm, gentle, polished Astria service style.`
            }
          ]
        }
      };

      openAiWs.send(
        JSON.stringify(greetingInstruction)
      );

      openAiWs.send(
        JSON.stringify({
          type: 'response.create'
        })
      );
    };


    // --------------------------------------------------------
    // TWILIO MARK
    // --------------------------------------------------------

    const sendMark = () => {
      if (!streamSid) return;

      const markEvent = {
        event: 'mark',

        streamSid,

        mark: {
          name: 'astria-response'
        }
      };

      connection.send(
        JSON.stringify(markEvent)
      );

      markQueue.push('astria-response');
    };


    // --------------------------------------------------------
    // HANDLE CALLER INTERRUPTION
    // --------------------------------------------------------

    const handleCallerSpeechStarted = () => {
      if (
        markQueue.length === 0 ||
        responseStartTimestampTwilio === null
      ) {
        return;
      }

      const elapsedTime =
        latestMediaTimestamp -
        responseStartTimestampTwilio;

      if (
        lastAssistantItem &&
        openAiWs.readyState === WebSocket.OPEN
      ) {
        const truncateEvent = {
          type: 'conversation.item.truncate',

          item_id: lastAssistantItem,

          content_index: 0,

          audio_end_ms: Math.max(
            0,
            elapsedTime
          )
        };

        openAiWs.send(
          JSON.stringify(truncateEvent)
        );
      }

      if (streamSid) {
        connection.send(
          JSON.stringify({
            event: 'clear',
            streamSid
          })
        );
      }

      markQueue = [];

      lastAssistantItem = null;

      responseStartTimestampTwilio = null;
    };


    // --------------------------------------------------------
    // OPENAI CONNECTION OPEN
    // --------------------------------------------------------

    openAiWs.on('open', () => {
      console.log(
        'Connected to OpenAI Realtime API'
      );

      initializeSession();
    });


    // --------------------------------------------------------
    // OPENAI EVENTS
    // --------------------------------------------------------

    openAiWs.on('message', (rawData) => {
      try {
        const response =
          JSON.parse(rawData.toString());


        // Session is ready
        if (
          response.type ===
          'session.updated'
        ) {
          console.log(
            'OpenAI Realtime session ready'
          );

          sessionReady = true;

          maybeSendInitialGreeting();

          return;
        }


        // OpenAI audio -> Twilio
        if (
          response.type ===
            'response.output_audio.delta' &&
          response.delta
        ) {

          if (!streamSid) return;

          const audioEvent = {
            event: 'media',

            streamSid,

            media: {
              payload: response.delta
            }
          };

          connection.send(
            JSON.stringify(audioEvent)
          );


          if (
            responseStartTimestampTwilio ===
            null
          ) {
            responseStartTimestampTwilio =
              latestMediaTimestamp;
          }


          if (response.item_id) {
            lastAssistantItem =
              response.item_id;
          }


          sendMark();

          return;
        }


        // Caller begins speaking
        if (
          response.type ===
          'input_audio_buffer.speech_started'
        ) {
          handleCallerSpeechStarted();

          return;
        }


        // Log OpenAI errors
        if (response.type === 'error') {
          console.error(
            'OpenAI Realtime error:',
            JSON.stringify(response)
          );
        }

      } catch (error) {
        console.error(
          'Error processing OpenAI event:',
          error
        );
      }
    });


    // --------------------------------------------------------
    // TWILIO EVENTS
    // --------------------------------------------------------

    connection.on('message', (rawMessage) => {
      try {
        const data =
          JSON.parse(rawMessage.toString());


        switch (data.event) {


          // Twilio stream starts
          case 'start':

            streamSid =
              data.start.streamSid;

            latestMediaTimestamp = 0;

            responseStartTimestampTwilio =
              null;

            console.log(
              'Twilio stream started:',
              streamSid
            );

            maybeSendInitialGreeting();

            break;


          // Caller audio -> OpenAI
          case 'media':

            latestMediaTimestamp =
              Number(
                data.media.timestamp || 0
              );

            if (
              openAiWs.readyState ===
              WebSocket.OPEN
            ) {
              openAiWs.send(
                JSON.stringify({
                  type:
                    'input_audio_buffer.append',

                  audio:
                    data.media.payload
                })
              );
            }

            break;


          // Twilio mark completed
          case 'mark':

            if (markQueue.length > 0) {
              markQueue.shift();
            }

            break;


          // Stream stopped
          case 'stop':

            console.log(
              'Twilio stream stopped'
            );

            break;


          default:

            break;
        }

      } catch (error) {
        console.error(
          'Error processing Twilio event:',
          error
        );
      }
    });


    // --------------------------------------------------------
    // TWILIO DISCONNECT
    // --------------------------------------------------------

    connection.on('close', () => {
      console.log(
        'Twilio caller disconnected'
      );

      if (
        openAiWs.readyState ===
        WebSocket.OPEN
      ) {
        openAiWs.close();
      }
    });


    // --------------------------------------------------------
    // OPENAI CONNECTION CLOSE
    // --------------------------------------------------------

    openAiWs.on('close', () => {
      console.log(
        'Disconnected from OpenAI Realtime API'
      );
    });


    // --------------------------------------------------------
    // OPENAI CONNECTION ERROR
    // --------------------------------------------------------

    openAiWs.on('error', (error) => {
      console.error(
        'OpenAI WebSocket error:',
        error
      );
    });

  });
});


// ============================================================
// START SERVER
// ============================================================
//
// Railway requires the application to listen publicly.
// Keep host 0.0.0.0.
//

fastify.listen(
  {
    port: PORT,
    host: '0.0.0.0'
  },
  (err) => {

    if (err) {
      console.error(err);
      process.exit(1);
    }

    console.log(
      `Astria AI Voice server is listening on port ${PORT}`
    );
  }
);