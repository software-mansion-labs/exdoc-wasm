defmodule ExDoc.Eval do
  def start() do
    Console.print("Starting interpreterxxxxxx...\n")
    Process.register(self(), :main)
    loop()
  end

  defp loop() do
    receive do
      {:emscripten, {:call, promise, message}} ->
        {type, code} = type(message)

        code
        |> eval(type)
        |> resolve(promise)
    end

    loop()
  end

  defp type("eval:elixir:" <> code), do: {:elixir, code}
  defp type("eval:erlang:" <> code), do: {:erlang, code}
  defp type("eval_module:erlang:" <> code), do: {{:module, :erlang}, code}

  defp eval(code, :elixir) do
    unless Process.whereis(:elixir_config) do
      :elixir.start([], [])
    end

    try do
      {result, _bindings} = Code.eval_string(code, [], __ENV__)
      {:ok, result}
    rescue
      e -> {:error, e, __STACKTRACE__}
    end
  end

  defp eval(code, {:module, :erlang}) do
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
      {:ok, module}
    end
  rescue
    error -> {:error, error, __STACKTRACE__}
  end

  defp eval(code, :erlang) do
    code = :erlang.binary_to_list(code)

    with {:ok, tokens, _end_location} <- :erl_scan.string(code),
         {:ok, exprs} <- :erl_parse.parse_exprs(tokens),
         {:value, value, _bindings} <- :erl_eval.exprs(exprs, []) do
      {:ok, value}
    end
  rescue
    error -> {:error, error, __STACKTRACE__}
  end

  defp resolve({:ok, term}, promise) do
    term
    |> inspect(pretty: true)
    |> :erlang.binary_to_list()
    |> then(&:emscripten.promise_resolve(promise, &1))
  end

  defp resolve({:error, error, stacktrace}, promise) do
    :erlang.display({:stacktrace, stacktrace})

    error
    |> inspect(pretty: true)
    |> :erlang.binary_to_list()
    |> then(&:emscripten.promise_reject(promise, &1))
  end

  defp split_forms(forms) do
    split_on_dots = fn
      {:dot, _} = f, current -> {:cont, Enum.reverse([f | current]), []}
      f, current -> {:cont, [f | current]}
    end

    ensure_empty_acc = fn [] -> {:cont, []} end

    Enum.chunk_while(forms, [], split_on_dots, ensure_empty_acc)
  end
end
