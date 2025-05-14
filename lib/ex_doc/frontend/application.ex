defmodule Exdoc.Frontend.Application do
  alias Popcorn.Wasm

  def start do
    {:ok, _pid, _config_mod} = :elixir.start([], [])
    {:ok, pid} = GenServer.start_link(Exdoc.Frontend.Eval, [])
    Process.register(pid, :main)
    Wasm.register("main")
    IO.puts("Starting interpreter...")
    Process.sleep(:infinity)
  end
end
