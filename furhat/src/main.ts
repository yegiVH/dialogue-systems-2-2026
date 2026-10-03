import { setup, createActor, fromPromise, assign } from "xstate";

const FURHATURI = "127.0.0.1:54321"; // this says where the furhats api lives

async function fhVoice(name: string) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  const encName = encodeURIComponent(name);
  return fetch(`http://${FURHATURI}/furhat/voice?name=${encName}`, {
    method: "POST",
    headers: myHeaders,
    body: "",
  });
}

async function fhSay(text: string) { // send some text to furhat and ask furhat to speak it
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  const encText = encodeURIComponent(text);
  return fetch(`http://${FURHATURI}/furhat/say?text=${encText}&blocking=true`, {
    method: "POST",
    headers: myHeaders,
    body: "",
  });
}

async function newGesture() {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  return fetch(`http://${FURHATURI}/furhat/gesture?blocking=false`, {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify({
      name: "newGesture",
      frames: [
        {
          time: [], //ADD THE TIME FRAME OF YOUR LIKING
          persist: true,
          params: {
            //ADD PARAMETERS HERE IN ORDER TO CREATE A GESTURE
          },
        },
        {
          time: [], //ADD TIME FRAME IN WHICH YOUR GESTURE RESETS
          persist: true,
          params: {
            reset: true,
          },
        },
        //ADD MORE TIME FRAMES IF YOUR GESTURE REQUIRES THEM
      ],
      class: "furhatos.gestures.Gesture",
    }),
  });
}

async function fhGesture(text: string) { // lets you trigger an existing named furhat gesture
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  return fetch(
    `http://${FURHATURI}/furhat/gesture?name=${text}&blocking=true`,
    {
      method: "POST",
      headers: myHeaders,
      body: "",
    },
  );
}

async function fhListen() { // it listens and then returns the recognized utterance
  await fhLed(0, 255, 0); //a3, listening is green
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  try {
    const response = await fetch(`http://${FURHATURI}/furhat/listen`, {
      method: "GET",
      headers: myHeaders,
    });
    const { value } = await response.body!.getReader().read();
    const msg = JSON.parse(new TextDecoder().decode(value)).message;
    return typeof msg === "string" ? msg : "";
  } finally {
    await fhLed(0, 0, 0);
  }
}

async function fhAttend() { // for user tracking
  const h = new Headers({ accpet: "application/json" })
  const users = await fetch(`http://${FURHATURI}/furhat/users`, { headers: h }).then((r) => r.json()).catch(() => []);
  const target = Array.isArray(users) && users.length > 0 ? "user=CLOSEST" : "location=0.2,0,1"; // fallback if no virtual user exists

  console.log("Attending:", target);
  return fetch(`http://${FURHATURI}/furhat/attend?${target}`, {
    method: "POST",
    headers: h,
    body: "",
  });
}

const dmMachine = setup({
  types: {
    context: {} as { heard: string }
  },
  actors: {
    fhVoice: fromPromise<any, null>(async () => {
      return fhVoice("en-US-EchoMultilingualNeural");
    }),
    fhHello: fromPromise<any, null>(async () => {
      return fhSay("Hi");
    }),
    fhL: fromPromise<string, null>(async () => {
      return fhListen();
    }),
    fhAttend: fromPromise<any, null>(async () => fhAttend()), // actor for the user tracking thing I wrote
    fhGreet: fromPromise<any, null>(async () => {
      await fhSay("Hello! I am Furhat.");
      await fhSay("What would you like to say to me?");
    }),
    fhEcho: fromPromise<any, { text: string }>(async ({ input }) => {
      if (!input.text) return fhSay("Sorry, I did not hear anything.");
      return fhSay(`You said: ${input.text}`);
    }),
  },
}).createMachine({
  id: "root",
  initial: "Start",
  context: {
    heard: ""
  },
  states: {
    Start: {
      after: { 1000: "SetVoice" }
    },
    SetVoice: {
      invoke: {
        src: "fhVoice",
        input: null,
        onDone: "Attend",
        onError: { target: "Fail", actions: ({ event }) => console.error(event) },
      },
    },
    Attend: {
      invoke: {
        src: "fhAttend",
        input: null,
        onDone: "Greet",
        onError: { target: "Fail", actions: ({ event }) => console.error(event) },
      }
    },
    Greet: {

    },
    Listen: {

    },
    Echo: {

    },
    Bye: {

    },
    Fail: {},
  },
});

const actor = createActor(dmMachine).start();
console.log(actor.getSnapshot().value);

actor.subscribe((snapshot) => {
  console.log(snapshot.value);
});

