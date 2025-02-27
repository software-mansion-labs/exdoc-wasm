import { qsAll } from "./helpers";

const ATTRS = {
  ID: "data-code-id",
  TYPE: "data-code-type",
  LINE: "data-code-line",
};

let AvmEval;
const EVAL_ELIXIR = "eval:elixir";
const EVAL_ERLANG = "eval:erlang";

window.addEventListener("exdoc:loaded", initialize);

function getLiveCodeNodes() {
  const nodes = {};

  for (const node of qsAll(`pre[${ATTRS.ID}]`)) {
    const id = node.getAttribute(ATTRS.ID);
    const outputNode = node.querySelector(`*[${ATTRS.TYPE}="output"]`);
    const inputNodes = [...node.querySelectorAll(".line")].map((node) => {
      return { prompt: node.children[0], code: node.children[1] };
    });

    nodes[id] = { input: inputNodes, output: outputNode };
  }

  return nodes;
}

async function initialize() {
  AvmEval = Module;
  console.log({ AvmEval });
  // FIXME: detect if runtime failed for whatever reason (e.g. failed loading .avm, too big .avm, etc)

  const nodes = getLiveCodeNodes();
  console.log({ nodes });

  for (const node of Object.values(nodes)) {
    node.input.forEach(({ prompt, code }, index) => {
      prompt.addEventListener("click", async () => {
        // TODO: run previous steps
        const result = await evalCode(code.textContent.trim(), "elixir");
        if (result !== null) {
          node.output.textContent = result;
          prompt.setAttribute("style", "color: var(--textDetailAccent);");
        } else {
          prompt.setAttribute("style", "color: var(--errorBackground);");
        }
      });
    });
  }
}

async function evalCode(code, language) {
  if (code === "") {
    return;
  }

  console.log("evalCode", code);

  let command;
  if (language === "elixir") {
    command = `${EVAL_ELIXIR}:${code}`;
  } else {
    command = `${EVAL_ERLANG}:${code}`;
  }

  try {
    const { result, dtMs } = await profile(async () => {
      console.log("evaluating code", command);
      const r = AvmEval.call("main", command);
      console.log("evaluating code end");
      return r;
    });
    console.log(`Took ${dtMs} ms, result: ${result}`);
    return result;
  } catch (e) {
    console.error("Eval error", e);
  }
  return null;
}

async function profile(fn) {
  const t = performance.now();
  const result = await fn();
  const dtMs = performance.now() - t;

  return { result, dtMs };
}
