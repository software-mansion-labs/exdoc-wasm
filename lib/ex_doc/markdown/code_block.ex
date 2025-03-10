defmodule ExDoc.Markdown.CodeBlock do
  @spec process(code :: String) :: {input :: String, output :: String}
  def process(code) do
    reverse_join = fn lines ->
      lines
      |> Enum.reverse()
      |> Enum.join("\n")
    end

    chunk_fun = fn
      "iex> " <> line, {type, acc} ->
        {:cont, {type, reverse_join.(acc)}, {:input, [line]}}

      "...> " <> line, {:input, acc} ->
        {:cont, {:input, [line | acc]}}

      "# " <> line, {:comment, acc} ->
        {:cont, {:comment, [line | acc]}}

      "# " <> line, {type, acc} ->
        {:cont, {type, reverse_join.(acc)}, {:comment, [line]}}

      line, {type, acc} ->
        {:cont, {type, reverse_join.(acc)}, {:output, [line]}}
    end

    after_fun = fn
      {_type, []} -> {:cont, []}
      {type, acc} -> {:cont, {type, reverse_join.(acc)}, []}
    end

    code
    |> String.split("\n", trim: true)
    |> Enum.chunk_while({nil, []}, chunk_fun, after_fun)
    |> Enum.drop(1)
    |> maybe_add_output_last()
    |> tap(&IO.inspect/1)
  end

  defp maybe_add_output_last([]) do
    [output: "Output"]
  end

  defp maybe_add_output_last(chunks) do
    [last | rest] = Enum.reverse(chunks)

    case last do
      {:output, _out} -> chunks
      _ -> Enum.reverse([{:output, "Output"}, last | rest])
    end
  end
end
