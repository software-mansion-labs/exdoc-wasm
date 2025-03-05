defmodule ExDoc.Markdown.CodeBlock do
  @spec process(code :: String) :: {input :: String, output :: String}
  def process(code) do
    code
    |> String.split("\n", trim: true)
    |> Enum.reduce({nil, {"", "", []}}, fn
      "iex> " <> line, {prev_state, acc} -> transition(line, prev_state, :iex, acc)
      "...> " <> line, {prev_state, acc} -> transition(line, prev_state, :cont, acc)
      line, {prev_state, acc} -> transition(line, prev_state, :out, acc)
    end)
    |> then(fn
      # last one always have an output to use it as a default output
      {_state, {prompt, output, groups}} -> [{prompt, output} | groups]
    end)
    |> Enum.reverse()
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
