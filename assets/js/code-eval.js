import { qsAll } from "./helpers";

const ATTRS = {
  ID: "data-code-id",
  TYPE: "data-code-type",
  STATE: "data-code-state",
};

const STATE = {
  NOT_EVALUATED: "NOT_EVALUATED",
  EVALUATED: "EVALUATED",
  ERROR: "ERROR",
  EVALUATING: "EVALUATING",
};

const MESSAGE = {
  EVAL_ELIXIR: "elixir",
  EVAL_ERLANG: "erlang",
};

const RESULT_DELAY_MS = 120;

let AvmEval;
window.addEventListener("exdoc:loaded", initialize);

function getLiveCodeNodes() {
  const nodes = {};

  for (const node of qsAll(`pre[${ATTRS.ID}]`)) {
    const id = node.getAttribute(ATTRS.ID);
    let currentOutputIndex = 0;
    const outputNodes = node.querySelectorAll(`*[${ATTRS.TYPE}="output"]`);
    nodes[id] = [...node.children]
      .map((node) => {
        if (node.getAttribute(ATTRS.TYPE) === "output") {
          ++currentOutputIndex;
          return null;
        }

        const prompt = node.children[0];
        const code = node.children[1];
        const info = node.children[2];
        return {
          get state() {
            return node.getAttribute(ATTRS.STATE);
          },
          set state(newState) {
            node.setAttribute(ATTRS.STATE, newState);
          },
          prompt,
          code,
          info,
          output: outputNodes[currentOutputIndex],
        };
      })
      .filter((node) => node !== null);
  }

  return nodes;
}

async function initialize() {
  AvmEval = Module;
  // FIXME: detect if runtime failed for whatever reason (e.g. failed loading .avm, too big .avm, etc)

  const nodes = getLiveCodeNodes();

  for (const [blockId, lines] of Object.entries(nodes)) {
    lines.forEach(({ prompt, code, output }, index) => {
      prompt.addEventListener("click", async () => {
        if (lines.some(({ state }) => state === STATE.EVALUATING)) {
          return;
        }

        let firstEvaluatedLine = lines
          .slice(0, index)
          .findIndex(({ state }) => state === STATE.NOT_EVALUATED);

        const allEvaluated = firstEvaluatedLine === -1;
        if (allEvaluated) {
          firstEvaluatedLine = index;
        }

        const toEval = lines
          .slice(firstEvaluatedLine, index + 1)
          .filter(({ state }) => state !== STATE.ERROR);
        for (const line of toEval) {
          await setLineState(line, STATE.NOT_EVALUATED);
        }

        let timeout = null;
        for (const line of toEval) {
          line.info.textContent = "↺";
          line.info.classList.add("info-running");

          const { dtMs, result, error } = await setLineState(
            line,
            STATE.EVALUATING,
            { blockId },
          );

          line.info.classList.remove("info-running");
          line.info.textContent = "";

          line.info.textContent = `(${dtMs.toFixed(2)} ms)`;

          clearTimeout(timeout);
          timeout = setTimeout(() => {
            output.classList.remove("output-error");
            output.classList.remove("output-initial");

            if (error) {
              output.classList.add("output-error");
              output.textContent = `Error: ${result}`;
            } else {
              output.textContent = result;
            }
          }, RESULT_DELAY_MS);
        }
      });
    });
  }
}

async function setLineState(line, state, opts) {
  line.state = state;

  // Other states don't have any side-effects except setting attribute
  if (state === STATE.EVALUATING) {
    const { blockId } = opts;
    const code = line.code.textContent.trim();
    const result = await evalCode(code, "elixir", blockId);

    if (result.error) {
      await setLineState(line, "ERROR");
    } else {
      await setLineState(line, "EVALUATED");
    }
    return result;
  }
  return null;
}

async function evalCode(code, language, blockId) {
  if (code === "") {
    return;
  }

  let command;
  if (language === "elixir") {
    command = `${MESSAGE.EVAL_ELIXIR}:${blockId}:${code}`;
  } else {
    command = `${MESSAGE.EVAL_ERLANG}:${blockId}:${code}`;
  }

  const { result, dtMs, error } = await profile(async () =>
    AvmEval.call("main", command),
  );
  return { dtMs, result, error };
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
