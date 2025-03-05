defmodule ExDoc.Eval do
  def start() do
    Console.print("Starting interpreter...\n")
    Process.register(self(), :main)
    loop(%{})
  end

  defp loop(state) do
    new_state =
      receive do
        {:emscripten, {:call, promise, message}} ->
          case handle_call(decode(message), state) do
            {:resolve, value, new_state} ->
              value
              |> stringify()
              |> resolve(promise)

              new_state

            {:reject, error, new_state} ->
              error
              |> stringify()
              |> reject(promise)

              new_state
          end
      end

    loop(new_state)
  end

  defp handle_call({eval_type, block_id, code}, all_bindings) do
    bindings = Map.get(all_bindings, block_id, [])

    case eval(code, eval_type, bindings) do
      {:ok, result, new_bindings} ->
        all_bindings = Map.put(all_bindings, block_id, new_bindings)
        {:resolve, result, all_bindings}

      {:error, error, _stacktrace} ->
        {:reject, error, all_bindings}
    end
  end

  defp decode(message) do
    # messages are in format type:block_id:code
    # where
    # - block_id is block of code grouping expressions together
    # - type is 'elixir' | 'erlang' | 'erlang_module'
    [type, block_id, code] = split_message(message, "", [])

    {code_type(type), block_id, code}
  end

  # Basically `String.split(message, ":", parts: 3)` which doesn't work due to pattern compilation
  def split_message("", current, split) when length(split) < 3,
    do: Enum.reverse([current | split])

  def split_message("", current, [last | split]), do: Enum.reverse([last <> current | split])

  def split_message(":" <> message, current, split) when length(split) < 3 - 1,
    do: split_message(message, "", [current | split])

  def split_message(<<c::binary-size(1)>> <> message, current, split),
    do: split_message(message, current <> c, split)

  defp code_type("elixir"), do: :elixir
  defp code_type("erlang"), do: :erlang
  defp code_type("erlang_module"), do: {:module, :erlang}

  defp eval(code, :elixir, bindings) do
    unless Process.whereis(:elixir_config) do
      :elixir.start([], [])
    end

    try do
      {result, new_bindings} = Code.eval_string(code, bindings, __ENV__)

      {:ok, result, new_bindings}
    rescue
      e -> {:error, e, __STACKTRACE__}
    end
  end

  defp eval(code, {:module, :erlang}, bindings) do
    compile_opts = [
      :deterministic,
      :return_errors,
      :compressed,
      :no_spawn_compiler_process,
      :no_docs
    ]

    parse_form = fn form_tok ->
      {:ok, form} = :erl_parse.parse_form(form_tok)
      form
    end

    code = :erlang.binary_to_list(code)

    with {:ok, tokens, _end_location} <- :erl_scan.string(code),
         {:ok, module, module_bin} <-
           tokens
           |> split_forms()
           |> Enum.map(parse_form)
           |> :compile.noenv_forms(compile_opts),
         {:module, module} <- :code.load_binary(module, ~c"nofile", module_bin) do
      {:ok, module, bindings}
    end
  rescue
    error -> {:error, error, __STACKTRACE__}
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

    ~c"#Function<#{info[:module]}.#{info[:name]}/#{info[:arity]}>"
  end

  defp stringify(term) do
    term
    |> inspect(pretty: true)
    |> :erlang.binary_to_list()
  end

  defp resolve(value, promise), do: :emscripten.promise_resolve(promise, value)
  defp reject(value, promise), do: :emscripten.promise_reject(promise, value)

  defp split_forms(forms) do
    split_on_dots = fn
      {:dot, _} = f, current -> {:cont, Enum.reverse([f | current]), []}
      f, current -> {:cont, [f | current]}
    end

    ensure_empty_acc = fn [] -> {:cont, []} end

    Enum.chunk_while(forms, [], split_on_dots, ensure_empty_acc)
  end
end
