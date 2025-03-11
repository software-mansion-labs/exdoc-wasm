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
const EVAL_TIMEOUT_MS = 10 * 1_000;
const AVM_IFRAME = document.getElementById("evalFrame").contentWindow;

const RESULT_DELAY_MS = 120;

let messageId = 0;
const controller = new AbortController();

window.addEventListener("exdoc:loaded", initialize);

class Output {
  constructor(node) {
    this._node = node;
  }

  display({ result, error, output }) {
    this._node.classList.remove("output-error");
    this._node.classList.remove("output-initial");

    if (error) {
      this._node.classList.add("output-error");
      this._node.textContent = `Error: ${result}`;
    } else if (output.length > 0) {
      this._node.textContent = result + `\n\nOutput:\n${output.join("\n")}\n`;
    } else {
      this._node.textContent = result;
    }
  }
}

class Info {
  constructor(node, controller) {
    this._node = node;
    this._controller = controller;
    this._onClick = this._onClick.bind(this);
  }

  startLoading() {
    this._node.textContent = "↺";
    this._node.classList.add("info-running");
    this._node.addEventListener("click", this._onClick);
  }

  finishLoading(ms) {
    this._node.classList.remove("info-running");
    this._node.removeEventListener("click", this._onClick);

    if (ms === null) {
      this._node.textContent = "(error)";
    } else {
      this._node.textContent = `(${ms.toFixed(2)} ms)`;
    }
  }

  _onClick() {
    this._controller.abort();
  }
}

function getLiveCodeNodes(controller) {
  const CODE_BLOCK_SELECTOR = `pre[${ATTRS.ID}]`;
  const OUTPUT_SELECTOR = `*[${ATTRS.TYPE}="output"]`;

  const nodes = {};
  for (const container of qsAll(CODE_BLOCK_SELECTOR)) {
    const id = container.getAttribute(ATTRS.ID);
    let currentOutputIndex = 0;
    const outputs = [...container.querySelectorAll(OUTPUT_SELECTOR)].map(
      (node) => new Output(node),
    );

    const inputs = [];
    for (const node of container.children) {
      const isComment = node.getAttribute(ATTRS.TYPE) === "comment";
      const isOutput = node.getAttribute(ATTRS.TYPE) === "output";
      if (isComment) {
        continue;
      }
      if (isOutput) {
        ++currentOutputIndex;
        continue;
      }

      const code = node.children[1].textContent.trim();
      const prompt = node.children[0];
      const info = new Info(node.children[2], controller);
      const output = outputs[currentOutputIndex];

      inputs.push({
        get state() {
          return node.getAttribute(ATTRS.STATE);
        },
        set state(newState) {
          node.setAttribute(ATTRS.STATE, newState);
        },
        set onClick(fn) {
          prompt.addEventListener("click", fn);
        },
        code: code !== "" ? code : null,
        info,
        output,
      });
    }
    nodes[id] = inputs;
  }

  return nodes;
}

async function initialize() {
  // FIXME: detect if runtime failed for whatever reason (e.g. failed loading .avm, too big .avm, etc)

  const nodes = getLiveCodeNodes(controller);

  for (const [blockId, inputs] of Object.entries(nodes)) {
    for (let i = 0; i < inputs.length; ++i) {
      const input = inputs[i];
      input.onClick = async () => {
        if (anyEvaluating(inputs)) {
          return;
        }

        const toEval = notEvaluatedUntilIndex(inputs, i);
        // reset all to re-evaluate
        for (const input of toEval) {
          input.state = STATE.NOT_EVALUATED;
        }

        for (const input of toEval) {
          input.state = STATE.EVALUATING;
          input.info.startLoading();
          const { result, dtMs, error, output } = await evalCode(controller, {
            code: input.code,
            blockId,
            language: "elixir",
          });
          input.info.finishLoading(dtMs);
          input.state = error ? STATE.ERROR : STATE.EVALUATED;
          input.output.display({ result, error, output });
        }
      };
    }
  }
}

async function evalCode(controller, { code, blockId, language }) {
  const id = ++messageId;

  return new Promise((resolve, _reject) => {
    const signal = controller.signal;

    const abortHandler = () => {
      controller.signal.removeEventListener("abort", abortHandler);
      resolve({ result: "Aborted", dtMs: null, error: true, output: [] });
    };

    const timeout = setTimeout(() => {
      controller.abort();
      resolve({ result: "Timeout", dtMs: null, error: true, output: [] });
    }, EVAL_TIMEOUT_MS);

    const output = [];
    const handler = ({ data }) => {
      if (data.type === "log") {
        output.push(data.value);
      }

      if (data?.id === id) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler, { signal });
        const { result, dtMs, error } = data.value;
        resolve({ result, dtMs, error, output });
      }
    };

    signal.addEventListener("abort", abortHandler);
    window.addEventListener("message", handler, false);
    AVM_IFRAME.postMessage({
      type: "eval",
      id,
      value: { code, blockId, language },
    });
  });
}

function notEvaluatedUntilIndex(inputs, index) {
  let firstToEvaluate = inputs
    .slice(0, index)
    .findIndex(({ state }) => state === STATE.NOT_EVALUATED);

  const allEvaluated = firstToEvaluate === -1;
  if (allEvaluated) {
    firstToEvaluate = index;
  }

  return inputs
    .slice(firstToEvaluate, index + 1)
    .filter(({ state, code }) => state !== STATE.ERROR && code !== null);
}

function anyEvaluating(inputs) {
  return inputs.some(({ state }) => state === STATE.EVALUATING);
}
