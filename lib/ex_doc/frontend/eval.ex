defmodule Exdoc.Frontend.Eval do
  use GenServer
  import Popcorn.Wasm, only: [is_wasm_message: 1]
  alias Popcorn.Wasm

  def start_link(_) do
    GenServer.start_link(__MODULE__, nil, name: :main)
  end

  @impl GenServer
  def init(_args) do
    {:ok, %{}}
  end

  @impl GenServer
  def handle_info(raw_msg, all_bindings) when is_wasm_message(raw_msg) do
    new_bindings = Wasm.handle_message!(raw_msg, &handle_wasm_call(&1, all_bindings))
    {:noreply, new_bindings}
  end

  defp handle_wasm_call({:wasm_call, [action, block_id, code]}, all_bindings) do
    bindings = Map.get(all_bindings, block_id, [])
    eval_type = code_type(action)

    case eval(code, eval_type, bindings) do
      {:ok, result, new_bindings} ->
        all_bindings = Map.put(all_bindings, block_id, new_bindings)
        {:resolve, stringify(result), all_bindings}

      {:error, error, _stacktrace} ->
        {:reject, stringify(error), all_bindings}
    end
  end

  defp code_type("eval_elixir"), do: :elixir
  defp code_type("eval_erlang"), do: :erlang

  defp eval(code, :elixir, bindings) do
    unless Process.whereis(:elixir_config) do
      :elixir.start([], [])
    end
      try do
        {result, new_bindings} = Code.eval_string(code, bindings, __ENV__)

        {:ok, result, new_bindings}
      rescue
        e ->
        {:error, e, __STACKTRACE__}
      end
    end

    defp eval(code, :erlang, bindings) do
      code = :erlang.binary_to_list(code)

      with {:ok, tokens, _end_location} <- :erl_scan.string(code),
          {:ok, exprs} <- :erl_parse.parse_exprs(tokens),
          {:value, value, new_bindings} <- :erl_eval.exprs(exprs, bindings) do
        {:ok, value, new_bindings}
      end
    rescue
      error -> {:error, error, __STACKTRACE__}
    end

    defp stringify(fun) when is_function(fun) do
      info = Function.info(fun)

      "#Function<#{info[:module]}.#{info[:name]}/#{info[:arity]}>"
    end

    defp stringify(term) do
      inspect(term, pretty: true)
    end
end
