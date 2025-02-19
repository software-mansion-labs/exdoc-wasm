import { qsAll } from "./helpers";

let AvmEval;
const EVAL_ELIXIR = "eval:elixir";
const EVAL_ERLANG = "eval:erlang";

window.addEventListener("exdoc:loaded", initialize);

async function initialize() {
  AvmEval = Module;
  console.log({ AvmEval });

  for (const node of qsAll("*[data-code-id]")) {
    const id = node.getAttribute("data-code-id");
    const [outputNode] = qsAll(
      `*[data-code-id="${id}"][data-code-type="output"]`,
    );

    node.addEventListener("click", async () => {
      console.log({ content: node.textContent });
      const result = await evalCode(node.textContent, "elixir");
      if (outputNode) {
        outputNode.textContent = result;
      }
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
