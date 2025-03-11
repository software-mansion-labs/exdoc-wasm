const MESSAGE = {
  EVAL_ELIXIR: "elixir",
  EVAL_ERLANG: "erlang",
};

const EVAL_TIMEOUT_MS = 10 * 1_000;

const avmBundleName = document.querySelector(
  'meta[name="avm-bundle-name"]',
).content;

let initialized = false;

var Module = {
  arguments: [avmBundleName],
  print(text) {
    console.log(text);
    window.parent.postMessage({ type: "log", value: text });
  },
  printErr(text) {
    console.error(text);
    window.parent.postMessage({ type: "log_error", value: text });
  },
  onRuntimeInitialized() {
    initialized = true;
  },
  onAbort() {
    window.postMessage({ type: "reload" });
  },
};

window.addEventListener("message", async ({ data }) => {
  switch (data.type) {
    case "eval":
      {
        const { id, value } = data;
        if (!initialized) {
          console.error("Module not initialized");
          return;
        }
        const { code, blockId, language } = value;
        const result = await evalCode(code, blockId, language);
        window.parent.postMessage({ type: "result", id, value: result });
      }
      break;
    case "reload":
      console.log("Reload");
      window.location.reload();
      break;
  }
});

async function evalCode(code, blockId, language) {
  const command = toCommand(code, blockId, language);
  const callFn = async () => Module.call("main", command);
  const timeoutFn = new Promise((_resolve, reject) =>
    setTimeout(() => {
      reject(new Error("Evaluation took too long to complete"));
    }, EVAL_TIMEOUT_MS),
  );

  const { result, dtMs, error } = await Promise.race([
    profile(callFn),
    timeoutFn,
  ]);

  return { result, dtMs, error };
}

function toCommand(code, blockId, language) {
  if (language === "elixir") {
    return `${MESSAGE.EVAL_ELIXIR}:${blockId}:${code}`;
  }

  return `${MESSAGE.EVAL_ERLANG}:${blockId}:${code}`;
}

async function profile(fn) {
  const t = performance.now();
  let result = null;
  let error = false;
  try {
    result = await fn();
  } catch (e) {
    result = e;
    error = true;
  }
  const dtMs = performance.now() - t;

  return { result, dtMs, error };
}
