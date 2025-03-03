import Config

config :fission_lib,
  out_path: "assets/eval.avm",
  start_module: ExDoc.Eval,
  add_tracing: false,
  avm_source: {:git, "git@github.com:software-mansion-labs/FissionVM.git"}
