import { qsAll } from "./helpers";
import { Popcorn } from "./wasm/popcorn.js";

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

const RESULT_DELAY_MS = 120;

window.addEventListener("exdoc:loaded", initialize);

function getLiveCodeNodes() {
  const nodes = {};

  for (const node of qsAll(`pre[${ATTRS.ID}]`)) {
    const id = node.getAttribute(ATTRS.ID);
    let currentOutputIndex = 0;
    const outputNodes = node.querySelectorAll(`*[${ATTRS.TYPE}="output"]`);
    nodes[id] = [...node.children]
      .map((node) => {
        if (node.getAttribute(ATTRS.TYPE) === "comment") {
          return null;
        }
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
  const popcorn = await Popcorn.init({
    bundlePath: "wasm/eval.avm",
    debug: true,
    onStdout: console.log,
    onStderr: console.error,
  });
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
            { blockId, popcorn },
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
    const { blockId, popcorn } = opts;
    const code = line.code.textContent.trim();
    const result = await evalCode(popcorn, code, "elixir", blockId);

    if (result.error) {
      await setLineState(line, "ERROR");
    } else {
      await setLineState(line, "EVALUATED");
    }
    return result;
  }
  return null;
}

async function evalCode(
  /** @type {Popcorn} */ popcorn,
  code,
  language,
  blockId,
) {
  if (code === "") {
    return;
  }
  const action = language === "elixir" ? "eval_elixir" : "eval_erlang";

  try {
    const { data, durationMs } = await popcorn.call([action, blockId, code], {
      timeoutMs: 10_000,
    });
    return { dtMs: durationMs, result: data, error: false };
  } catch (e) {
    return { dtMs: e.durationMs, result: e.error, error: true };
  }
}
