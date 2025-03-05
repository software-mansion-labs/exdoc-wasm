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
  end

  # first line
  defp transition(line, nil, :iex, acc) do
    {"", "", []} = acc
    {:iex, {line, "", []}}
  end

  # flush previous prompt (and output if found)
  defp transition(line, :iex, :iex, acc) do
    {prompt, "", groups} = acc
    {:iex, {line, "", [prompt | groups]}}
  end

  defp transition(line, :cont, :iex, acc) do
    {prompt, "", groups} = acc
    {:iex, {line, "", [prompt | groups]}}
  end

  defp transition(line, :out, :iex, acc) do
    {prompt, output, groups} = acc
    {:iex, {line, "", [{prompt, output} | groups]}}
  end

  # iex -> out
  defp transition(line, :iex, :out, acc) do
    {prompt, "", groups} = acc
    {:out, {prompt, line, groups}}
  end

  # iex with cont
  defp transition(line, :iex, :cont, acc) do
    {prompt, "", groups} = acc
    {:cont, {"#{prompt}\n#{line}", "", groups}}
  end

  defp transition(line, :cont, :cont, acc) do
    {prompt, "", groups} = acc
    {:cont, {"#{prompt}\n#{line}", "", groups}}
  end

  defp transition(line, :cont, :out, acc) do
    {prompt, "", groups} = acc
    {:out, {prompt, line, groups}}
  end

  defp transition(line, :out, :out, acc) do
    {prompt, output, groups} = acc
    {:out, {prompt, "#{output}\n#{line}", groups}}
  end
end
